/**
 * @module host/layout-v2/exampleLayoutState
 * @description layout-v2 示例页使用的纯状态与布局辅助逻辑。
 *   该模块承载示例布局结构、空 tab section 清理、preview split 构建等纯函数，
 *   便于 Bun 单元测试直接锚定回归场景，而不依赖 React 组件生命周期。
 * @dependencies
 *   - ./layoutModel
 *   - ./sectionComponent
 *   - ./tab-section/TabSection
 *   - ./tab-section/tabSectionModel
 *
 * @example
 *   const root = createVsCodeExample();
 *   const cleaned = cleanupEmptyTabSections(root, state);
 *
 * @exports
 *   - ExampleSectionData
 *   - ExampleSectionComponentBinding
 *   - ExampleSectionLayoutData
 *   - TEST_TABS
 *   - PREVIEW_TAB_SECTION_ID_PREFIX
 *   - isPreviewTabSectionId
 *   - createExampleSectionDraft
 *   - createVsCodeExample
 *   - findTabSectionLeaf
 *   - cleanupEmptyTabSections
 *   - buildPreviewLayoutState
 */

import {
  createRootSection,
  destroySectionTree,
  findSectionNode,
  splitSectionTree,
  type SectionDraft,
  type SectionNode,
  type SectionSplitDirection,
} from "./layoutModel";
import {
  createSectionComponentBinding,
  type SectionComponentBinding,
  type SectionComponentData,
} from "./sectionComponent";
import { type TabSectionDragSession, type TabSectionSplitSide } from "./tab-section/TabSection";
import {
  closeTabSectionTab,
  moveTabSectionTab,
  removeTabSection,
  upsertTabSection,
  type TabSectionsState,
  type TabSectionStateItem,
  type TabSectionTabDefinition,
} from "./tab-section/tabSectionModel";

/**
 * @interface ExampleSectionData
 * @description 示例 section 的最小数据结构。
 * @field role - section 角色标识。
 */
export interface ExampleSectionData {
  /** section 角色标识。 */
  role: "activity-bar" | "sidebar" | "main" | "container" | "root";
}

/**
 * @type ExampleSectionComponentBinding
 * @description 示例页支持的 section component 绑定。
 */
export type ExampleSectionComponentBinding =
  | SectionComponentBinding<"empty", Record<string, never>>
  | SectionComponentBinding<"activity-bar", { barId: string }>
  | SectionComponentBinding<"tab-section", { tabSectionId: string }>;

/**
 * @interface ExampleSectionLayoutData
 * @description 示例布局使用的 section 数据。
 * @extends SectionComponentData
 * @field role      - section 角色。
 * @field component - section component 绑定。
 */
export interface ExampleSectionLayoutData extends SectionComponentData<ExampleSectionComponentBinding> {
  /** section 角色标识。 */
  role: ExampleSectionData["role"];
}

/**
 * @constant TEST_TABS
 * @description 主区域 tab section 的初始测试 tabs。
 */
export const TEST_TABS: TabSectionTabDefinition[] = [
  {
    id: "tab-welcome",
    title: "Welcome",
    content: "Workspace overview, quick commands, and recently touched notes.",
    tone: "blue",
  },
  {
    id: "tab-daily-notes",
    title: "Daily Notes",
    content: "Pinned notes, calendar-linked tasks, and the current editing context.",
    tone: "green",
  },
  {
    id: "tab-outline",
    title: "Outline",
    content: "Document structure, headings, backlinks, and semantic navigation helpers.",
    tone: "amber",
  },
  {
    id: "tab-review",
    title: "Review Queue",
    content: "Pending edits, unresolved backlinks, and notes that still need triage.",
    tone: "red",
  },
];

/**
 * @constant PREVIEW_TAB_SECTION_ID_PREFIX
 * @description 临时预览 tab section 的逻辑 id 前缀。
 */
export const PREVIEW_TAB_SECTION_ID_PREFIX = "preview-tab-section";

/**
 * @constant PREVIEW_SECTION_ID_PREFIX
 * @description 临时预览 section 的逻辑 id 前缀。
 */
export const PREVIEW_SECTION_ID_PREFIX = "preview-section";

/**
 * @function isPreviewTabSectionId
 * @description 判断逻辑 tab section 是否为临时预览 section。
 * @param tabSectionId 逻辑 tab section id。
 * @returns 预览 section 返回 true。
 */
