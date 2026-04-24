/**
 * @module host/layout-v2/example/usage/sectionTreeExample
 * @description section 树创建示例。
 *   这个文件演示如何从根节点开始创建布局，
 *   再逐步拆出 sidebar 和主工作区。
 */

import {
    createRootSection,
    SECTION_SPLIT_HORIZONTAL,
    splitSectionTree,
    updateSectionTree,
    type SectionNode,
} from "../../src/section/layoutModel";
import {
    createSectionComponentBinding,
    type SectionComponentBinding,
    type SectionComponentData,
} from "../../src/section/sectionComponent";

export type SectionTreeExampleBinding =
    | SectionComponentBinding<"empty", Record<string, never>>
    | SectionComponentBinding<"activity-bar", { barId: string }>
    | SectionComponentBinding<"tab-section", { tabSectionId: string }>
    | SectionComponentBinding<"panel-section", { panelSectionId: string }>;

export interface SectionTreeExampleData extends SectionComponentData<SectionTreeExampleBinding> {
    role: "root" | "activity-bar" | "sidebar" | "main" | "container" | "panel";
}

/**
 * @function createSectionTreeExample
 * @description 创建一个最小可用的 section 树示例。
 * @returns 带左侧 sidebar、主工作区和右侧 sidebar 的布局树。
 */
export function createSectionTreeExample(): SectionNode<SectionTreeExampleData> {
    let root = createRootSection<SectionTreeExampleData>({
        id: "root",
        title: "Root",
        data: {
            role: "root",
            component: createSectionComponentBinding("empty", {}),
        },
    });

    // 先把根布局切成 activity bar 和右侧工作区，体现 ActivityBar 也是一个 section component。
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
            resizableEdges: {
                right: false,
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

    // 再把工作区切成左侧 panel section 和中间工作区容器。
    root = splitSectionTree(root, "workbench", SECTION_SPLIT_HORIZONTAL, {
        ratio: 0.22,
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
            id: "main-stack",
            title: "Main Stack",
            data: {
                role: "container",
                component: createSectionComponentBinding("empty", {}),
            },
        },
    });

    // 最后把中间工作区再切成主 tab section 和右侧 panel section。
    root = splitSectionTree(root, "main-stack", SECTION_SPLIT_HORIZONTAL, {
        ratio: 0.78,
        first: {
            id: "main-workspace",
            title: "Main Workspace",
            data: {
                role: "main",
                component: createSectionComponentBinding("tab-section", {
                    tabSectionId: "main-tabs",
                }),
            },
        },
        second: {
            id: "right-sidebar",
            title: "Right Sidebar",
            data: {
                role: "sidebar",
                component: createSectionComponentBinding("panel-section", {
                    panelSectionId: "right-panel",
                }),
            },
        },
    });

    // 最后演示如何更新某个 section 的标题或业务数据。
    return updateSectionTree(root, "main-workspace", (section) => ({
        ...section,
        title: "Main Editor Workspace",
    }));
}

/** 直接导出的静态示例，适合在文档或调试器中查看结构。 */
export const sectionTreeExample = createSectionTreeExample();