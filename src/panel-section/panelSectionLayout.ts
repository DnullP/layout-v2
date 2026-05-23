/**
 * @module host/layout-v2/panel-section/panelSectionLayout
 * @description panel section 折叠时的 leaf 布局辅助逻辑。
 *   该模块负责把 panel content 的折叠状态同步到 section tree，
 *   让宿主在隐藏 panel content 的同时保留 sidebar 当前布局占位。
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
    SECTION_FIXED_SIZE_META_KEY,
    describeSectionPath,
    updateSectionMetadata,
    type SectionNode,
} from "../section/layoutModel";
import {
    focusPanelSectionPanel,
    setPanelSectionCollapsed,
    type PanelSectionsState,
} from "./panelSectionModel";

export const PANEL_SECTION_COLLAPSED_BAR_SIZE = 38;
export const PANEL_SECTION_COLLAPSED_RAIL_SIZE = 120;

/**
 * @function clearPanelSectionFixedSize
 * @description 清理旧版折叠逻辑写入的固定尺寸，保证折叠后仍维持当前 sidebar 占位。
 * @param root section tree 根节点。
 * @param leafSectionId 目标 leaf section id。
 * @returns 清理后的 section tree。
 */
export function clearPanelSectionFixedSize<T>(
    root: SectionNode<T>,
    leafSectionId: string,
): SectionNode<T> {
    return updateSectionMetadata(root, leafSectionId, (metadata) => {
        if (!(SECTION_FIXED_SIZE_META_KEY in metadata)) {
            return metadata;
        }

        const nextMetadata = { ...metadata };
        delete nextMetadata[SECTION_FIXED_SIZE_META_KEY];
        return nextMetadata;
    });
}

function getPanelSectionParentSplitDirection<T>(
    root: SectionNode<T>,
    leafSectionId: string,
): "horizontal" | "vertical" | null {
    const path = describeSectionPath(root, leafSectionId);
    if (path.length < 2) {
        return null;
    }

    return path[path.length - 2]?.split?.direction ?? null;
}

/**
 * @function applyPanelSectionCollapsedFixedSize
 * @description 同步 collapsed panel leaf 的固定尺寸。
 *   横向父 split 中的 sidebar 折叠时仍保留原有列宽，避免根侧栏收窄后丢失 resize 命中区；
 *   纵向父 split 中仍只保留 panel bar 高度，把竖向空间交还给 sibling section。
 * @param root section tree 根节点。
 * @param leafSectionId 目标 leaf section id。
 * @param isCollapsed 目标 panel section 是否折叠。
 * @returns 同步后的 section tree。
 */
export function applyPanelSectionCollapsedFixedSize<T>(
    root: SectionNode<T>,
    leafSectionId: string,
    isCollapsed: boolean,
): SectionNode<T> {
    if (!isCollapsed) {
        return clearPanelSectionFixedSize(root, leafSectionId);
    }

    const parentDirection = getPanelSectionParentSplitDirection(root, leafSectionId);
    if (!parentDirection) {
        return clearPanelSectionFixedSize(root, leafSectionId);
    }

    if (parentDirection === "horizontal") {
        return clearPanelSectionFixedSize(root, leafSectionId);
    }

    return updateSectionMetadata(root, leafSectionId, (metadata) => ({
        ...metadata,
        [SECTION_FIXED_SIZE_META_KEY]: PANEL_SECTION_COLLAPSED_BAR_SIZE,
    }));
}

/**
 * @function applyPanelSectionCollapsedLayout
 * @description 同步 panel section 的折叠状态，并按父 split 方向维护 collapsed leaf 尺寸。
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

    return {
        root: applyPanelSectionCollapsedFixedSize(root, params.leafSectionId, params.isCollapsed),
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
