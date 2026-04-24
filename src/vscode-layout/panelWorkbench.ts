/**
 * @module host/layout-v2/vscode-layout/panelWorkbench
 * @description 面向宿主的 panel workbench 辅助逻辑。
 *   将 PanelSection 组件级拖拽会话收敛成可复用的 preview / commit / cleanup API，
 *   实现侧栏 panel 拖拽分裂。
 */

import {
  destroySectionTree,
  findSectionNode,
  splitSectionTree,
  type SectionDraft,
  type SectionNode,
  type SectionSplitDirection,
} from "./layoutModel";
import {
  getSectionComponentBinding,
  type SectionComponentData,
} from "./sectionComponent";
import {
  findPanelInSectionsState,
  insertPanelSectionPanel,
  removePanelSectionPanel,
  movePanelSectionPanel,
  type PanelSectionsState,
  type PanelSectionPanelDefinition,
  type PanelSectionStateItem,
} from "../panel-section/panelSectionModel";
import {
  type PanelSectionDragSession,
  type PanelSectionHoverTarget,
  type PanelSectionSplitSide,
} from "../panel-section/panelSectionDrag";

export const PREVIEW_PANEL_SECTION_ID_PREFIX = "preview-panel-section";
export const PREVIEW_PANEL_LEAF_PREFIX = "preview-panel-leaf";

export interface CreatePanelWorkbenchDraftArgs<TData extends SectionComponentData> {
  sourceLeaf: SectionNode<TData>;
  nextSectionId: string;
  nextPanelSectionId: string;
  title: string;
}

export interface PanelWorkbenchAdapter<TData extends SectionComponentData> {
  createPanelSectionDraft: (args: CreatePanelWorkbenchDraftArgs<TData>) => SectionDraft<TData>;
  getPanelSectionId?: (section: SectionNode<TData>) => string | null;
}

export interface PanelWorkbenchLayoutState<TData extends SectionComponentData> {
  root: SectionNode<TData>;
  state: PanelSectionsState;
}

export interface CommitPanelWorkbenchResult<TData extends SectionComponentData>
  extends PanelWorkbenchLayoutState<TData> {
  activePanelSectionId: string | null;
}

export interface FinalizePanelWorkbenchResult<TData extends SectionComponentData>
  extends PanelWorkbenchLayoutState<TData> {
  activePanelSectionId: string | null;
}

interface DetachedPanelWorkbenchBase<TData extends SectionComponentData>
  extends PanelWorkbenchLayoutState<TData> {
  detachedPanel: PanelSectionPanelDefinition;
}

function defaultGetPanelSectionId<TData extends SectionComponentData>(
  section: SectionNode<TData>,
): string | null {
  const binding = getSectionComponentBinding(section);
  if (binding.type !== "panel-section") {
    return null;
  }

  const panelSectionId = (binding.props as { panelSectionId?: unknown }).panelSectionId;
  return typeof panelSectionId === "string" ? panelSectionId : null;
}

function getPanelSectionId<TData extends SectionComponentData>(
  section: SectionNode<TData>,
  adapter: PanelWorkbenchAdapter<TData>,
): string | null {
  return (adapter.getPanelSectionId ?? defaultGetPanelSectionId)(section);
}

function collectAllSectionIds<TData extends SectionComponentData>(root: SectionNode<TData>): Set<string> {
  const ids = new Set<string>();
  const queue: SectionNode<TData>[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || ids.has(current.id)) {
      continue;
    }

    ids.add(current.id);
    if (current.split) {
      queue.push(current.split.children[0], current.split.children[1]);
    }
  }

  return ids;
}

