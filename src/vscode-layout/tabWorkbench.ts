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
  moveTabSectionTab,
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
        if (tabSection.isRoot) {
          continue;
        }

        const nextSections = { ...nextState.sections };
        delete nextSections[tabSectionId];
        nextState = tabSection.isRoot
          ? promoteRootTabSectionIfNeeded(nextRoot, { sections: nextSections }, adapter)
          : { sections: nextSections };
        changed = true;
        break;
      }

      if (tabSection.isRoot) {
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

  if (!session.hoverTarget) {
    const sourceSection = state.sections[session.currentTabSectionId];
    if (!sourceSection || sourceSection.tabs.length !== 1) {
      return null;
    }

    const nextSourceSection: TabSectionStateItem = {
      ...sourceSection,
      tabs: [],
      focusedTabId: null,
    };

    return cleanupEmptyTabWorkbenchSections(root, {
      sections: {
        ...state.sections,
        [session.currentTabSectionId]: nextSourceSection,
      },
    }, adapter);
  }

  if (session.hoverTarget.area !== "content") {
    return null;
  }

  if (!session.hoverTarget.splitSide) {
    if (session.hoverTarget.tabSectionId === session.currentTabSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.tabSectionId];
    if (!targetSection) {
      return null;
    }

    const mergedState = moveTabSectionTab(state, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: session.hoverTarget.tabSectionId,
      tabId: session.tabId,
      targetIndex: targetSection.tabs.length,
    });

    return cleanupEmptyTabWorkbenchSections(root, mergedState, adapter);
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getTabSectionId(targetLeaf, adapter)) {
    return null;
  }

  const previewIds = createTabWorkbenchPreviewIdentifiers(session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolveTabWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = adapter.createTabSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: previewIds.newChildSectionId,
    nextTabSectionId: previewIds.tabSectionId,
    title: session.title,
  });

  const previewRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let previewState: TabSectionsState = {
    sections: {
      ...state.sections,
      [previewIds.tabSectionId]: createEmptyTabSectionStateItem(previewIds.tabSectionId),
    },
  };
  previewState = moveTabSectionTab(previewState, {
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
  if (!session || session.phase !== "dragging" || !session.hoverTarget || session.hoverTarget.area !== "content") {
    return null;
  }

  if (!session.hoverTarget.splitSide) {
    if (session.hoverTarget.tabSectionId === session.currentTabSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.tabSectionId];
    if (!targetSection) {
      return null;
    }

    const movedState = moveTabSectionTab(state, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: session.hoverTarget.tabSectionId,
      tabId: session.tabId,
      targetIndex: targetSection.tabs.length,
    });
    const cleaned = cleanupEmptyTabWorkbenchSections(root, movedState, adapter);
    return {
      ...cleaned,
      activeTabSectionId: session.hoverTarget.tabSectionId,
    };
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || !getTabSectionId(targetLeaf, adapter)) {
    return null;
  }

  const committedIds = createCommittedTabWorkbenchIdentifiers(root, state, session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolveTabWorkbenchSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = adapter.createTabSectionDraft({
    sourceLeaf: targetLeaf,
    nextSectionId: committedIds.newChildSectionId,
    nextTabSectionId: committedIds.tabSectionId,
    title: session.title,
  });

  const committedRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let committedState: TabSectionsState = {
    sections: {
      ...state.sections,
      [committedIds.tabSectionId]: createEmptyTabSectionStateItem(committedIds.tabSectionId),
    },
  };
  committedState = moveTabSectionTab(committedState, {
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
