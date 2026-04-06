/**
 * @module host/layout-v2/panel-section/panelSectionModel
 * @description panel section 的纯状态模型与状态转换函数。
 *   该模块负责 panel 的 focus、展开收起与跨 section 移动，
 *   不依赖 React，可直接用于测试与不同宿主。
 * @dependencies
 *   - none
 */

/**
 * @interface PanelSectionPanelDefinition
 * @description panel 定义。
 * @field id      - panel 唯一标识。
 * @field label   - panel 文本。
 * @field symbol  - panel 图标符号。
 * @field content - pane 内容。
 * @field tone    - pane 视觉语义色。
 */
export interface PanelSectionPanelDefinition {
    /** panel 唯一标识。 */
    id: string;
    /** panel 文本。 */
    label: string;
    /** panel 图标符号。 */
    symbol: string;
    /** pane 内容。 */
    content: string;
    /** 点击后是切换 focus 还是仅触发外部动作。 */
    activationMode?: "focus" | "action";
    /** pane 视觉语义色。 */
    tone?: "neutral" | "blue" | "green" | "amber" | "red";
}

/**
 * @interface PanelSectionStateItem
 * @description 单个 panel section 的状态。
 * @field id             - section 逻辑标识。
 * @field panels         - 当前 panel 顺序。
 * @field focusedPanelId - 当前 focus 的 panel。
 * @field isCollapsed    - pane content 是否折叠。
 * @field isRoot         - 是否为 root panel section；root 清空后不自动销毁。
 */
export interface PanelSectionStateItem {
    /** section 逻辑标识。 */
    id: string;
    /** 当前 panel 顺序。 */
    panels: PanelSectionPanelDefinition[];
    /** 当前 focus 的 panel。 */
    focusedPanelId: string | null;
    /** pane content 是否折叠。 */
    isCollapsed: boolean;
    /** 是否为 root panel section；root 清空后不自动销毁。 */
    isRoot?: boolean;
}

/**
 * @interface PanelSectionsState
 * @description 所有 panel section 的状态集合。
 * @field sections - 以 section id 为键的状态表。
 */
export interface PanelSectionsState {
    /** 以 section id 为键的状态表。 */
    sections: Record<string, PanelSectionStateItem>;
}

/**
 * @interface PanelSectionPanelMove
 * @description panel 移动参数。
 * @field sourceSectionId - 源 section。
 * @field targetSectionId - 目标 section。
 * @field panelId         - 被移动的 panel。
 * @field targetIndex     - 目标插入位置。
 */
export interface PanelSectionPanelMove {
    /** 源 section。 */
    sourceSectionId: string;
    /** 目标 section。 */
    targetSectionId: string;
    /** 被移动的 panel。 */
    panelId: string;
    /** 目标插入位置。 */
    targetIndex: number;
}

/**
 * @function createPanelSectionsState
 * @description 基于初始 section 列表创建 panel section 状态。
 * @param sections 初始 section 列表。
 * @returns panel section 状态。
 */
export function createPanelSectionsState(sections: PanelSectionStateItem[]): PanelSectionsState {
    return {
        sections: Object.fromEntries(sections.map((section) => [section.id, section])),
    };
}

/**
 * @function getPanelSectionById
 * @description 根据 id 获取 panel section。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @returns 命中的 section；未命中时返回 null。
 */
export function getPanelSectionById(
    state: PanelSectionsState,
    sectionId: string,
): PanelSectionStateItem | null {
    return state.sections[sectionId] ?? null;
}

/**
 * @function findPanelInSectionsState
 * @description 在所有 section 中查找指定 panel。
 * @param state 全部状态。
 * @param panelId panel 标识。
 * @returns 命中的 section 与 panel；未命中时返回 null。
 */
export function findPanelInSectionsState(
    state: PanelSectionsState,
    panelId: string,
): { section: PanelSectionStateItem; panel: PanelSectionPanelDefinition } | null {
    const sections = Object.values(state.sections);
    for (const section of sections) {
        const panel = section.panels.find((item) => item.id === panelId);
        if (panel) {
            return {
                section,
                panel,
            };
        }
    }

    return null;
}

/**
 * @function focusPanelSectionPanel
 * @description 切换指定 section 的 focus panel。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @param panelId 目标 panel 标识。
 * @returns 更新后的状态。
 */
export function focusPanelSectionPanel(
    state: PanelSectionsState,
    sectionId: string,
    panelId: string,
): PanelSectionsState {
    const section = getPanelSectionById(state, sectionId);
    if (!section || !section.panels.some((panel) => panel.id === panelId)) {
        return state;
    }

    return {
        sections: {
            ...state.sections,
            [sectionId]: {
                ...section,
                focusedPanelId: panelId,
                isCollapsed: false,
            },
        },
    };
}

/**
 * @function setPanelSectionCollapsed
 * @description 设置指定 section 的折叠状态。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @param isCollapsed 目标折叠状态。
 * @returns 更新后的状态。
 */
export function setPanelSectionCollapsed(
    state: PanelSectionsState,
    sectionId: string,
    isCollapsed: boolean,
): PanelSectionsState {
    const section = getPanelSectionById(state, sectionId);
    if (!section || section.isCollapsed === isCollapsed) {
        return state;
    }

    return {
        sections: {
            ...state.sections,
            [sectionId]: {
                ...section,
                isCollapsed,
            },
        },
    };
}

/**
 * @function resolveNextFocusedPanelId
 * @description 计算移除 panel 后新的 focus。
 * @param panels 剩余 panels。
 * @param removedIndex 被移除 panel 的原索引。
 * @returns 新 focus 的 panel id；无 panel 时返回 null。
 */