function createUniqueIdentifier(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId;
  let suffix = 1;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function createEmptyPanelSectionStateItem(panelSectionId: string): PanelSectionStateItem {
  return {
    id: panelSectionId,
    panels: [],
    focusedPanelId: null,
    isCollapsed: false,
    isRoot: false,
  };
}

function buildSectionDraftFromLeaf<TData extends SectionComponentData>(
  leaf: SectionNode<TData>,
  nextId: string,
): SectionDraft<TData> {
  return {
    id: nextId,
    title: leaf.title,
    data: leaf.data,
    resizableEdges: leaf.resizableEdges,
  };
}

function findPanelSectionLeafContext<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  panelSectionId: string,
  adapter: PanelWorkbenchAdapter<TData>,
): {
  leaf: SectionNode<TData>;
  parent: SectionNode<TData> | null;
} | null {
  const visit = (
    node: SectionNode<TData>,
    parent: SectionNode<TData> | null,
  ): { leaf: SectionNode<TData>; parent: SectionNode<TData> | null } | null => {
    if (!node.split) {
      if (getPanelSectionId(node, adapter) === panelSectionId) {
        return { leaf: node, parent };
      }
      return null;
    }

    return visit(node.split.children[0], node) ?? visit(node.split.children[1], node);
  };

  return visit(root, null);
}

function promoteRootPanelSectionIfNeeded<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  adapter: PanelWorkbenchAdapter<TData>,
): PanelSectionsState {
  const hasRoot = Object.values(state.sections).some((section) => section.isRoot);
  if (hasRoot) {
    return state;
  }

  const queue: SectionNode<TData>[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!current.split) {
      const panelSectionId = getPanelSectionId(current, adapter);
      if (panelSectionId && state.sections[panelSectionId]) {
        return {
          sections: {
            ...state.sections,
            [panelSectionId]: {
              ...state.sections[panelSectionId],
              isRoot: true,
            },
          },
        };
      }
      continue;
    }

    queue.push(current.split.children[0], current.split.children[1]);
  }

  return state;
}

export function cleanupEmptyPanelWorkbenchSections<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  adapter: PanelWorkbenchAdapter<TData>,
): PanelWorkbenchLayoutState<TData> {
  let nextRoot = root;
  let nextState = state;

  while (true) {
    const emptySectionIds = Object.values(nextState.sections)
      .filter((section) => section.panels.length === 0)
      .map((section) => section.id);
    let changed = false;

    for (const panelSectionId of emptySectionIds) {
      const panelSection = nextState.sections[panelSectionId];
      if (!panelSection) {
        continue;
      }

      const context = findPanelSectionLeafContext(nextRoot, panelSectionId, adapter);
      if (!context) {
        if (panelSection.isRoot) {
          continue;
        }

        const nextSections = { ...nextState.sections };
        delete nextSections[panelSectionId];
        nextState = panelSection.isRoot
          ? promoteRootPanelSectionIfNeeded(nextRoot, { sections: nextSections }, adapter)
          : { sections: nextSections };
        changed = true;
        break;
      }

      if (panelSection.isRoot) {
        continue;
      }

      nextRoot = destroySectionTree(nextRoot, context.leaf.id);
      const nextSections = { ...nextState.sections };
      delete nextSections[panelSectionId];
      nextState = panelSection.isRoot
        ? promoteRootPanelSectionIfNeeded(nextRoot, { sections: nextSections }, adapter)
        : { sections: nextSections };
      changed = true;
      break;
    }

    if (!changed) {
      break;
    }
  }

  return {
    root: nextRoot,
    state: nextState,
  };
}

export function resolvePanelWorkbenchSplitPlan(side: PanelSectionSplitSide): {
  direction: SectionSplitDirection;
  ratio: number;
  originalAt: "first" | "second";
} {
  if (side === "top") {
    return { direction: "vertical", ratio: 0.5, originalAt: "second" };
  }

  return { direction: "vertical", ratio: 0.5, originalAt: "first" };
}

function createPanelWorkbenchPreviewIdentifiers(anchorLeafSectionId: string): {
  panelSectionId: string;
  originalChildSectionId: string;
  newChildSectionId: string;
} {
  return {
    panelSectionId: `${PREVIEW_PANEL_SECTION_ID_PREFIX}-${anchorLeafSectionId}`,
    originalChildSectionId: `${PREVIEW_PANEL_LEAF_PREFIX}-${anchorLeafSectionId}-original`,
    newChildSectionId: `${PREVIEW_PANEL_LEAF_PREFIX}-${anchorLeafSectionId}-new`,
  };
}

