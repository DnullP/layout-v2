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
} from "../src/vscode-layout/layoutModel";
import {
  createSectionComponentBinding,
  type SectionComponentBinding,
  type SectionComponentData,
} from "../src/vscode-layout/sectionComponent";
import {
  insertPanelSectionPanel,
  movePanelSectionPanel,
  removePanelSection,
  removePanelSectionPanel,
  upsertPanelSection,
  type PanelSectionsState,
  type PanelSectionStateItem,
  type PanelSectionPanelDefinition,
} from "../src/panel-section/panelSectionModel";
import {
  insertActivityBarIcon,
  type ActivityBarIconDefinition,
  type ActivityBarsState,
} from "../src/activity-bar/activityBarModel";
import { type PanelSectionDragSession, type PanelSectionHoverTarget, type PanelSectionSplitSide } from "../src/panel-section/panelSectionDrag";
import { type TabSectionDragSession, type TabSectionSplitSide } from "../src/tab-section/tabSectionDrag";
import {
  closeTabSectionTab,
  moveTabSectionTab,
  removeTabSection,
  upsertTabSection,
  type TabSectionsState,
  type TabSectionStateItem,
  type TabSectionTabDefinition,
} from "../src/tab-section/tabSectionModel";

/**
 * @interface ExampleSectionData
 * @description 示例 section 的最小数据结构。
 * @field role - section 角色标识。
 */
export interface ExampleSectionData {
  /** section 角色标识。 */
  role: "activity-bar" | "sidebar" | "main" | "panel" | "container" | "root";
}

/**
 * @type ExampleSectionComponentBinding
 * @description 示例页支持的 section component 绑定。
 */
