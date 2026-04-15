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
  movePanelSectionPanel,
  type PanelSectionsState,
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

export function buildPanelWorkbenchPreviewState<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession | null,
  adapter: PanelWorkbenchAdapter<TData>,
): PanelWorkbenchLayoutState<TData> | null {
  if (!session || session.phase !== "dragging") {
    return null;
  }

  if (!session.hoverTarget) {
    // When dragging the last panel out of a single-panel section,
    // preview the cleanup (section removal).
    const sourceSection = state.sections[session.currentPanelSectionId];
    if (!sourceSection || sourceSection.panels.length !== 1) {
      return null;
    }

    const nextSourceSection: PanelSectionStateItem = {
      ...sourceSection,
      panels: [],
      focusedPanelId: null,
    };

    return cleanupEmptyPanelWorkbenchSections(root, {
      sections: {
        ...state.sections,
        [session.currentPanelSectionId]: nextSourceSection,
      },
    }, adapter);
  }

  if (session.hoverTarget.area !== "content") {
    return null;
  }

  if (!session.hoverTarget.splitSide) {
    // Cross-section move without split (dropped inside content without a split indicator).
    if (session.hoverTarget.panelSectionId === session.currentPanelSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.panelSectionId];
    if (!targetSection) {
      return null;
    }

    const mergedState = movePanelSectionPanel(state, {
      sourceSectionId: session.currentPanelSectionId,
      targetSectionId: session.hoverTarget.panelSectionId,
      panelId: session.panelId,
      targetIndex: targetSection.panels.length,
    });

    return cleanupEmptyPanelWorkbenchSections(root, mergedState, adapter);
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return null;
  }

  const previewIds = createPanelWorkbenchPreviewIdentifiers(session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: previewIds.newChildSectionId,
    nextPanelSectionId: previewIds.panelSectionId,
    title: session.label,
  });

  const previewRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let previewState: PanelSectionsState = {
    sections: {
      ...state.sections,
      [previewIds.panelSectionId]: createEmptyPanelSectionStateItem(previewIds.panelSectionId),
    },
  };
  previewState = movePanelSectionPanel(previewState, {
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

  if (!session.hoverTarget.splitSide) {
    // Cross-section move without split.
    if (session.hoverTarget.panelSectionId === session.currentPanelSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.panelSectionId];
    if (!targetSection) {
      return null;
    }

    const movedState = movePanelSectionPanel(state, {
      sourceSectionId: session.currentPanelSectionId,
      targetSectionId: session.hoverTarget.panelSectionId,
      panelId: session.panelId,
      targetIndex: targetSection.panels.length,
    });
    const cleaned = cleanupEmptyPanelWorkbenchSections(root, movedState, adapter);
    return {
      ...cleaned,
      activePanelSectionId: session.hoverTarget.panelSectionId,
    };
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getPanelSectionId(targetLeaf, adapter)) {
    return null;
  }

  const committedIds = createCommittedPanelWorkbenchIdentifiers(root, state, session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = adapter.createPanelSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: committedIds.newChildSectionId,
    nextPanelSectionId: committedIds.panelSectionId,
    title: session.label,
  });

  const committedRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let committedState: PanelSectionsState = {
    sections: {
      ...state.sections,
      [committedIds.panelSectionId]: createEmptyPanelSectionStateItem(committedIds.panelSectionId),
    },
  };
  committedState = movePanelSectionPanel(committedState, {
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
