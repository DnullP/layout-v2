/**
 * @module host/layout-v2/example/usage/panelSectionExample
 * @description PanelSection 组件和 panel section 状态创建示例。
 */

import { type ReactNode } from "react";
import { PanelSection } from "../../src/panel-section/PanelSection";
import {
    createPanelSectionsState,
    type PanelSectionPanelDefinition,
    type PanelSectionsState,
} from "../../src/panel-section/panelSectionModel";
import { usePanelSectionState } from "../../src/panel-section/usePanelSectionState";

/** 左侧 sidebar 中常见的 panel 定义示例。 */
export const panelSectionExamplePanels: PanelSectionPanelDefinition[] = [
    {
        id: "panel-explorer",
        label: "Explorer",
        symbol: "E",
        content: "显示项目文件树、收藏目录和最近打开记录。",
        activationMode: "action",
        tone: "blue",
    },
    {
        id: "panel-search",
        label: "Search",
        symbol: "S",
        content: "显示全文检索结果、筛选项和命中上下文。",
        activationMode: "action",
        tone: "amber",
    },
];

export const rightPanelSectionExamplePanels: PanelSectionPanelDefinition[] = [
    {
        id: "panel-outline",
        label: "Outline",
        symbol: "O",
        content: "显示当前文档结构、折叠节点和语义导航入口。",
        tone: "amber",
    },
    {
        id: "panel-problems",
        label: "Problems",
        symbol: "!",
        content: "显示诊断信息、错误列表和快速跳转入口。",
        tone: "red",
    },
];

/**
 * @function createPanelSectionExampleState
 * @description 创建一个 panel section 示例状态。
 * @returns panel section 状态。
 */
export function createPanelSectionExampleState(): PanelSectionsState {
    return createPanelSectionsState([
        {
            id: "left-panel",
            panels: panelSectionExamplePanels,
            focusedPanelId: panelSectionExamplePanels[0]?.id ?? null,
            isCollapsed: false,
            isRoot: true,
        },
        {
            id: "right-panel",
            panels: rightPanelSectionExamplePanels,
            focusedPanelId: rightPanelSectionExamplePanels[0]?.id ?? null,
            isCollapsed: false,
            isRoot: false,
        },
    ]);
}

/**
 * @function PanelSectionUsageExample
 * @description 演示如何渲染一个可折叠、可重排、可互拖的 PanelSection。
 * @returns PanelSection React 示例。
 */
export function PanelSectionUsageExample(): ReactNode {
    const panelSections = usePanelSectionState({
        initialState: createPanelSectionExampleState(),
    });

    return (
        <PanelSection
            leafSectionId="left-sidebar-leaf"
            committedLeafSectionId="left-sidebar-leaf"
            panelSectionId="left-panel"
            panelSection={panelSections.getSection("left-panel")}
            onActivatePanel={() => {}}
            onFocusPanel={(panelId) => panelSections.focusPanel("left-panel", panelId)}
            onToggleCollapsed={() => {
                const current = panelSections.getSection("left-panel");
                if (!current) {
                    return;
                }

                panelSections.setCollapsed("left-panel", !current.isCollapsed);
            }}
            onMovePanel={(move) => panelSections.movePanel(move)}
        />
    );
}