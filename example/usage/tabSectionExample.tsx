/**
 * @module host/layout-v2/example/usage/tabSectionExample
 * @description TabSection 组件和 tab section 状态创建示例。
 */

import { type ReactNode } from "react";
import {
    TabSection,
    type TabSectionContentRendererRegistry,
} from "../../src/tab-section/TabSection";
import { createTabSectionsState, type TabSectionsState } from "../../src/tab-section/tabSectionModel";
import { useTabSectionState } from "../../src/tab-section/useTabSectionState";
import {
    TAB_TYPE_METRICS,
    TAB_TYPE_REVIEW,
    TAB_TYPE_WELCOME,
    createTabDefinitionExamples,
    type MetricsTabPayload,
    type ReviewTabPayload,
    type WelcomeTabPayload,
} from "./tabDefinitionExample";

/**
 * @description tab 内容渲染注册表示例。
 *   外部应用可以按 tab.type 注册完全不同的 React 渲染逻辑。
 */
export const tabContentRegistryExample: TabSectionContentRendererRegistry = {
    [TAB_TYPE_WELCOME]: (tab) => {
        const payload = tab.payload as WelcomeTabPayload | undefined;
        return (
            <div>
                <div>{payload?.headline ?? tab.title}</div>
                <ul>
                    {(payload?.items ?? []).map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </div>
        );
    },
    [TAB_TYPE_REVIEW]: (tab) => {
        const payload = tab.payload as ReviewTabPayload | undefined;
        return (
            <div>
                <div>{`Owner: ${payload?.owner ?? "Unknown"}`}</div>
                <div>{`Pending: ${payload?.pendingCount ?? 0}`}</div>
            </div>
        );
    },
    [TAB_TYPE_METRICS]: (tab) => {
        const payload = tab.payload as MetricsTabPayload | undefined;
        return (
            <div>
                <div>Quality Score: {payload?.score ?? 0}</div>
                <div>Trend: {payload?.trend ?? "flat"}</div>
            </div>
        );
    },
};

/**
 * @function createTabSectionExampleState
 * @description 创建一个带两张 tab 的 tab section 示例状态。
 * @returns tab section 状态。
 */
export function createTabSectionExampleState(): TabSectionsState {
    const tabs = createTabDefinitionExamples();

    return createTabSectionsState([
        {
            id: "main-tabs",
            tabs,
            focusedTabId: tabs[0]?.id ?? null,
            isRoot: true,
        },
    ]);
}

/**
 * @function TabSectionUsageExample
 * @description 演示如何渲染一个可聚焦、可关闭、可拖拽的 TabSection。
 * @returns TabSection React 示例。
 */
export function TabSectionUsageExample(): ReactNode {
    const tabSections = useTabSectionState({
        initialState: createTabSectionExampleState(),
    });

    return (
        <TabSection
            leafSectionId="main-leaf"
            committedLeafSectionId="main-leaf"
            tabSectionId="main-tabs"
            tabSection={tabSections.getSection("main-tabs")}
            contentRegistry={tabContentRegistryExample}
            onFocusTab={(tabId) => tabSections.focusTab("main-tabs", tabId)}
            onCloseTab={(tabId) => tabSections.closeTab("main-tabs", tabId)}
            onMoveTab={(move) => tabSections.moveTab(move)}
        />
    );
}