export function isPreviewTabSectionId(tabSectionId: string): boolean {
  return tabSectionId.startsWith(PREVIEW_TAB_SECTION_ID_PREFIX);
}

/**
 * @function createExampleSectionDraft
 * @description 创建示例 section 草稿。
 * @param id section 标识。
 * @param title section 标题。
 * @param role section 角色。
 * @param component section component 绑定。
 * @param resizableEdges section 可拖拽边缘配置。
 * @returns 示例 section 草稿。
 */
export function createExampleSectionDraft(
  id: string,
  title: string,
  role: ExampleSectionData["role"],
  component: ExampleSectionComponentBinding,
  resizableEdges?: SectionDraft<ExampleSectionLayoutData>["resizableEdges"],
): SectionDraft<ExampleSectionLayoutData> {
  return {
    id,
    title,
    data: {
      role,
      component,
    },
    resizableEdges,
  };
}

/**
 * @function createVsCodeExample
 * @description 通过布局 API 创建 VS Code 风格四栏布局示例。
 * @returns VS Code 风格布局树。
 */
export function createVsCodeExample(): SectionNode<ExampleSectionLayoutData> {
  let root = createRootSection(
    createExampleSectionDraft(
      "root",
      "VS Code Root",
      "root",
      createSectionComponentBinding("empty", {}),
    ),
  );

  root = splitSectionTree(root, "root", "horizontal", {
    ratio: 0.05,
    first: createExampleSectionDraft(
      "activity-bar",
      "Activity Bar",
      "activity-bar",
      createSectionComponentBinding("activity-bar", {
        barId: "primary-activity-bar",
      }),
      { right: false },
    ),
    second: createExampleSectionDraft(
      "workbench-rest",
      "Workbench",
      "container",
      createSectionComponentBinding("empty", {}),
    ),
  });

  root = splitSectionTree(root, "workbench-rest", "horizontal", {
    ratio: 0.22,
    first: createExampleSectionDraft(
      "left-sidebar",
      "Left Sidebar",
      "sidebar",
      createSectionComponentBinding("empty", {}),
    ),
    second: createExampleSectionDraft(
      "main-and-right",
      "Main Stack",
      "container",
      createSectionComponentBinding("empty", {}),
    ),
  });

  root = splitSectionTree(root, "main-and-right", "horizontal", {
    ratio: 0.74,
    first: createExampleSectionDraft(
      "card-section",
      "Main Tabs",
      "main",
      createSectionComponentBinding("tab-section", {
        tabSectionId: "main-tabs",
      }),
    ),
    second: createExampleSectionDraft(
      "right-sidebar",
      "Right Sidebar",
      "sidebar",
      createSectionComponentBinding("empty", {}),
    ),
  });

  return root;
}

/**
 * @function findTabSectionLeaf
 * @description 通过逻辑 tab section id 查找当前对应的 leaf section。
 * @param root 当前布局树。
 * @param tabSectionId 逻辑 tab section id。
 * @returns 命中的 leaf section；未命中时返回 null。
 */
export function findTabSectionLeaf(
  root: SectionNode<ExampleSectionLayoutData>,
  tabSectionId: string,
): SectionNode<ExampleSectionLayoutData> | null {
  const queue: SectionNode<ExampleSectionLayoutData>[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!current.split) {
      if (
        current.data.component.type === "tab-section" &&
        current.data.component.props.tabSectionId === tabSectionId
      ) {
        return current;
      }
      continue;
    }

    queue.push(current.split.children[0], current.split.children[1]);
  }

  return null;
}

/**
 * @function findTabSectionLeafContext
 * @description 查找 tab section leaf 及其父子关系，用于判断是否可折叠合并。
 * @param root 当前布局树。
 * @param tabSectionId 逻辑 tab section id。
 * @returns 命中的 leaf、父节点与 sibling；未命中时返回 null。
 */
