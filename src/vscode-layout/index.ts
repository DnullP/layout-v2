/**
 * @module host/layout-v2/vscode-layout
 * @description VSCode 风格布局引擎公共入口。
 *   该入口建立在底层 section 模块之上，并组合 activity / panel / tab 能力。
 *
 *   高层 API（推荐）：
 *     import { VSCodeWorkbench } from "layout-v2";
 *
 *   中层 API（需自定义布局拓扑时）：
 *     import { createVSCodeLayoutStore, SectionLayoutView, ... } from "layout-v2";
 */

// --- 高层 API：声明式 Workbench ---
export { VSCodeWorkbench } from "./VSCodeWorkbench";
export type { VSCodeWorkbenchProps } from "./VSCodeWorkbench";
export type {
    WorkbenchActivityDefinition,
    WorkbenchPanelDefinition,
    WorkbenchTabDefinition,
    WorkbenchTabApi,
    WorkbenchPanelContext,
    WorkbenchApi,
    WorkbenchSidebarState,
} from "./workbenchTypes";
export {
    createWorkbenchLayoutState,
    createWorkbenchRootLayout,
    buildWorkbenchActivityBars,
    buildWorkbenchPanelSections,
    buildWorkbenchTabs,
    readWorkbenchTabPayload,
    WORKBENCH_MAIN_TAB_SECTION_ID,
    WORKBENCH_LEFT_ACTIVITY_BAR_ID,
    WORKBENCH_RIGHT_ACTIVITY_BAR_ID,
    WORKBENCH_LEFT_PANEL_SECTION_ID,
    WORKBENCH_RIGHT_PANEL_SECTION_ID,
    type WorkbenchSectionData,
    type WorkbenchSectionRole,
    type WorkbenchTabPayload,
    type CreateWorkbenchLayoutOptions,
} from "./workbenchPreset";

// --- 中层 API：Store / Section / 组件 ---
export * from "../section";
export * from "../hostMetadata";
export * from "./store";
export * from "./focusBridge";
export * from "./renderAdapters";
export * from "./tabWorkbench";
export * from "./panelWorkbench";
export * from "../activity-bar/activityBarModel";
export * from "../activity-bar/activityBarDrag";
export * from "../activity-bar/useActivityBarState";
export * from "../activity-bar/ActivityBar";
export * from "../activity-bar/ActivityBarIcon";
export * from "../activity-bar/ActivityBarDragPreview";
export * from "../panel-section/panelSectionModel";
export * from "../panel-section/panelSectionDrag";
export * from "../panel-section/usePanelSectionState";
export * from "../panel-section/PanelSection";
export * from "../panel-section/PanelSectionDragPreview";
export * from "../tab-section/tabSectionModel";
export * from "../tab-section/tabSectionDrag";
export * from "../tab-section/TabSectionDragPreview";
export * from "../tab-section/useTabSectionState";
export * from "../tab-section/TabSection";