function resolveNextFocusedPanelId(
    panels: PanelSectionPanelDefinition[],
    removedIndex: number,
): string | null {
    if (panels.length === 0) {
        return null;
    }

    const fallbackIndex = Math.max(0, Math.min(removedIndex, panels.length - 1));
    return panels[fallbackIndex]?.id ?? null;
}

/**
 * @function removePanelSectionPanel
 * @description 从指定 section 中移除 panel。
 * @param state 全部状态。
 * @param sectionId section 标识。
 * @param panelId 目标 panel 标识。
 * @returns 更新后的状态。
 */
export function removePanelSectionPanel(
    state: PanelSectionsState,
    sectionId: string,
    panelId: string,
): PanelSectionsState {
    const section = getPanelSectionById(state, sectionId);
    if (!section) {
        return state;
    }

    const removedIndex = section.panels.findIndex((panel) => panel.id === panelId);
    if (removedIndex < 0) {
        return state;
    }

    const nextPanels = section.panels.filter((panel) => panel.id !== panelId);
    const nextFocusedPanelId = section.focusedPanelId === panelId
        ? resolveNextFocusedPanelId(nextPanels, removedIndex)
        : section.focusedPanelId;

    return {
        sections: {
            ...state.sections,
            [sectionId]: {
                ...section,
                panels: nextPanels,
                focusedPanelId: nextFocusedPanelId,
            },
        },
    };
}

/**
 * @function upsertPanelSection
 * @description 写入或更新一个 panel section。
 * @param state 全部状态。
 * @param section 待写入的 section。
 * @returns 更新后的状态。
 */
export function upsertPanelSection(
    state: PanelSectionsState,
    section: PanelSectionStateItem,
): PanelSectionsState {
    return {
        sections: {
            ...state.sections,
            [section.id]: section,
        },
    };
}

/**
 * @function removePanelSection
 * @description 删除一个 panel section。
 * @param state 全部状态。
 * @param sectionId 待删除 section 标识。
 * @returns 更新后的状态。
 */
export function removePanelSection(
    state: PanelSectionsState,
    sectionId: string,
): PanelSectionsState {
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
 * @function insertPanelSectionPanel
 * @description 向指定 section 插入一个 panel。
 * @param state 全部状态。
 * @param sectionId 目标 section。
 * @param panel 待插入 panel。
 * @param targetIndex 目标插入位置。
 * @returns 更新后的状态。
 */
export function insertPanelSectionPanel(
    state: PanelSectionsState,
    sectionId: string,
    panel: PanelSectionPanelDefinition,
    targetIndex: number,
): PanelSectionsState {
    const section = getPanelSectionById(state, sectionId);
    if (!section) {
        return state;
    }

    const nextPanels = [...section.panels.filter((item) => item.id !== panel.id)];
    const nextTargetIndex = clampTargetIndex(targetIndex, nextPanels.length);
    nextPanels.splice(nextTargetIndex, 0, panel);

    return {
        sections: {
            ...state.sections,
            [sectionId]: {
                ...section,
                panels: nextPanels,
                focusedPanelId: panel.id,
                isCollapsed: false,
            },
        },
    };
}

/**
 * @function movePanelSectionPanel
 * @description 在同栏或跨 section 移动 panel。
 * @param state 全部状态。
 * @param move 移动参数。
 * @returns 更新后的状态。
 */
export function movePanelSectionPanel(
    state: PanelSectionsState,
    move: PanelSectionPanelMove,
): PanelSectionsState {
    const sourceSection = getPanelSectionById(state, move.sourceSectionId);
    const targetSection = getPanelSectionById(state, move.targetSectionId);
    if (!sourceSection || !targetSection) {
        return state;
    }

    const sourceIndex = sourceSection.panels.findIndex((panel) => panel.id === move.panelId);
    if (sourceIndex < 0) {
        return state;
    }

    const movingPanel = sourceSection.panels[sourceIndex];
    const nextSourcePanels = sourceSection.panels.filter((panel) => panel.id !== move.panelId);

    if (move.sourceSectionId === move.targetSectionId) {
        const nextTargetIndex = clampTargetIndex(move.targetIndex, nextSourcePanels.length);
        if (sourceIndex === nextTargetIndex) {
            return state;
        }

        const reorderedPanels = [...nextSourcePanels];
        reorderedPanels.splice(nextTargetIndex, 0, movingPanel);
        return {
            sections: {
                ...state.sections,
                [sourceSection.id]: {
                    ...sourceSection,
                    panels: reorderedPanels,
                    focusedPanelId: movingPanel.id,
                    isCollapsed: false,
                },
            },
        };
    }

    const nextTargetPanels = [...targetSection.panels];
    const nextTargetIndex = clampTargetIndex(move.targetIndex, nextTargetPanels.length);
    nextTargetPanels.splice(nextTargetIndex, 0, movingPanel);

    return {
        sections: {
            ...state.sections,
            [sourceSection.id]: {
                ...sourceSection,
                panels: nextSourcePanels,
                focusedPanelId:
                    sourceSection.focusedPanelId === movingPanel.id
                        ? resolveNextFocusedPanelId(nextSourcePanels, sourceIndex)
                        : sourceSection.focusedPanelId,
            },
            [targetSection.id]: {
                ...targetSection,
                panels: nextTargetPanels,
                focusedPanelId: movingPanel.id,
                isCollapsed: false,
            },
        },
    };
}