export function findTabSectionLeafContext(
  root: SectionNode<ExampleSectionLayoutData>,
  tabSectionId: string,
): {
  leaf: SectionNode<ExampleSectionLayoutData>;
  parent: SectionNode<ExampleSectionLayoutData> | null;
  sibling: SectionNode<ExampleSectionLayoutData> | null;
} | null {
  const visit = (
    node: SectionNode<ExampleSectionLayoutData>,
    parent: SectionNode<ExampleSectionLayoutData> | null,
    sibling: SectionNode<ExampleSectionLayoutData> | null,
  ): {
    leaf: SectionNode<ExampleSectionLayoutData>;
    parent: SectionNode<ExampleSectionLayoutData> | null;
    sibling: SectionNode<ExampleSectionLayoutData> | null;
  } | null => {
    if (!node.split) {
      if (
        node.data.component.type === "tab-section" &&
        node.data.component.props.tabSectionId === tabSectionId
      ) {
        return {
          leaf: node,
          parent,
          sibling,
        };
      }

      return null;
    }

    return (
      visit(node.split.children[0], node, node.split.children[1]) ??
      visit(node.split.children[1], node, node.split.children[0])
    );
  };

  return visit(root, null, null);
}

/**
 * @function collectLeafTabSectionIds
 * @description 以布局顺序收集当前所有叶子 tab section id。
 * @param root 当前布局树。
 * @returns 叶子 tab section id 列表。
 */
export function collectLeafTabSectionIds(
  root: SectionNode<ExampleSectionLayoutData>,
): string[] {
  const queue: SectionNode<ExampleSectionLayoutData>[] = [root];
  const ids: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!current.split) {
      if (current.data.component.type === "tab-section") {
        ids.push(current.data.component.props.tabSectionId);
      }
      continue;
    }

    queue.push(current.split.children[0], current.split.children[1]);
  }

  return ids;
}

/**
 * @function promoteRootTabSectionIfNeeded
 * @description 当原 root tab section 被折叠移除后，将 root 标记转移给当前布局中的第一个 tab section。
 * @param root 当前布局树。
 * @param state 当前 tab section 状态。
 * @returns 补齐 root 标记后的状态。
 */
export function promoteRootTabSectionIfNeeded(
  root: SectionNode<ExampleSectionLayoutData>,
  state: TabSectionsState,
): TabSectionsState {
  const hasRoot = Object.values(state.sections).some((section) => section.isRoot);
  if (hasRoot) {
    return state;
  }

  const nextRootTabSectionId = collectLeafTabSectionIds(root)
    .find((tabSectionId) => Boolean(state.sections[tabSectionId])) ?? null;
  if (!nextRootTabSectionId) {
    return state;
  }

  return upsertTabSection(state, {
    ...state.sections[nextRootTabSectionId],
    isRoot: true,
  });
}

/**
 * @function buildSectionDraftFromLeaf
 * @description 基于现有 leaf section 构造子 section 草稿。
 * @param leaf 现有 leaf section。
 * @param nextId 新 section id。
 * @returns 子 section 草稿。
 */
export function buildSectionDraftFromLeaf(
  leaf: SectionNode<ExampleSectionLayoutData>,
  nextId: string,
): SectionDraft<ExampleSectionLayoutData> {
  return {
    id: nextId,
    title: leaf.title,
    data: leaf.data,
    resizableEdges: leaf.resizableEdges,
  };
}

/**
 * @function createEmptyTabSectionStateItem
 * @description 创建新的空 tab section 状态。
 * @param tabSectionId 新逻辑 tab section id。
 * @returns 空 tab section 状态。
 */
export function createEmptyTabSectionStateItem(tabSectionId: string): TabSectionStateItem {
  return {
    id: tabSectionId,
    tabs: [],
    focusedTabId: null,
    isRoot: false,
  };
}

/**
 * @function cleanupEmptyTabSections
 * @description 清理空 tab section，并在需要时销毁其承载的非保护 section。
 * @param root 当前布局树。
 * @param state 当前 tab section 状态。
 * @returns 清理后的布局树和 tab section 状态。
 */
