/**
 * @module host/layout-v2/vscode-layout
 * @description VSCode 风格布局引擎公共入口。
 *   该入口建立在底层 section 模块之上，并组合 activity / panel / tab 能力。
 */

export * from "../section";
export * from "./store";
export * from "../activity-bar/activityBarModel";
export * from "../activity-bar/activityBarDrag";
export * from "../activity-bar/useActivityBarState";
export * from "../activity-bar/ActivityBar";
export * from "../activity-bar/ActivityBarIcon";
export * from "../panel-section/panelSectionModel";
export * from "../panel-section/panelSectionDrag";
export * from "../panel-section/usePanelSectionState";
export * from "../panel-section/PanelSection";
export * from "../tab-section/tabSectionModel";
export * from "../tab-section/tabSectionDrag";
export * from "../tab-section/TabSectionDragPreview";
export * from "../tab-section/useTabSectionState";
export * from "../tab-section/TabSection";