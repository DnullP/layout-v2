/**
 * @module host/layout-v2/example/usage/layoutStoreExample
 * @description vscode-layout store 的创建和更新示例。
 */

import {
    createRootSection,
    SECTION_SPLIT_HORIZONTAL,
    splitSectionTree,
    updateSectionTree,
    type SectionNode,
} from "../../src/vscode-layout/layoutModel";
import {
    createSectionComponentBinding,
    type SectionComponentBinding,
    type SectionComponentData,
} from "../../src/vscode-layout/sectionComponent";
import {
    createVSCodeLayoutState,
    createVSCodeLayoutStore,
    type VSCodeLayoutStore,
} from "../../src/vscode-layout/store";
import { selectActivityBarIcon } from "../../src/activity-bar/activityBarModel";
import { createActivityBarExampleState } from "./activityBarExample";
import { createPanelSectionExampleState } from "./panelSectionExample";
import { createTabSectionExampleState } from "./tabSectionExample";

type LayoutStoreExampleBinding =
    | SectionComponentBinding<"empty", Record<string, never>>
    | SectionComponentBinding<"activity-bar", { barId: string }>
    | SectionComponentBinding<"panel-section", { panelSectionId: string }>
    | SectionComponentBinding<"tab-section", { tabSectionId: string }>;

interface LayoutStoreExampleData extends SectionComponentData<LayoutStoreExampleBinding> {
    role: "root" | "activity-bar" | "sidebar" | "main" | "container";
}

function createLayoutStoreExampleRoot(): SectionNode<LayoutStoreExampleData> {
    let root = createRootSection<LayoutStoreExampleData>({
        id: "root",
        title: "Root",
        data: {
            role: "root",
            component: createSectionComponentBinding("empty", {}),
        },
    });

    root = splitSectionTree(root, "root", SECTION_SPLIT_HORIZONTAL, {
        ratio: 0.08,
        first: {
            id: "activity-bar",
            title: "Activity Bar",
            data: {
                role: "activity-bar",
                component: createSectionComponentBinding("activity-bar", {
                    barId: "primary-activity-bar",
                }),
            },
        },
        second: {
            id: "workbench",
            title: "Workbench",
            data: {
                role: "container",
                component: createSectionComponentBinding("empty", {}),
            },
        },
    });

    root = splitSectionTree(root, "workbench", SECTION_SPLIT_HORIZONTAL, {
        ratio: 0.24,
        first: {
            id: "left-sidebar",
            title: "Left Sidebar",
            data: {
                role: "sidebar",
                component: createSectionComponentBinding("panel-section", {
                    panelSectionId: "left-panel",
                }),
            },
        },
        second: {
            id: "main",
            title: "Main",
            data: {
                role: "main",
                component: createSectionComponentBinding("tab-section", {
                    tabSectionId: "main-tabs",
                }),
            },
        },
    });

    return root;
}

/**
 * @function createLayoutStoreUsageExample
 * @description 创建一个完整的 store 示例，便于外部应用直接照着接。
 * @returns layout store 实例。
 */
export function createLayoutStoreUsageExample(): VSCodeLayoutStore<LayoutStoreExampleData> {
    return createVSCodeLayoutStore({
        initialState: createVSCodeLayoutState({
            root: createLayoutStoreExampleRoot(),
            activityBars: createActivityBarExampleState(),
            tabSections: createTabSectionExampleState(),
            panelSections: createPanelSectionExampleState(),
        }),
    });
}

/** 可以直接在控制台或测试里复用的 store 示例。 */
export const layoutStoreUsageExample = createLayoutStoreUsageExample();

/**
 * @function activateSearchSidebarExample
 * @description 演示如何通过 store 原子更新，同时切换 activity icon 和左侧 panel section。
 * @param store 目标 store。
 */
export function activateSearchSidebarExample(
    store: VSCodeLayoutStore<LayoutStoreExampleData>,
): void {
    store.updateState((state) => ({
        ...state,
        activityBars: selectActivityBarIcon(state.activityBars, "primary-activity-bar", "search"),
        root: updateSectionTree(state.root, "left-sidebar", (section) => ({
            ...section,
            data: {
                ...section.data,
                component: createSectionComponentBinding("panel-section", {
                    panelSectionId: "left-panel",
                }),
            },
        })),
    }));
}