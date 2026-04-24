/**
 * @module host/layout-v2/panel-section/panelSectionLayout
 * @description panel section 折叠时的 leaf 布局辅助逻辑。
 *   该模块负责把 panel content 的折叠状态同步到 section tree，
 *   让宿主在保留 panel bar 可交互入口的同时，真正回收 content 占据的布局空间。
 * @dependencies
 *   - ../section/layoutModel
 *   - ./panelSectionModel
 *
 * @example
 *   const next = applyPanelSectionCollapsedLayout(root, panelSections, {
 *     leafSectionId: "right-sidebar",
 *     panelSectionId: "right-panel",
 *     isCollapsed: true,
 *   });
 */

import {
    describeSectionPath,
    SECTION_FIXED_SIZE_META_KEY,
    updateSectionMetadata,
    type SectionNode,
    type SectionSplitDirection,
} from "../section/layoutModel";
import {
    focusPanelSectionPanel,
    setPanelSectionCollapsed,
    type PanelSectionsState,
} from "./panelSectionModel";

const PANEL_SECTION_COLLAPSED_BAR_HEIGHT_PX = 48;
const PANEL_SECTION_COLLAPSED_BAR_PADDING_X_PX = 20;
const PANEL_SECTION_COLLAPSED_PANEL_SLOT_PX = 30;
const PANEL_SECTION_COLLAPSED_PANEL_GAP_PX = 6;
const PANEL_SECTION_COLLAPSED_BAR_TOGGLE_GAP_PX = 8;
const PANEL_SECTION_COLLAPSED_TOGGLE_PX = 28;

/**
 * @function resolvePanelSectionParentSplitDirection
 * @description 解析指定 leaf section 的父 split 方向。
 * @param root section tree 根节点。
 * @param leafSectionId 目标 leaf section id。
 * @returns 父 split 方向；如果目标没有父 split，则返回 null。
 */
export function resolvePanelSectionParentSplitDirection<T>(
    root: SectionNode<T>,
    leafSectionId: string,
): SectionSplitDirection | null {
    const path = describeSectionPath(root, leafSectionId);
    const parent = path.length >= 2 ? path[path.length - 2] : null;
    return parent?.split?.direction ?? null;
}

/**
 * @function resolvePanelSectionCollapsedFixedSize
 * @description 根据父 split 方向，计算 panel section 折叠后的 bar-only 固定尺寸。
 * @param panelCount 当前 panel 数量。
 * @param parentSplitDirection 父 split 方向。
 * @returns 折叠后的固定尺寸；如果没有父 split，则返回 null。
 */
export function resolvePanelSectionCollapsedFixedSize(
    panelCount: number,
    parentSplitDirection: SectionSplitDirection | null,
): number | null {
    if (parentSplitDirection === "vertical") {
        return PANEL_SECTION_COLLAPSED_BAR_HEIGHT_PX;
    }

    if (parentSplitDirection === "horizontal") {
        const visiblePanelCount = Math.max(1, panelCount);
        return (
            PANEL_SECTION_COLLAPSED_BAR_PADDING_X_PX +
            PANEL_SECTION_COLLAPSED_TOGGLE_PX +
            PANEL_SECTION_COLLAPSED_BAR_TOGGLE_GAP_PX +
            visiblePanelCount * PANEL_SECTION_COLLAPSED_PANEL_SLOT_PX +
            Math.max(0, visiblePanelCount - 1) * PANEL_SECTION_COLLAPSED_PANEL_GAP_PX
        );
    }

    return null;
}

/**
 * @function applyPanelSectionCollapsedLayout
 * @description 同步 panel section 的折叠状态和 leaf 固定尺寸，让 section tree 真正回收空间。
 * @param root section tree 根节点。
 * @param state panel sections 状态。
 * @param params 目标 leaf/panelSection 以及折叠状态。
 * @returns 更新后的 root 与 panel section 状态。
 */
export function applyPanelSectionCollapsedLayout<T>(
    root: SectionNode<T>,
    state: PanelSectionsState,
    params: {
        leafSectionId: string;
        panelSectionId: string;
        isCollapsed: boolean;
    },
): {
    root: SectionNode<T>;
    state: PanelSectionsState;
} {
    const section = state.sections[params.panelSectionId] ?? null;
    if (!section) {
        return { root, state };
    }

    const parentSplitDirection = resolvePanelSectionParentSplitDirection(root, params.leafSectionId);
    const collapsedFixedSize = params.isCollapsed
        ? resolvePanelSectionCollapsedFixedSize(section.panels.length, parentSplitDirection)
        : null;
    const nextRoot = updateSectionMetadata(root, params.leafSectionId, (metadata) => {
        if (collapsedFixedSize == null) {
            if (!(SECTION_FIXED_SIZE_META_KEY in metadata)) {
                return metadata;
            }

            const nextMetadata = { ...metadata };
            delete nextMetadata[SECTION_FIXED_SIZE_META_KEY];
            return nextMetadata;
        }

        return {
            ...metadata,
            [SECTION_FIXED_SIZE_META_KEY]: collapsedFixedSize,
        };
    });

    return {
        root: nextRoot,
        state: setPanelSectionCollapsed(state, params.panelSectionId, params.isCollapsed),
    };
}

/**
 * @function focusPanelSectionWithLayout
 * @description 聚焦 panel 时同步清理折叠布局，保证通过 panel bar 可恢复内容区。
 * @param root section tree 根节点。
 * @param state panel sections 状态。
 * @param params 目标 leaf/panelSection 以及 panel id。
 * @returns 更新后的 root 与 panel section 状态。
 */
export function focusPanelSectionWithLayout<T>(
    root: SectionNode<T>,
    state: PanelSectionsState,
    params: {
        leafSectionId: string;
        panelSectionId: string;
        panelId: string;
    },
): {
    root: SectionNode<T>;
    state: PanelSectionsState;
} {
    const focusedState = focusPanelSectionPanel(state, params.panelSectionId, params.panelId);
    return applyPanelSectionCollapsedLayout(root, focusedState, {
        leafSectionId: params.leafSectionId,
        panelSectionId: params.panelSectionId,
        isCollapsed: false,
    });
}