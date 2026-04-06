/**
 * @module host/layout-v2
 * @description layout-v2 对外导出入口。
 * @dependencies
 *   - ./section
 *   - ./activity
 *   - ./panel
 *   - ./tab
 *   - ./vscode-layout
 *
 * @example
 *   import { SectionLayoutView, ActivityBar, createVSCodeLayoutStore } from "layout-v2";
 *
 * @exports
 *   - 布局引擎的分模块公共导出入口
 */

export * from "./section";
export * from "./activity";
export * from "./panel";
export * from "./tab";
export * from "./vscode-layout";