export type ExampleSectionComponentBinding =
  | SectionComponentBinding<"empty", Record<string, never>>
  | SectionComponentBinding<"activity-bar", { barId: string }>
  | SectionComponentBinding<"tab-section", { tabSectionId: string }>
  | SectionComponentBinding<"panel-section", { panelSectionId: string }>;

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
    type: "welcome",
    payload: {
      headline: "Workspace overview",
      items: ["quick commands", "recent notes", "pinned context"],
    },
    content: "Workspace overview, quick commands, and recently touched notes.",
    tone: "blue",
  },
  {
    id: "tab-daily-notes",
    title: "Daily Notes",
    type: "notes",
    payload: {
      date: "Today",
      entries: ["Pinned notes", "Calendar tasks", "Current editing context"],
    },
    content: "Pinned notes, calendar-linked tasks, and the current editing context.",
    tone: "green",
  },
  {
    id: "tab-outline",
    title: "Outline",
    type: "outline",
    payload: {
      sections: ["Intro", "Methods", "Results", "Appendix"],
    },
    content: "Document structure, headings, backlinks, and semantic navigation helpers.",
    tone: "amber",
  },
  {
    id: "tab-review",
    title: "Review Queue",
    type: "review",
    payload: {
      owner: "Kai",
      pendingCount: 4,
    },
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
 * @constant DEFAULT_PANEL_CONTENT_SUFFIX
 * @description 从 activity icon 衍生 panel 内容时使用的默认描述模板。
 */
const DEFAULT_PANEL_CONTENT_SUFFIX = "Logs, diagnostics, and contextual tools for the active workspace surface.";

/**
 * @function isPreviewTabSectionId
 * @description 判断逻辑 tab section 是否为临时预览 section。
 * @param tabSectionId 逻辑 tab section id。
 * @returns 预览 section 返回 true。
 */
export function isPreviewTabSectionId(tabSectionId: string): boolean {
  return tabSectionId.startsWith(PREVIEW_TAB_SECTION_ID_PREFIX);
}

export function closeTabInLayoutState(
  root: SectionNode<ExampleSectionLayoutData>,
  state: TabSectionsState,
  sectionId: string,
  tabId: string,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: TabSectionsState;
} {
  const nextState = closeTabSectionTab(state, sectionId, tabId);
  return cleanupEmptyTabSections(root, nextState);
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

  // 第一步：先拆出窄 activity bar，后续工作区部分再独立组合。
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

  // 第二步：在中央工作区左侧挂上一个承载 panel section 的 sidebar。
  root = splitSectionTree(root, "workbench-rest", "horizontal", {
    ratio: 0.22,
    first: createExampleSectionDraft(
      "left-sidebar",
      "Left Sidebar",
      "sidebar",
      createSectionComponentBinding("panel-section", {
        panelSectionId: "left-panel",
      }),
    ),
    second: createExampleSectionDraft(
      "main-and-right",
      "Main Stack",
      "container",
      createSectionComponentBinding("empty", {}),
    ),
  });

  // 第三步：把剩余区域再拆成主 tab 工作区和右侧 panel section。
  root = splitSectionTree(root, "main-and-right", "horizontal", {
    ratio: 0.76,
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
      createSectionComponentBinding("panel-section", {
        panelSectionId: "right-panel",
      }),
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
 * @function findPanelSectionLeaf
 * @description 通过逻辑 panel section id 查找当前对应的 leaf section。
 * @param root 当前布局树。
 * @param panelSectionId 逻辑 panel section id。
 * @returns 命中的 leaf section；未命中时返回 null。
 */
export function findPanelSectionLeaf(
  root: SectionNode<ExampleSectionLayoutData>,
  panelSectionId: string,
): SectionNode<ExampleSectionLayoutData> | null {
  const queue: SectionNode<ExampleSectionLayoutData>[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!current.split) {
      if (
        current.data.component.type === "panel-section" &&
        current.data.component.props.panelSectionId === panelSectionId
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
 * @function findPanelSectionLeafContext
 * @description 查找 panel section leaf 及其父子关系，用于判断是否可折叠合并。
 * @param root 当前布局树。
 * @param panelSectionId 逻辑 panel section id。
 * @returns 命中的 leaf、父节点与 sibling；未命中时返回 null。
 */
export function findPanelSectionLeafContext(
  root: SectionNode<ExampleSectionLayoutData>,
  panelSectionId: string,
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
        node.data.component.type === "panel-section" &&
        node.data.component.props.panelSectionId === panelSectionId
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
 * @function collectLeafPanelSectionIds
 * @description 以布局顺序收集当前所有叶子 panel section id。
 * @param root 当前布局树。
 * @returns 叶子 panel section id 列表。
 */
export function collectLeafPanelSectionIds(
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
      if (current.data.component.type === "panel-section") {
        ids.push(current.data.component.props.panelSectionId);
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
 * @function promoteRootPanelSectionIfNeeded
 * @description 当原 root panel section 被折叠移除后，将 root 标记转移给当前布局中的第一个 panel section。
 * @param root 当前布局树。
 * @param state 当前 panel section 状态。
 * @returns 补齐 root 标记后的状态。
 */
export function promoteRootPanelSectionIfNeeded(
  root: SectionNode<ExampleSectionLayoutData>,
  state: PanelSectionsState,
): PanelSectionsState {
  const hasRoot = Object.values(state.sections).some((section) => section.isRoot);
  if (hasRoot) {
    return state;
  }

  const nextRootPanelSectionId = collectLeafPanelSectionIds(root)
    .find((panelSectionId) => Boolean(state.sections[panelSectionId])) ?? null;
  if (!nextRootPanelSectionId) {
    return state;
  }

  return upsertPanelSection(state, {
    ...state.sections[nextRootPanelSectionId],
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
 * @function createEmptyPanelSectionStateItem
 * @description 创建新的空 panel section 状态。
 * @param panelSectionId 新逻辑 panel section id。
 * @returns 空 panel section 状态。
 */
export function createEmptyPanelSectionStateItem(panelSectionId: string): PanelSectionStateItem {
  return {
    id: panelSectionId,
    panels: [],
    focusedPanelId: null,
    isCollapsed: false,
    isRoot: false,
  };
}

/**
 * @function createPanelFromActivityIcon
 * @description 将 activity icon 映射为 panel 定义。
 * @param icon activity icon 定义。
 * @returns panel 定义。
 */
export function createPanelFromActivityIcon(
  icon: ActivityBarIconDefinition,
): PanelSectionPanelDefinition {
  const tone = icon.id === "git"
    ? "green"
    : icon.id === "search"
      ? "amber"
      : icon.id === "extensions"
        ? "blue"
        : "neutral";

  // 在示例里，activity icon 被拖入 panel bar 后会展开成一个完整的 sidebar 工具 pane。
  return {
    id: `panel-${icon.id}`,
    label: icon.label,
    symbol: icon.symbol,
    content: `${icon.label} panel. ${DEFAULT_PANEL_CONTENT_SUFFIX}`,
    tone,
  };
}

/**
 * @function createActivityIconFromPanel
 * @description 将 panel 映射为 activity icon 定义。
 * @param panel panel 定义。
 * @returns activity icon 定义。
 */
export function createActivityIconFromPanel(
  panel: PanelSectionPanelDefinition,
): ActivityBarIconDefinition {
  // 反向映射保证示例中的 panel <-> activity 切换保持一致且容易理解。
  return {
    id: panel.id.startsWith("panel-") ? panel.id.slice("panel-".length) : panel.id,
    label: panel.label,
    symbol: panel.symbol,
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
 * @function cleanupEmptyPanelSections
 * @description 清理空 panel section，并在需要时销毁其承载的非保护 section。
 * @param root 当前布局树。
 * @param state 当前 panel section 状态。
 * @returns 清理后的布局树和 panel section 状态。
 */
export function cleanupEmptyPanelSections(
  root: SectionNode<ExampleSectionLayoutData>,
  state: PanelSectionsState,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: PanelSectionsState;
} {
  let nextRoot = root;
  let nextState = state;

  while (true) {
    const emptySections = Object.values(nextState.sections)
      .filter((section) => section.panels.length === 0)
      .map((section) => section.id);
    let changed = false;

    for (const panelSectionId of emptySections) {
      const panelSection = nextState.sections[panelSectionId];
      if (!panelSection) {
        continue;
      }

      const context = findPanelSectionLeafContext(nextRoot, panelSectionId);
      if (!context) {
        const nextCandidateState = removePanelSection(nextState, panelSectionId);
        nextState = panelSection.isRoot
          ? promoteRootPanelSectionIfNeeded(nextRoot, nextCandidateState)
          : nextCandidateState;
        changed = true;
        break;
      }

      const canCollapseProtectedRoot = Boolean(panelSection.isRoot && context.parent);
      if (panelSection.isRoot && !canCollapseProtectedRoot) {
        continue;
      }

      nextRoot = destroySectionTree(nextRoot, context.leaf.id);
      const nextCandidateState = removePanelSection(nextState, panelSectionId);
      nextState = panelSection.isRoot
        ? promoteRootPanelSectionIfNeeded(nextRoot, nextCandidateState)
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
 * @function resolvePanelSplitPlan
 * @description 根据 splitSide 生成 panel split 所需的方向与子区域顺序。
 * @param side 目标分区方位。
 * @returns 对应的方向、比例和原 section 所在顺序。
 */
export function resolvePanelSplitPlan(side: PanelSectionSplitSide): {
  direction: SectionSplitDirection;
  ratio: number;
  originalAt: "first" | "second";
} {
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

function collectAllSectionIds(root: SectionNode<ExampleSectionLayoutData>): Set<string> {
  const ids = new Set<string>();
  const queue: SectionNode<ExampleSectionLayoutData>[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
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

function createCommittedIdentifiers(
  root: SectionNode<ExampleSectionLayoutData>,
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

  if (!session.hoverTarget) {
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
  if (!targetLeaf || targetLeaf.split || targetLeaf.data.component.type !== "tab-section") {
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

export function buildCommittedTabLayoutState(
  root: SectionNode<ExampleSectionLayoutData>,
  state: TabSectionsState,
  session: TabSectionDragSession | null,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: TabSectionsState;
} | null {
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

    const mergedState = moveTabSectionTab(state, {
      sourceSectionId: session.currentTabSectionId,
      targetSectionId: session.hoverTarget.tabSectionId,
      tabId: session.tabId,
      targetIndex: targetSection.tabs.length,
    });

    return cleanupEmptyTabSections(root, mergedState);
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.split || targetLeaf.data.component.type !== "tab-section") {
    return null;
  }

  const committedIds = createCommittedIdentifiers(root, state, session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolveSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = createExampleSectionDraft(
    committedIds.newChildSectionId,
    session.title,
    targetLeaf.data.role,
    createSectionComponentBinding("tab-section", {
      tabSectionId: committedIds.tabSectionId,
    }),
  );

  const committedRoot = splitSectionTree(
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

  let committedState = upsertTabSection(
    state,
    createEmptyTabSectionStateItem(committedIds.tabSectionId),
  );
  committedState = moveTabSectionTab(committedState, {
    sourceSectionId: session.currentTabSectionId,
    targetSectionId: committedIds.tabSectionId,
    tabId: session.tabId,
    targetIndex: 0,
  });

  return cleanupEmptyTabSections(committedRoot, committedState);
}

/**
 * @function buildPanelPreviewLayoutState
 * @description 基于当前 panel 拖拽 hover 目标构建非提交的预览布局。
 * @param root committed 布局树。
 * @param state committed panel section 状态。
 * @param session 当前拖拽会话。
 * @returns 预览布局；不需要预览时返回 null。
 */
export function buildPanelPreviewLayoutState(
  root: SectionNode<ExampleSectionLayoutData>,
  state: PanelSectionsState,
  session: PanelSectionDragSession | null,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: PanelSectionsState;
} | null {
  if (!session || session.phase !== "dragging") {
    return null;
  }

  if (!session.hoverTarget || session.hoverTarget.area !== "content") {
    const sourceSection = state.sections[session.currentPanelSectionId];
    if (!sourceSection || sourceSection.panels.length !== 1) {
      return null;
    }

    const previewState = removePanelSectionPanel(
      state,
      session.currentPanelSectionId,
      session.panelId,
    );
    return cleanupEmptyPanelSections(root, previewState);
  }

  if (!session.hoverTarget.splitSide) {
    if (session.hoverTarget.panelSectionId === session.currentPanelSectionId) {
      return null;
    }

    const targetSection = state.sections[session.hoverTarget.panelSectionId];
    if (!targetSection) {
      return null;
    }

    const mergedPreviewState = movePanelSectionPanel(state, {
      sourceSectionId: session.currentPanelSectionId,
      targetSectionId: session.hoverTarget.panelSectionId,
      panelId: session.panelId,
      targetIndex: targetSection.panels.length,
    });

    return cleanupEmptyPanelSections(root, mergedPreviewState);
  }

  if (!session.hoverTarget.anchorLeafSectionId) {
    return null;
  }

  const targetLeaf = findSectionNode(root, session.hoverTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.data.component.type !== "panel-section") {
    return null;
  }

  const previewIds = createPreviewIdentifiers(session.hoverTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelSplitPlan(session.hoverTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = createExampleSectionDraft(
    previewIds.newChildSectionId,
    session.label,
    "panel",
    createSectionComponentBinding("panel-section", {
      panelSectionId: previewIds.tabSectionId,
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

  let previewState = upsertPanelSection(
    state,
    createEmptyPanelSectionStateItem(previewIds.tabSectionId),
  );
  previewState = movePanelSectionPanel(previewState, {
    sourceSectionId: session.currentPanelSectionId,
    targetSectionId: previewIds.tabSectionId,
    panelId: session.panelId,
    targetIndex: 0,
  });

  const cleanedPreview = cleanupEmptyPanelSections(previewRoot, previewState);
  return {
    root: cleanedPreview.root,
    state: cleanedPreview.state,
  };
}

/**
 * @function buildActivityToPanelPreviewState
 * @description 基于 activity icon 拖拽到 panel bar 的目标，构建 panel 状态预览。
 * @param state committed panel section 状态。
 * @param icon 当前被拖拽的 activity icon。
 * @param panelSectionId 目标 panel section id。
 * @param targetIndex 目标插入位置。
 * @returns 预览后的 panel section 状态；不需要预览时返回 null。
 */
export function buildActivityToPanelPreviewState(
  state: PanelSectionsState,
  icon: ActivityBarIconDefinition | null,
  panelSectionId: string | null,
  targetIndex: number | null,
): PanelSectionsState | null {
  if (!icon || !panelSectionId || targetIndex === null) {
    return null;
  }

  return insertPanelSectionPanel(
    state,
    panelSectionId,
    createPanelFromActivityIcon(icon),
    targetIndex,
  );
}

/**
 * @function buildPanelToActivityPreviewState
 * @description 基于 panel 拖拽到 activity bar 的目标，构建 activity 状态预览。
 * @param state committed activity bar 状态。
 * @param panel 当前被拖拽的 panel。
 * @param barId 目标 activity bar id。
 * @param targetIndex 目标插入位置。
 * @returns 预览后的 activity 状态；不需要预览时返回 null。
 */
export function buildPanelToActivityPreviewState(
  state: ActivityBarsState,
  panel: PanelSectionPanelDefinition | null,
  barId: string | null,
  targetIndex: number | null,
): ActivityBarsState | null {
  if (!panel || !barId || targetIndex === null) {
    return null;
  }

  return insertActivityBarIcon(
    state,
    barId,
    createActivityIconFromPanel(panel),
    targetIndex,
  );
}

/**
 * @function buildActivityToContentPreviewState
 * @description 基于 activity icon 拖拽到 panel content 区域的目标，构建 split 预览布局。
 * @param root committed 布局树。
 * @param state committed panel section 状态。
 * @param contentTarget 当前 hover target。
 * @param icon 被拖拽的 activity icon。
 * @returns 预览布局；不需要预览时返回 null。
 */
export function buildActivityToContentPreviewState(
  root: SectionNode<ExampleSectionLayoutData>,
  state: PanelSectionsState,
  contentTarget: PanelSectionHoverTarget | null,
  icon: ActivityBarIconDefinition | null,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: PanelSectionsState;
} | null {
  if (!contentTarget || contentTarget.area !== "content" || !contentTarget.splitSide || !contentTarget.anchorLeafSectionId || !icon) {
    return null;
  }

  const targetLeaf = findSectionNode(root, contentTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.data.component.type !== "panel-section") {
    return null;
  }

  const previewIds = createPreviewIdentifiers(contentTarget.anchorLeafSectionId);
  const splitPlan = resolvePanelSplitPlan(contentTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, previewIds.originalChildSectionId);
  const newDraft = createExampleSectionDraft(
    previewIds.newChildSectionId,
    icon.label,
    "panel",
    createSectionComponentBinding("panel-section", {
      panelSectionId: previewIds.tabSectionId,
    }),
  );

  const previewRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  const previewState = upsertPanelSection(
    state,
    createEmptyPanelSectionStateItem(previewIds.tabSectionId),
  );

  return { root: previewRoot, state: previewState };
}

/**
 * @function commitActivityToContentDrop
 * @description 提交 activity icon → content area split。
 * @param root committed 布局树。
 * @param state committed panel section 状态。
 * @param contentTarget hover target。
 * @param icon 被拖拽的 icon。
 * @returns 提交后的布局和新 panel section id；无需提交时返回 null。
 */
export function commitActivityToContentDrop(
  root: SectionNode<ExampleSectionLayoutData>,
  state: PanelSectionsState,
  contentTarget: PanelSectionHoverTarget | null,
  icon: ActivityBarIconDefinition | null,
): {
  root: SectionNode<ExampleSectionLayoutData>;
  state: PanelSectionsState;
  newPanelSectionId: string;
} | null {
  if (!contentTarget || contentTarget.area !== "content" || !contentTarget.splitSide || !contentTarget.anchorLeafSectionId || !icon) {
    return null;
  }

  const targetLeaf = findSectionNode(root, contentTarget.anchorLeafSectionId);
  if (!targetLeaf || targetLeaf.data.component.type !== "panel-section") {
    return null;
  }

  const usedSectionIds = collectAllSectionIds(root);
  const usedPanelSectionIds = new Set(Object.keys(state.sections));
  const committedIds = {
    panelSectionId: createUniqueIdentifier(`${contentTarget.anchorLeafSectionId}-panels`, usedPanelSectionIds),
    originalChildSectionId: createUniqueIdentifier(`${contentTarget.anchorLeafSectionId}-section`, usedSectionIds),
    newChildSectionId: createUniqueIdentifier(`${contentTarget.anchorLeafSectionId}-split`, usedSectionIds),
  };
  const splitPlan = resolvePanelSplitPlan(contentTarget.splitSide);
  const originalDraft = buildSectionDraftFromLeaf(targetLeaf, committedIds.originalChildSectionId);
  const newDraft = createExampleSectionDraft(
    committedIds.newChildSectionId,
    icon.label,
    "panel",
    createSectionComponentBinding("panel-section", {
      panelSectionId: committedIds.panelSectionId,
    }),
  );

  const committedRoot = splitSectionTree(
    root,
    targetLeaf.id,
    splitPlan.direction,
    splitPlan.originalAt === "first"
      ? { ratio: splitPlan.ratio, first: originalDraft, second: newDraft }
      : { ratio: splitPlan.ratio, first: newDraft, second: originalDraft },
  );

  let committedState = upsertPanelSection(
    state,
    createEmptyPanelSectionStateItem(committedIds.panelSectionId),
  );

  // Insert the activity icon as a panel in the new section
  committedState = insertPanelSectionPanel(
    committedState,
    committedIds.panelSectionId,
    createPanelFromActivityIcon(icon),
    0,
  );

  return {
    root: committedRoot,
    state: committedState,
    newPanelSectionId: committedIds.panelSectionId,
  };
}