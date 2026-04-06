/**
 * @module host/layout-v2/tab-section/tabSectionModel
 * @description tab section 的纯状态模型与状态转换函数。
 *   该模块只处理 tab、card、focus 与跨 section 移动，
 *   不依赖 React，可直接用于测试与不同宿主。
 * @dependencies
 *   - none
 *
 * @example
 *   let state = createTabSectionsState([
 *     {
 *       id: "main-tabs",
 *       tabs: [
 *         { id: "welcome", title: "Welcome", content: "Welcome card" },
 *       ],
 *       focusedTabId: "welcome",
 *     },
 *   ]);
 *   state = moveTabSectionTab(state, {
 *     sourceSectionId: "main-tabs",
 *     targetSectionId: "main-tabs",
 *     tabId: "welcome",
 *     targetIndex: 0,
 *   });
 *
 * @exports
 *   - TabSectionTabDefinition  tab/card 定义
 *   - TabSectionStateItem      单个 tab section 状态
 *   - TabSectionsState         所有 tab section 状态
 *   - TabSectionTabMove        tab 移动参数
 *   - createTabSectionsState   创建状态
 *   - getTabSectionById        查找 section
 *   - focusTabSectionTab       切换 focus
 *   - closeTabSectionTab       关闭 tab
 *   - upsertTabSection         写入/更新 section
 *   - removeTabSection         删除 section
 *   - moveTabSectionTab        同栏/跨栏移动 tab
 *   - findTabInSectionsState   在所有 section 中查找 tab
 */

/**
 * @interface TabSectionTabDefinition
 * @description tab 及其对应 card 的定义。
 * @field id       - tab/card 唯一标识。
 * @field title    - tab 文本。
 * @field content  - card 主体内容。
 * @field tone     - card 的视觉语义色。
 */
export interface TabSectionTabDefinition {
  /** tab/card 唯一标识。 */
  id: string;
  /** tab 文本。 */
  title: string;
  /** card 主体内容。 */
  content: string;
  /** card 的视觉语义色。 */
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}

/**
 * @interface TabSectionStateItem
 * @description 单个 tab section 的状态。
 * @field id           - section 逻辑标识。
 * @field tabs         - 当前 tab 顺序。
 * @field focusedTabId - 当前 focus 的 tab。
 * @field isRoot       - 是否为 root tab section；root 清空后不自动销毁。
 */
export interface TabSectionStateItem {
  /** section 逻辑标识。 */
  id: string;
  /** 当前 tab 顺序。 */
  tabs: TabSectionTabDefinition[];
  /** 当前 focus 的 tab。 */
  focusedTabId: string | null;
  /** 是否为 root tab section；root 清空后不自动销毁。 */
  isRoot?: boolean;
}

/**
 * @interface TabSectionsState
 * @description 所有 tab section 的状态集合。
 * @field sections - 以 section id 为键的状态表。
 */
export interface TabSectionsState {
  /** 以 section id 为键的状态表。 */
  sections: Record<string, TabSectionStateItem>;
}

/**
 * @interface TabSectionTabMove
 * @description tab 移动参数。
 * @field sourceSectionId - 源 section。
 * @field targetSectionId - 目标 section。
 * @field tabId           - 被移动的 tab。
 * @field targetIndex     - 目标插入位置。
 */
export interface TabSectionTabMove {
  /** 源 section。 */
  sourceSectionId: string;
  /** 目标 section。 */
  targetSectionId: string;
  /** 被移动的 tab。 */
  tabId: string;
  /** 目标插入位置。 */
  targetIndex: number;
}

/**
 * @function createTabSectionsState
 * @description 基于初始 section 列表创建 tab section 状态。
 * @param sections 初始 section 列表。
 * @returns tab section 状态。
 */
export function createTabSectionsState(sections: TabSectionStateItem[]): TabSectionsState {
  return {
    sections: Object.fromEntries(sections.map((section) => [section.id, section])),
  };
}

/**
 * @function getTabSectionById
 * @description 根据 id 获取 tab section。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @returns 命中的 section；未命中时返回 null。
 */
export function getTabSectionById(
  state: TabSectionsState,
  sectionId: string,
): TabSectionStateItem | null {
  return state.sections[sectionId] ?? null;
}

/**
 * @function findTabInSectionsState
 * @description 在所有 section 中查找指定 tab。
 * @param state 全部状态。
 * @param tabId tab 标识。
 * @returns 命中的 section 与 tab；未命中时返回 null。
 */
export function findTabInSectionsState(
  state: TabSectionsState,
  tabId: string,
): { section: TabSectionStateItem; tab: TabSectionTabDefinition } | null {
  const sections = Object.values(state.sections);
  for (const section of sections) {
    const tab = section.tabs.find((item) => item.id === tabId);
    if (tab) {
      return {
        section,
        tab,
      };
    }
  }

  return null;
}

/**
 * @function focusTabSectionTab
 * @description 切换指定 section 的 focus tab。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @param tabId 目标 tab 标识。
 * @returns 更新后的状态。
 */
