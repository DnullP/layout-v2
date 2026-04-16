/**
 * @module host/layout-v2/vscode-layout/tabWorkbench
 * @description 面向宿主的 tab workbench 辅助逻辑。
 *   将 TabSection 组件级拖拽会话收敛成可复用的 preview / commit / cleanup API，
 *   避免外部宿主复制 demo 中的布局提交逻辑。
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
  closeTabSectionTab,
  findTabInSectionsState,
  moveTabSectionTab,
  type TabSectionTabMove,
  type TabSectionTabDefinition,
  type TabSectionsState,
  type TabSectionStateItem,
} from "../tab-section/tabSectionModel";
import {
  type TabSectionDragSession,
  type TabSectionSplitSide,
} from "../tab-section/tabSectionDrag";

export const PREVIEW_TAB_SECTION_ID_PREFIX = "preview-tab-section";
export const PREVIEW_SECTION_ID_PREFIX = "preview-section";

export interface CreateTabWorkbenchDraftArgs<TData extends SectionComponentData> {
  sourceLeaf: SectionNode<TData>;
  nextSectionId: string;
  nextTabSectionId: string;
  title: string;
}

export interface TabWorkbenchAdapter<TData extends SectionComponentData> {
  createTabSectionDraft: (args: CreateTabWorkbenchDraftArgs<TData>) => SectionDraft<TData>;
  getTabSectionId?: (section: SectionNode<TData>) => string | null;
}

export interface TabWorkbenchLayoutState<TData extends SectionComponentData> {
  root: SectionNode<TData>;
  state: TabSectionsState;
}

export interface CommitTabWorkbenchResult<TData extends SectionComponentData>
  extends TabWorkbenchLayoutState<TData> {
  activeTabSectionId: string | null;
}

interface DetachedTabWorkbenchBase<TData extends SectionComponentData>
  extends TabWorkbenchLayoutState<TData> {
  detachedTab: TabSectionTabDefinition;
}

function defaultGetTabSectionId<TData extends SectionComponentData>(
  section: SectionNode<TData>,
): string | null {
  const binding = getSectionComponentBinding(section);
  if (binding.type !== "tab-section") {
    return null;
  }

  const tabSectionId = (binding.props as { tabSectionId?: unknown }).tabSectionId;
  return typeof tabSectionId === "string" ? tabSectionId : null;
}

function getTabSectionId<TData extends SectionComponentData>(
  section: SectionNode<TData>,
  adapter: TabWorkbenchAdapter<TData>,
): string | null {
  return (adapter.getTabSectionId ?? defaultGetTabSectionId)(section);
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

function createEmptyTabSectionStateItem(tabSectionId: string): TabSectionStateItem {
  return {
    id: tabSectionId,
    tabs: [],
    focusedTabId: null,
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

function findTabSectionLeafContext<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  tabSectionId: string,
  adapter: TabWorkbenchAdapter<TData>,
): {
  leaf: SectionNode<TData>;
  parent: SectionNode<TData> | null;
} | null {
  const visit = (
    node: SectionNode<TData>,
    parent: SectionNode<TData> | null,
  ): { leaf: SectionNode<TData>; parent: SectionNode<TData> | null } | null => {
    if (!node.split) {
      if (getTabSectionId(node, adapter) === tabSectionId) {
        return { leaf: node, parent };
      }
      return null;
    }

    return visit(node.split.children[0], node) ?? visit(node.split.children[1], node);
  };

  return visit(root, null);
}

function promoteRootTabSectionIfNeeded<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  adapter: TabWorkbenchAdapter<TData>,
): TabSectionsState {
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
      const tabSectionId = getTabSectionId(current, adapter);
      if (tabSectionId && state.sections[tabSectionId]) {
        return {
          sections: {
            ...state.sections,
            [tabSectionId]: {
              ...state.sections[tabSectionId],
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

export function cleanupEmptyTabWorkbenchSections<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  adapter: TabWorkbenchAdapter<TData>,
): TabWorkbenchLayoutState<TData> {
  let nextRoot = root;
  let nextState = state;

  while (true) {
    const emptySectionIds = Object.values(nextState.sections)
      .filter((section) => section.tabs.length === 0)
      .map((section) => section.id);
    let changed = false;

    for (const tabSectionId of emptySectionIds) {
      const tabSection = nextState.sections[tabSectionId];
      if (!tabSection) {
        continue;
      }

      const context = findTabSectionLeafContext(nextRoot, tabSectionId, adapter);
      if (!context) {
        const nextSections = { ...nextState.sections };
        delete nextSections[tabSectionId];
        nextState = tabSection.isRoot
          ? promoteRootTabSectionIfNeeded(nextRoot, { sections: nextSections }, adapter)
          : { sections: nextSections };
        changed = true;
        break;
      }

      const canCollapseProtectedRoot = Boolean(
        tabSection.isRoot && context.parent,
      );
      if (tabSection.isRoot && !canCollapseProtectedRoot) {
        continue;
      }

      nextRoot = destroySectionTree(nextRoot, context.leaf.id);
      const nextSections = { ...nextState.sections };
      delete nextSections[tabSectionId];
      nextState = tabSection.isRoot
        ? promoteRootTabSectionIfNeeded(nextRoot, { sections: nextSections }, adapter)
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

export function applyTabWorkbenchTabMove<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  move: TabSectionTabMove,
  adapter: TabWorkbenchAdapter<TData>,
): TabWorkbenchLayoutState<TData> {
  return cleanupEmptyTabWorkbenchSections(root, moveTabSectionTab(state, move), adapter);
}

function buildDetachedTabWorkbenchBase<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  session: TabSectionDragSession,
  adapter: TabWorkbenchAdapter<TData>,
): DetachedTabWorkbenchBase<TData> | null {
  const sourceEntry = findTabInSectionsState(state, session.tabId);
  if (!sourceEntry || sourceEntry.section.id !== session.sourceTabSectionId || sourceEntry.section.tabs.length !== 1) {
    return null;
  }

  const detachedState = closeTabSectionTab(state, session.sourceTabSectionId, session.tabId);
  const cleaned = cleanupEmptyTabWorkbenchSections(root, detachedState, adapter);
  return {
    ...cleaned,
    detachedTab: sourceEntry.tab,
  };
}

function insertTabIntoSection(
  state: TabSectionsState,
  targetSectionId: string,
  tab: TabSectionTabDefinition,
  targetIndex: number,
): TabSectionsState {
  const targetSection = state.sections[targetSectionId];
  if (!targetSection || targetSection.tabs.some((item) => item.id === tab.id)) {
    return state;
  }

  const nextTabs = [...targetSection.tabs];
  const nextTargetIndex = Math.max(0, Math.min(targetIndex, nextTabs.length));
  nextTabs.splice(nextTargetIndex, 0, tab);

  return {
    sections: {
      ...state.sections,
      [targetSection.id]: {
        ...targetSection,
        tabs: nextTabs,
        focusedTabId: tab.id,
      },
    },
  };
}

function resolveTargetTabWorkbenchLeaf<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  target: { anchorLeafSectionId?: string; tabSectionId: string },
  adapter: TabWorkbenchAdapter<TData>,
): SectionNode<TData> | null {
  const anchoredLeaf = target.anchorLeafSectionId
    ? findSectionNode(root, target.anchorLeafSectionId)
    : null;
  if (anchoredLeaf && !anchoredLeaf.split && getTabSectionId(anchoredLeaf, adapter)) {
    return anchoredLeaf;
  }

  return findTabSectionLeafContext(root, target.tabSectionId, adapter)?.leaf ?? null;
}

export function resolveTabWorkbenchSplitPlan(side: TabSectionSplitSide): {
  direction: SectionSplitDirection;
  ratio: number;
  originalAt: "first" | "second";
} {
  if (side === "left") {
    return { direction: "horizontal", ratio: 0.5, originalAt: "second" };
  }

  if (side === "right") {
    return { direction: "horizontal", ratio: 0.5, originalAt: "first" };
  }

  if (side === "top") {
    return { direction: "vertical", ratio: 0.5, originalAt: "second" };
  }

  return { direction: "vertical", ratio: 0.5, originalAt: "first" };
}

export function createTabWorkbenchPreviewIdentifiers(anchorLeafSectionId: string): {
  tabSectionId: string;
  originalChildSectionId: string;
  newChildSectionId: string;
} {
  return {
    tabSectionId: `${PREVIEW_TAB_SECTION_ID_PREFIX}-${anchorLeafSectionId}`,
    originalChildSectionId: `${PREVIEW_SECTION_ID_PREFIX}-${anchorLeafSectionId}-original`,
    newChildSectionId: `${PREVIEW_SECTION_ID_PREFIX}-${anchorLeafSectionId}-new`,
  };
}

function createCommittedTabWorkbenchIdentifiers<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  anchorLeafSectionId: string,
): {
  tabSectionId: string;
  originalChildSectionId: string;
  newChildSectionId: string;
} {
  const usedSectionIds = collectAllSectionIds(root);
  const usedTabSectionIds = new Set(Object.keys(state.sections));

  return {
    tabSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-tabs`, usedTabSectionIds),
    originalChildSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-section`, usedSectionIds),
    newChildSectionId: createUniqueIdentifier(`${anchorLeafSectionId}-split`, usedSectionIds),
  };
}

export function resolveTabWorkbenchCommittedLeafSectionId(
  sectionId: string,
  anchorLeafSectionId?: string,
): string {
  if (sectionId.startsWith(PREVIEW_SECTION_ID_PREFIX) && anchorLeafSectionId) {
    return anchorLeafSectionId;
  }

  return sectionId;
}

export function isTabWorkbenchPreviewLeaf(sectionId: string, isDragging: boolean): boolean {
  return isDragging && sectionId.startsWith(PREVIEW_SECTION_ID_PREFIX);
}

export function buildTabWorkbenchPreviewState<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  session: TabSectionDragSession | null,
  adapter: TabWorkbenchAdapter<TData>,
): TabWorkbenchLayoutState<TData> | null {
  if (!session || session.phase !== "dragging") {
    return null;
  }

  const detachedBase = buildDetachedTabWorkbenchBase(root, state, session, adapter);
  const workingRoot = detachedBase?.root ?? root;
  const workingState = detachedBase?.state ?? state;

  if (!session.hoverTarget) {
    return detachedBase;
  }

  if (session.hoverTarget.area !== "content") {
    return detachedBase;
  }

  if (!session.hoverTarget.splitSide) {
    if (!detachedBase && session.hoverTarget.tabSectionId === session.currentTabSectionId) {
      return null;
    }

    const targetSection = workingState.sections[session.hoverTarget.tabSectionId];
    if (!targetSection) {
      return detachedBase;
    }

    const mergedState = detachedBase
      ? insertTabIntoSection(workingState, session.hoverTarget.tabSectionId, detachedBase.detachedTab, targetSection.tabs.length)
      : moveTabSectionTab(workingState, {
        sourceSectionId: session.currentTabSectionId,
        targetSectionId: session.hoverTarget.tabSectionId,
        tabId: session.tabId,
        targetIndex: targetSection.tabs.length,
      });

    return cleanupEmptyTabWorkbenchSections(workingRoot, mergedState, adapter);
  }

  const targetLeaf = resolveTargetTabWorkbenchLeaf(workingRoot, session.hoverTarget, adapter);
  if (!targetLeaf || targetLeaf.split || !getTabSectionId(targetLeaf, adapter)) {
    return detachedBase;
  }

  const previewIds = createTabWorkbenchPreviewIdentifiers(targetLeaf.id);
  const splitPlan = resolveTabWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = adapter.createTabSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: previewIds.newChildSectionId,
    nextTabSectionId: previewIds.tabSectionId,
    title: session.title,
  });

  const previewRoot = splitSectionTree(
    workingRoot,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let previewState: TabSectionsState = {
    sections: {
      ...workingState.sections,
      [previewIds.tabSectionId]: createEmptyTabSectionStateItem(previewIds.tabSectionId),
    },
  };
  previewState = detachedBase
    ? insertTabIntoSection(previewState, previewIds.tabSectionId, detachedBase.detachedTab, 0)
    : moveTabSectionTab(previewState, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: previewIds.tabSectionId,
      tabId: session.tabId,
      targetIndex: 0,
    });

  return cleanupEmptyTabWorkbenchSections(previewRoot, previewState, adapter);
}

export function commitTabWorkbenchDrop<TData extends SectionComponentData>(
  root: SectionNode<TData>,
  state: TabSectionsState,
  session: TabSectionDragSession | null,
  adapter: TabWorkbenchAdapter<TData>,
): CommitTabWorkbenchResult<TData> | null {
  if (!session || session.phase !== "dragging" || !session.hoverTarget) {
    return null;
  }

  const detachedBase = buildDetachedTabWorkbenchBase(root, state, session, adapter);
  const workingRoot = detachedBase?.root ?? root;
  const workingState = detachedBase?.state ?? state;

  if (!session.hoverTarget.splitSide) {
    if (!detachedBase && session.hoverTarget.tabSectionId === session.currentTabSectionId) {
      return null;
    }

    const targetSection = workingState.sections[session.hoverTarget.tabSectionId];
    if (!targetSection) {
      return null;
    }

    const targetIndex = session.hoverTarget.area === "strip"
      ? (session.hoverTarget.targetIndex ?? targetSection.tabs.length)
      : targetSection.tabs.length;

    const movedState = detachedBase
      ? insertTabIntoSection(workingState, session.hoverTarget.tabSectionId, detachedBase.detachedTab, targetIndex)
      : moveTabSectionTab(workingState, {
        sourceSectionId: session.currentTabSectionId,
        targetSectionId: session.hoverTarget.tabSectionId,
        tabId: session.tabId,
        targetIndex,
      });
    const cleaned = cleanupEmptyTabWorkbenchSections(workingRoot, movedState, adapter);
    return {
      ...cleaned,
      activeTabSectionId: session.hoverTarget.tabSectionId,
    };
  }

  const targetLeaf = resolveTargetTabWorkbenchLeaf(workingRoot, session.hoverTarget, adapter);
  if (!targetLeaf || targetLeaf.split || !getTabSectionId(targetLeaf, adapter)) {
    return null;
  }

  const committedIds = createCommittedTabWorkbenchIdentifiers(workingRoot, workingState, targetLeaf.id);
  const splitPlan = resolveTabWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = adapter.createTabSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: committedIds.newChildSectionId,
    nextTabSectionId: committedIds.tabSectionId,
    title: session.title,
  });

  const committedRoot = splitSectionTree(
    workingRoot,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let committedState: TabSectionsState = {
    sections: {
      ...workingState.sections,
      [committedIds.tabSectionId]: createEmptyTabSectionStateItem(committedIds.tabSectionId),
    },
  };
  committedState = detachedBase
    ? insertTabIntoSection(committedState, committedIds.tabSectionId, detachedBase.detachedTab, 0)
    : moveTabSectionTab(committedState, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: committedIds.tabSectionId,
      tabId: session.tabId,
      targetIndex: 0,
    });

  const cleaned = cleanupEmptyTabWorkbenchSections(committedRoot, committedState, adapter);
  return {
    ...cleaned,
    activeTabSectionId: committedIds.tabSectionId,
  };
}
