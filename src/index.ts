/**
 * @module host/layout-v2
 * @description layout-v2 对外导出入口。
 * @dependencies
 *   - ./layoutModel
 *   - ./useSectionLayout
 *   - ./SectionLayoutView
 *   - ./sectionComponent
 *   - ./LayoutV2Examples
 *
 * @example
 *   import { SectionLayoutView, useSectionLayout } from "layout-v2";
 *
 * @exports
 *   - layout-v2 的所有公共模型、hook、视图与示例入口
 */

export * from "./layoutModel";
export * from "./layoutV2ExampleMode";
export * from "./exampleLayoutState";
export * from "./useSectionLayout";
export * from "./SectionLayoutView";
export * from "./sectionComponent";
export * from "./activity-bar/activityBarModel";
export * from "./activity-bar/useActivityBarState";
export * from "./activity-bar/ActivityBar";
export * from "./activity-bar/ActivityBarIcon";
export * from "./tab-section/tabSectionModel";
export * from "./tab-section/useTabSectionState";
export * from "./tab-section/TabSection";
export * from "./LayoutV2Examples";