export function focusTabSectionTab(
  state: TabSectionsState,
  sectionId: string,
  tabId: string,
): TabSectionsState {
  const section = getTabSectionById(state, sectionId);
  if (!section || !section.tabs.some((tab) => tab.id === tabId)) {
    return state;
  }

  return {
    sections: {
      ...state.sections,
      [sectionId]: {
        ...section,
        focusedTabId: tabId,
      },
    },
  };
}

/**
 * @function resolveNextFocusedTabId
 * @description 计算关闭 tab 后新的 focus。
 * @param tabs 剩余 tabs。
 * @param removedIndex 被移除 tab 的原索引。
 * @returns 新 focus 的 tab id；无 tab 时返回 null。
 */
function resolveNextFocusedTabId(
  tabs: TabSectionTabDefinition[],
  removedIndex: number,
): string | null {
  if (tabs.length === 0) {
    return null;
  }

  const fallbackIndex = Math.max(0, Math.min(removedIndex, tabs.length - 1));
  return tabs[fallbackIndex]?.id ?? null;
}

/**
 * @function closeTabSectionTab
 * @description 关闭指定 section 中的 tab。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @param tabId 目标 tab 标识。
 * @returns 更新后的状态。
 */
export function closeTabSectionTab(
  state: TabSectionsState,
  sectionId: string,
  tabId: string,
): TabSectionsState {
  const section = getTabSectionById(state, sectionId);
  if (!section) {
    return state;
  }

  const removedIndex = section.tabs.findIndex((tab) => tab.id === tabId);
  if (removedIndex < 0) {
    return state;
  }

  const nextTabs = section.tabs.filter((tab) => tab.id !== tabId);
  const nextFocusedTabId = section.focusedTabId === tabId
    ? resolveNextFocusedTabId(nextTabs, removedIndex)
    : section.focusedTabId;

  return {
    sections: {
      ...state.sections,
      [sectionId]: {
        ...section,
        tabs: nextTabs,
        focusedTabId: nextFocusedTabId,
      },
    },
  };
}

/**
 * @function upsertTabSection
 * @description 写入或更新一个 tab section。
 * @param state 全部状态。
 * @param section 待写入的 section。
 * @returns 更新后的状态。
 */
export function upsertTabSection(
  state: TabSectionsState,
  section: TabSectionStateItem,
): TabSectionsState {
  return {
    sections: {
      ...state.sections,
      [section.id]: section,
    },
  };
}

/**
 * @function removeTabSection
 * @description 删除一个 tab section。
 * @param state 全部状态。
 * @param sectionId 待删除 section 标识。
 * @returns 更新后的状态。
 */
export function removeTabSection(
  state: TabSectionsState,
  sectionId: string,
): TabSectionsState {
  if (!state.sections[sectionId]) {
    return state;
  }

  const nextSections = { ...state.sections };
  delete nextSections[sectionId];
  return {
    sections: nextSections,
  };
}

/**
 * @function clampTargetIndex
 * @description 约束目标插入位置到合法范围。
 * @param targetIndex 候选索引。
 * @param listLength 列表长度。
 * @returns 约束后的索引。
 */
function clampTargetIndex(targetIndex: number, listLength: number): number {
  return Math.max(0, Math.min(targetIndex, listLength));
}

/**
 * @function moveTabSectionTab
 * @description 在同栏或跨 section 移动 tab。
 * @param state 全部状态。
 * @param move 移动参数。
 * @returns 更新后的状态。
 */
export function moveTabSectionTab(
  state: TabSectionsState,
  move: TabSectionTabMove,
): TabSectionsState {
  const sourceSection = getTabSectionById(state, move.sourceSectionId);
  const targetSection = getTabSectionById(state, move.targetSectionId);
  if (!sourceSection || !targetSection) {
    return state;
  }

  const sourceIndex = sourceSection.tabs.findIndex((tab) => tab.id === move.tabId);
  if (sourceIndex < 0) {
    return state;
  }

  const movingTab = sourceSection.tabs[sourceIndex];
  const nextSourceTabs = sourceSection.tabs.filter((tab) => tab.id !== move.tabId);

  if (move.sourceSectionId === move.targetSectionId) {
    const nextTargetIndex = clampTargetIndex(move.targetIndex, nextSourceTabs.length);
    if (sourceIndex === nextTargetIndex) {
      return state;
    }

    const reorderedTabs = [...nextSourceTabs];
    reorderedTabs.splice(nextTargetIndex, 0, movingTab);
    return {
      sections: {
        ...state.sections,
        [sourceSection.id]: {
          ...sourceSection,
          tabs: reorderedTabs,
          focusedTabId: movingTab.id,
        },
      },
    };
  }

  const nextTargetTabs = [...targetSection.tabs];
  const nextTargetIndex = clampTargetIndex(move.targetIndex, nextTargetTabs.length);
  nextTargetTabs.splice(nextTargetIndex, 0, movingTab);

  return {
    sections: {
      ...state.sections,
      [sourceSection.id]: {
        ...sourceSection,
        tabs: nextSourceTabs,
        focusedTabId:
          sourceSection.focusedTabId === movingTab.id
            ? resolveNextFocusedTabId(nextSourceTabs, sourceIndex)
            : sourceSection.focusedTabId,
      },
      [targetSection.id]: {
        ...targetSection,
        tabs: nextTargetTabs,
        focusedTabId: movingTab.id,
      },
    },
  };
}