export function cleanupEmptyTabSections(
  root: SectionNode<ExampleSectionLayoutData>,
  state: TabSectionsState,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: TabSectionsState;
} {
  let nextRoot = root;
  let nextState = state;

  while (true) {
    const emptySections = Object.values(nextState.sections)
      .filter((section) => section.tabs.length === 0)
      .map((section) => section.id);
    let changed = false;

    for (const tabSectionId of emptySections) {
      const tabSection = nextState.sections[tabSectionId];
      if (!tabSection) {
        continue;
      }

      const context = findTabSectionLeafContext(nextRoot, tabSectionId);
      if (!context) {
        const nextCandidateState = removeTabSection(nextState, tabSectionId);
        nextState = tabSection.isRoot
          ? promoteRootTabSectionIfNeeded(nextRoot, nextCandidateState)
          : nextCandidateState;
        changed = true;
        break;
      }

      const canCollapseProtectedRoot = Boolean(
        tabSection.isRoot &&
        context.parent,
      );
      if (tabSection.isRoot && !canCollapseProtectedRoot) {
        continue;
      }

      nextRoot = destroySectionTree(nextRoot, context.leaf.id);
      const nextCandidateState = removeTabSection(nextState, tabSectionId);
      nextState = tabSection.isRoot
        ? promoteRootTabSectionIfNeeded(nextRoot, nextCandidateState)
        : nextCandidateState;
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

/**
 * @function resolveSplitPlan
 * @description 根据 splitSide 生成 split 所需的方向与子区域顺序。
 * @param side 目标分区方位。
 * @returns 对应的方向、比例和原 section 所在顺序。
 */
export function resolveSplitPlan(side: TabSectionSplitSide): {
  direction: SectionSplitDirection;
  ratio: number;
  originalAt: "first" | "second";
} {
  if (side === "left") {
    return {
      direction: "horizontal",
      ratio: 0.5,
      originalAt: "second",
    };
  }

  if (side === "right") {
    return {
      direction: "horizontal",
      ratio: 0.5,
      originalAt: "first",
    };
  }

  if (side === "top") {
    return {
      direction: "vertical",
      ratio: 0.5,
      originalAt: "second",
    };
  }

  return {
    direction: "vertical",
    ratio: 0.5,
    originalAt: "first",
  };
}

/**
 * @function createPreviewIdentifiers
 * @description 基于 committed leaf 生成临时预览 ids。
 * @param anchorLeafSectionId committed leaf section id。
 * @returns 预览分区使用的稳定 ids。
 */
export function createPreviewIdentifiers(anchorLeafSectionId: string): {
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

/**
 * @function buildPreviewLayoutState
 * @description 基于当前拖拽 hover 目标构建非提交的预览布局。
 * @param root committed 布局树。
 * @param state committed tab section 状态。
 * @param session 当前拖拽会话。
 * @returns 预览布局；不需要预览时返回 null。
 */
export function buildPreviewLayoutState(
  root: SectionNode<ExampleSectionLayoutData>,
  state: TabSectionsState,
  session: TabSectionDragSession | null,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: TabSectionsState;
} | null {
  if (
    !session ||
    session.phase !== "dragging"
  ) {
    return null;
  }

  if (!session.hoverTarget || session.hoverTarget.area !== "content") {
    const sourceSection = state.sections[session.currentTabSectionId];
    if (!sourceSection || sourceSection.tabs.length !== 1) {
      return null;
    }

    const previewState = closeTabSectionTab(
      state,
      session.currentTabSectionId,
      session.tabId,
    );
    return cleanupEmptyTabSections(root, previewState);
  }

  if (!session.hoverTarget.splitSide) {
    if (session.hoverTarget.tabSectionId === session.currentTabSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.tabSectionId];
    if (!targetSection) {
      return null;
    }

    const mergedPreviewState = moveTabSectionTab(state, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: session.hoverTarget.tabSectionId,
      tabId: session.tabId,
      targetIndex: targetSection.tabs.length,
    });

    return cleanupEmptyTabSections(root, mergedPreviewState);
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.data.component.type !== "tab-section") {
    return null;
  }

  const previewIds = createPreviewIdentifiers(session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolveSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = createExampleSectionDraft(
    previewIds.newChildSectionId,
    session.title,
    targetLeaf.data.role,
    createSectionComponentBinding("tab-section", {
      tabSectionId: previewIds.tabSectionId,
    }),
  );

  const previewRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? {
          ratio: splitPlan.ratio,
          first: originalDraft,
          second: newDraft,
        }
      : {
          ratio: splitPlan.ratio,
          first: newDraft,
          second: originalDraft,
        },
  );

  let previewState = upsertTabSection(
    state,
    createEmptyTabSectionStateItem(previewIds.tabSectionId),
  );
  previewState = moveTabSectionTab(previewState, {
    sourceSectionId: session.currentTabSectionId,
    targetSectionId: previewIds.tabSectionId,
    tabId: session.tabId,
    targetIndex: 0,
  });

  const cleanedPreview = cleanupEmptyTabSections(previewRoot, previewState);
  return {
    root: cleanedPreview.root,
    state: cleanedPreview.state,
  };
}