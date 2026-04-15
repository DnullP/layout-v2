/**
 * @module host/layout-v2/vscode-layout/workbenchTypes
 * @description VSCodeWorkbench 高层 API 的类型定义。
 *   这些类型面向消费方，屏蔽底层 section tree / store / registry 的实现细节。
 */

import type { ReactNode } from "react";

/**
 * 声明式 activity 定义。
 * 消费方只需描述"有哪些 activity"，由 workbench 自动映射到 activity bar 状态。
 */
export interface WorkbenchActivityDefinition {
    /** activity 唯一 ID。 */
    id: string;
    /** 显示标签。 */
    label: string;
    /** 放置在左/右 activity bar。 */
    bar: "left" | "right";
    /** activity bar 内的排列区域。 */
    section?: "top" | "bottom";
    /** 点击行为：focus 切换侧边栏面板，action 触发回调。 */
    activationMode?: "focus" | "action";
    /** 渲染 icon 的 ReactNode。 */
    icon?: ReactNode;
}

/**
 * 声明式 panel 定义。
 * 描述侧边栏中的面板。一个 activity 可对应多个 panel。
 */
export interface WorkbenchPanelDefinition {
    /** panel 唯一 ID。 */
    id: string;
    /** 显示标签。 */
    label: string;
    /** 所属 activity 的 ID。 */
    activityId: string;
    /** 放置在左/右侧边栏。 */
    position: "left" | "right";
    /** 排列顺序权重。 */
    order?: number;
}

/**
 * Tab 定义。
 */
export interface WorkbenchTabDefinition {
    /** tab 唯一 ID。 */
    id: string;
    /** tab 显示标题。 */
    title: string;
    /** 对应的 tab component ID。 */
    component: string;
    /** 传递给 tab component 的参数。 */
    params?: Record<string, unknown>;
}

/**
 * Tab component 的 API 接口，由 workbench 提供给 tab 渲染器。
 */
export interface WorkbenchTabApi {
    id: string;
    close: () => void;
    setActive: () => void;
}

/**
 * Panel 渲染上下文，由 workbench 提供给 panel 渲染器。
 */
export interface WorkbenchPanelContext {
    /** 当前活跃 tab 的 ID。 */
    activeTabId: string | null;
    /** 当前 panel 的 ID。 */
    hostPanelId: string | null;
    /** 打开一个 tab。 */
    openTab: (tab: WorkbenchTabDefinition) => void;
    /** 关闭一个 tab。 */
    closeTab: (tabId: string) => void;
    /** 激活一个 tab。 */
    setActiveTab: (tabId: string) => void;
    /** 激活一个 panel。 */
    activatePanel: (panelId: string) => void;
}

/**
 * Workbench 对外暴露的命令式 API。
 * 通过 ref 获取。
 */
export interface WorkbenchApi {
    /** 打开 tab（复用或新增）。 */
    openTab: (tab: WorkbenchTabDefinition) => void;
    /** 关闭 tab。 */
    closeTab: (tabId: string) => void;
    /** 设置活跃 tab。 */
    setActiveTab: (tabId: string) => void;
    /** 激活指定 panel。 */
    activatePanel: (panelId: string) => void;
    /** 获取指定 tab 的信息。 */
    getTab: (tabId: string) => { id: string; params: Record<string, unknown> } | null;
    /** 获取所有 tab 的信息列表。 */
    getTabs: () => Array<{ id: string; params: Record<string, unknown> }>;
    /** 设置左侧边栏可见性。 */
    setLeftSidebarVisible: (visible: boolean) => void;
    /** 设置右侧边栏可见性。 */
    setRightSidebarVisible: (visible: boolean) => void;
}

/**
 * 侧边栏状态快照。
 * 消费方可通过 onSidebarStateChange 持久化，并在下次启动时通过 initialSidebarState 恢复。
 */
export interface WorkbenchSidebarState {
    left: {
        visible: boolean;
        activeActivityId: string | null;
        activePanelId: string | null;
    };
    right: {
        visible: boolean;
        activeActivityId: string | null;
        activePanelId: string | null;
    };
}