function createCommittedPanelWorkbenchIdentifiers<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  anchorLeafSectionId: string,
): {
  panelSectionId: string;
  originalChildSectionId: string;
  newChildSectionId: string;
} {
  const usedSectionIds = collectAllSectionIds(root);
  const usedPanelSectionIds = new Set(Object.keys(state.sections));

  return {
    panelSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-panels`, usedPanelSectionIds),
    originalChildSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-section`, usedSectionIds),
    newChildSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-split`, usedSectionIds),
  };
}

function findPanelSectionLeaf<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  panelSectionId: string,
  adapter: PanelWorkbenchAdapter<TData>,
): SectionNode<TData> | null {
  const queue: SectionNode<TData>[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!current.split && getPanelSectionId(current, adapter) === panelSectionId) {
      return current;
    }

    if (current.split) {
      queue.push(current.split.children[0], current.split.children[1]);
    }
  }

  return null;
}

function resolvePanelWorkbenchContentTargetLeaf<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  hoverTarget: PanelSectionHoverTarget,
  adapter: PanelWorkbenchAdapter<TData>,
): SectionNode<TData> | null {
  if (hoverTarget.anchorLeafSectionId) {
    const anchorLeaf = findSectionNode(root, hoverTarget.anchorLeafSectionId);
    if (anchorLeaf && !anchorLeaf.split && getPanelSectionId(anchorLeaf, adapter)) {
      return anchorLeaf;
    }
  }

  return findPanelSectionLeaf(root, hoverTarget.panelSectionId, adapter);
}

function buildDetachedPanelWorkbenchBase<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession,
  adapter: PanelWorkbenchAdapter<TData>,
): DetachedPanelWorkbenchBase<TData> | null {
  const sourceEntry = findPanelInSectionsState(state, session.panelId);
  if (!sourceEntry || sourceEntry.section.id !== session.sourcePanelSectionId || sourceEntry.section.panels.length !== 1) {
    return null;
  }

  const detachedState = removePanelSectionPanel(state, session.sourcePanelSectionId, session.panelId);
  const cleaned = cleanupEmptyPanelWorkbenchSections(root, detachedState, adapter);
  return {
    ...cleaned,
    detachedPanel: sourceEntry.panel,
  };
}

export function buildPanelWorkbenchPreviewState<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession | null,
  adapter: PanelWorkbenchAdapter<TData>,
): PanelWorkbenchLayoutState<TData> | null {
  if (!session || session.phase !== "dragging") {
    return null;
  }

  const detachedBase = buildDetachedPanelWorkbenchBase(root, state, session, adapter);
  const workingRoot = detachedBase?.root ?? root;
  const workingState = detachedBase?.state ?? state;

  if (!session.hoverTarget) {
    return detachedBase;
  }

  if (session.hoverTarget.area !== "content") {
    return detachedBase;
  }

  if (!session.hoverTarget.splitSide) {
    // Cross-section move without split (dropped inside content without a split indicator).
    if (!detachedBase && session.hoverTarget.panelSectionId === session.currentPanelSectionId) {
      return null;
    }

    const targetSection = workingState.sections[session.hoverTarget.panelSectionId];
    if (!targetSection) {
      return detachedBase;
    }

    const mergedState = detachedBase
      ? insertPanelSectionPanel(workingState, session.hoverTarget.panelSectionId, detachedBase.detachedPanel, targetSection.panels.length)
      : movePanelSectionPanel(workingState, {
        sourceSectionId: session.currentPanelSectionId,
        targetSectionId: session.hoverTarget.panelSectionId,
        panelId: session.panelId,
        targetIndex: targetSection.panels.length,
      });

    return cleanupEmptyPanelWorkbenchSections(workingRoot, mergedState, adapter);
  }

  const targetLeaf = resolvePanelWorkbenchContentTargetLeaf(
    workingRoot,
    session.hoverTarget,
    adapter,
  );
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return detachedBase;
  }

  const previewIds = createPanelWorkbenchPreviewIdentifiers(
    session.hoverTarget.anchorLeafSectionId ?? targetLeaf.id,
  );
  const splitPlan = resolvePanelWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: previewIds.newChildSectionId,
    nextPanelSectionId: previewIds.panelSectionId,
    title: session.label,
  });

  const previewRoot = splitSectionTree(
    workingRoot,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let previewState: PanelSectionsState = {
    sections: {
      ...workingState.sections,
      [previewIds.panelSectionId]: createEmptyPanelSectionStateItem(previewIds.panelSectionId),
    },
  };
  previewState = detachedBase
    ? insertPanelSectionPanel(previewState, previewIds.panelSectionId, detachedBase.detachedPanel, 0)
    : movePanelSectionPanel(previewState, {
      sourceSectionId: session.currentPanelSectionId,
      targetSectionId: previewIds.panelSectionId,
      panelId: session.panelId,
      targetIndex: 0,
    });

  return cleanupEmptyPanelWorkbenchSections(previewRoot, previewState, adapter);
}

export function commitPanelWorkbenchDrop<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession | null,
  adapter: PanelWorkbenchAdapter<TData>,
): CommitPanelWorkbenchResult<TData> | null {
  if (!session || session.phase !== "dragging" || !session.hoverTarget || session.hoverTarget.area !== "content") {
    return null;
  }

  const detachedBase = buildDetachedPanelWorkbenchBase(root, state, session, adapter);
  const workingRoot = detachedBase?.root ?? root;
  const workingState = detachedBase?.state ?? state;

  if (!session.hoverTarget.splitSide) {
    // Cross-section move without split.
    if (!detachedBase && session.hoverTarget.panelSectionId === session.currentPanelSectionId) {
      return null;
    }

    const targetSection = workingState.sections[session.hoverTarget.panelSectionId];
    if (!targetSection) {
      return null;
    }

    const movedState = detachedBase
      ? insertPanelSectionPanel(workingState, session.hoverTarget.panelSectionId, detachedBase.detachedPanel, targetSection.panels.length)
      : movePanelSectionPanel(workingState, {
        sourceSectionId: session.currentPanelSectionId,
        targetSectionId: session.hoverTarget.panelSectionId,
        panelId: session.panelId,
        targetIndex: targetSection.panels.length,
      });
    const cleaned = cleanupEmptyPanelWorkbenchSections(workingRoot, movedState, adapter);
    return {
      ...cleaned,
      activePanelSectionId: session.hoverTarget.panelSectionId,
    };
  }

  const targetLeaf = resolvePanelWorkbenchContentTargetLeaf(
    workingRoot,
    session.hoverTarget,
    adapter,
  );
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return null;
  }

  const committedIds = createCommittedPanelWorkbenchIdentifiers(
    workingRoot,
    workingState,
    session.hoverTarget.anchorLeafSectionId ?? targetLeaf.id,
  );
  const splitPlan = resolvePanelWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: committedIds.newChildSectionId,
    nextPanelSectionId: committedIds.panelSectionId,
    title: session.label,
  });

  const committedRoot = splitSectionTree(
    workingRoot,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let committedState: PanelSectionsState = {
    sections: {
      ...workingState.sections,
      [committedIds.panelSectionId]: createEmptyPanelSectionStateItem(committedIds.panelSectionId),
    },
  };
  committedState = detachedBase
    ? insertPanelSectionPanel(committedState, committedIds.panelSectionId, detachedBase.detachedPanel, 0)
    : movePanelSectionPanel(committedState, {
      sourceSectionId: session.currentPanelSectionId,
      targetSectionId: committedIds.panelSectionId,
      panelId: session.panelId,
      targetIndex: 0,
    });

  const cleaned = cleanupEmptyPanelWorkbenchSections(committedRoot, committedState, adapter);
  return {
    ...cleaned,
    activePanelSectionId: committedIds.panelSectionId,
  };
}

export function finalizePanelWorkbenchDrop<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession | null,
  adapter: PanelWorkbenchAdapter<TData>,
): FinalizePanelWorkbenchResult<TData> | null {
  const committed = commitPanelWorkbenchDrop(root, state, session, adapter);
  if (committed) {
    return committed;
  }

  if (!session || session.phase !== "dragging") {
    return null;
  }

  const detachedBase = buildDetachedPanelWorkbenchBase(root, state, session, adapter);
  let nextState = state;
  let nextRoot = root;
  let activePanelSectionId = session.currentPanelSectionId;

  if (session.hoverTarget?.area === "bar") {
    const targetSectionId = session.hoverTarget.panelSectionId;
    const targetState = detachedBase?.state ?? nextState;
    const targetSection = targetState.sections[targetSectionId];

    if (detachedBase && targetSection) {
      nextRoot = detachedBase.root;
      nextState = insertPanelSectionPanel(
        detachedBase.state,
        targetSectionId,
        detachedBase.detachedPanel,
        session.hoverTarget.targetIndex ?? targetSection.panels.length,
      );
      activePanelSectionId = targetSectionId;
    } else {
      const actualLocation = findPanelInSectionsState(nextState, session.panelId);
      if (actualLocation && targetSection) {
        nextState = movePanelSectionPanel(nextState, {
          sourceSectionId: actualLocation.section.id,
          targetSectionId,
          panelId: session.panelId,
          targetIndex: session.hoverTarget.targetIndex ?? targetSection.panels.length,
        });
        activePanelSectionId = targetSectionId;
      }
    }
  }

  const cleaned = cleanupEmptyPanelWorkbenchSections(nextRoot, nextState, adapter);
  if (nextState === state && cleaned.root === root && cleaned.state === nextState) {
    return null;
  }

  return {
    ...cleaned,
    activePanelSectionId,
  };
}

export function isPanelWorkbenchPreviewLeaf(sectionId: string, isDragging: boolean): boolean {
  return isDragging && sectionId.startsWith(PREVIEW_PANEL_LEAF_PREFIX);
}

export function resolvePanelWorkbenchCommittedLeafSectionId(
  sectionId: string,
  anchorLeafSectionId?: string,
): string {
  if (sectionId.startsWith(PREVIEW_PANEL_LEAF_PREFIX) && anchorLeafSectionId) {
    return anchorLeafSectionId;
  }

  return sectionId;
}

// ---------------------------------------------------------------------------
// Activity bar icon → panel content area split
// ---------------------------------------------------------------------------

export interface ActivityBarContentDropSession {
  iconId: string;
  contentTarget: PanelSectionHoverTarget;
}

export function buildActivityBarContentPreviewState<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  contentTarget: PanelSectionHoverTarget | null,
  adapter: PanelWorkbenchAdapter<TData>,
  title: string,
): PanelWorkbenchLayoutState<TData> | null {
  if (!contentTarget || contentTarget.area !== "content" || !contentTarget.splitSide || !contentTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, contentTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return null;
  }

  const previewIds = createPanelWorkbenchPreviewIdentifiers(contentTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelWorkbenchSplitPlan(contentTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: previewIds.newChildSectionId,
    nextPanelSectionId: previewIds.panelSectionId,
    title,
  });

  const previewRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  const previewState: PanelSectionsState = {
    sections: {
      ...state.sections,
      [previewIds.panelSectionId]: createEmptyPanelSectionStateItem(previewIds.panelSectionId),
    },
  };

  return { root: previewRoot, state: previewState };
}

export interface CommitActivityBarContentResult<TData extends SectionComponentData>
  extends PanelWorkbenchLayoutState<TData> {
  newPanelSectionId: string;
}

export function commitActivityBarContentDrop<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  contentTarget: PanelSectionHoverTarget | null,
  adapter: PanelWorkbenchAdapter<TData>,
): CommitActivityBarContentResult<TData> | null {
  if (!contentTarget || contentTarget.area !== "content" || !contentTarget.splitSide || !contentTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, contentTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return null;
  }

  const committedIds = createCommittedPanelWorkbenchIdentifiers(root, state, contentTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelWorkbenchSplitPlan(contentTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: committedIds.newChildSectionId,
    nextPanelSectionId: committedIds.panelSectionId,
    title: "",
  });

  const committedRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  const committedState: PanelSectionsState = {
    sections: {
      ...state.sections,
      [committedIds.panelSectionId]: createEmptyPanelSectionStateItem(committedIds.panelSectionId),
    },
  };

  return {
    root: committedRoot,
    state: committedState,
    newPanelSectionId: committedIds.panelSectionId,
  };
}
