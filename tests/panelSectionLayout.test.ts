import { describe, expect, test } from "bun:test";
import {
    applyPanelSectionCollapsedLayout,
    focusPanelSectionWithLayout,
    PANEL_SECTION_COLLAPSED_BAR_SIZE,
} from "../src/panel-section/panelSectionLayout";
import {
    createPanelSectionsState,
    createRootSection,
    createSectionComponentBinding,
    findSectionNode,
    splitSectionTree,
    type SectionComponentData,
    type SectionDraft,
} from "../src";

interface TestBindingData extends SectionComponentData {
    role: "root" | "sidebar" | "container";
}

/**
 * @function createDraft
 * @description 创建测试用 section draft。
 * @param id section id。
 * @param title section 标题。
 * @param role section 角色。
 * @param component section 组件绑定。
 * @returns 测试用 section draft。
 */
function createDraft(
    id: string,
    title: string,
    role: TestBindingData["role"],
    component: TestBindingData["component"],
    meta?: SectionDraft<TestBindingData>["meta"],
): SectionDraft<TestBindingData> {
    return {
        id,
        title,
        data: {
            role,
            component,
        },
        meta,
    };
}

describe("panelSectionLayout", () => {
    test("横向父 split 中折叠 panel section 时应保留 sidebar 宽度并清理旧 fixed size", () => {
        let root = createRootSection<TestBindingData>(
            createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
        );

        root = splitSectionTree(root, "root", "horizontal", {
            first: createDraft(
                "sidebar-leaf",
                "Sidebar",
                "sidebar",
                createSectionComponentBinding("panel-section", { panelSectionId: "sidebar-panels" }),
                { "layout-v2:fixedSize": 240 },
            ),
            second: createDraft(
                "main-leaf",
                "Main",
                "container",
                createSectionComponentBinding("empty", {}),
            ),
        });

        const state = createPanelSectionsState([
            {
                id: "sidebar-panels",
                panels: [
                    { id: "outline", label: "Outline", symbol: "O", content: "Outline pane" },
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                ],
                focusedPanelId: "outline",
                isCollapsed: false,
            },
        ]);

        const collapsed = applyPanelSectionCollapsedLayout(root, state, {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            isCollapsed: true,
        });

        const collapsedLeaf = findSectionNode(collapsed.root, "sidebar-leaf");
        expect(collapsed.state.sections["sidebar-panels"]?.isCollapsed).toBe(true);
        expect(collapsedLeaf?.meta?.["layout-v2:fixedSize"]).toBeUndefined();
        expect(findSectionNode(collapsed.root, "main-leaf")).toBeTruthy();

        const expanded = applyPanelSectionCollapsedLayout(collapsed.root, collapsed.state, {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            isCollapsed: false,
        });

        const expandedLeaf = findSectionNode(expanded.root, "sidebar-leaf");
        expect(expanded.state.sections["sidebar-panels"]?.isCollapsed).toBe(false);
        expect(expandedLeaf?.meta?.["layout-v2:fixedSize"]).toBeUndefined();
    });

    test("纵向父 split 中折叠 panel section 时应只保留 strip 高度", () => {
        let root = createRootSection<TestBindingData>(
            createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
        );

        root = splitSectionTree(root, "root", "vertical", {
            first: createDraft(
                "top-sidebar-leaf",
                "Top Sidebar",
                "sidebar",
                createSectionComponentBinding("panel-section", { panelSectionId: "top-panels" }),
                { "layout-v2:fixedSize": 240 },
            ),
            second: createDraft(
                "bottom-sidebar-leaf",
                "Bottom Sidebar",
                "sidebar",
                createSectionComponentBinding("panel-section", { panelSectionId: "bottom-panels" }),
            ),
        });

        const state = createPanelSectionsState([
            {
                id: "top-panels",
                panels: [
                    { id: "outline", label: "Outline", symbol: "O", content: "Outline pane" },
                ],
                focusedPanelId: "outline",
                isCollapsed: false,
            },
            {
                id: "bottom-panels",
                panels: [
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                ],
                focusedPanelId: "problems",
                isCollapsed: false,
            },
        ]);

        const collapsed = applyPanelSectionCollapsedLayout(root, state, {
            leafSectionId: "top-sidebar-leaf",
            panelSectionId: "top-panels",
            isCollapsed: true,
        });

        const collapsedLeaf = findSectionNode(collapsed.root, "top-sidebar-leaf");
        expect(collapsed.state.sections["top-panels"]?.isCollapsed).toBe(true);
        expect(collapsedLeaf?.meta?.["layout-v2:fixedSize"]).toBe(PANEL_SECTION_COLLAPSED_BAR_SIZE);

        const expanded = applyPanelSectionCollapsedLayout(collapsed.root, collapsed.state, {
            leafSectionId: "top-sidebar-leaf",
            panelSectionId: "top-panels",
            isCollapsed: false,
        });

        const expandedLeaf = findSectionNode(expanded.root, "top-sidebar-leaf");
        expect(expanded.state.sections["top-panels"]?.isCollapsed).toBe(false);
        expect(expandedLeaf?.meta?.["layout-v2:fixedSize"]).toBeUndefined();
    });

    test("通过 panel bar focus 恢复内容时应同步清理 fixed size", () => {
        let root = createRootSection<TestBindingData>(
            createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
        );

        root = splitSectionTree(root, "root", "horizontal", {
            first: createDraft(
                "sidebar-leaf",
                "Sidebar",
                "sidebar",
                createSectionComponentBinding("panel-section", { panelSectionId: "sidebar-panels" }),
                { "layout-v2:fixedSize": 122 },
            ),
            second: createDraft(
                "main-leaf",
                "Main",
                "container",
                createSectionComponentBinding("empty", {}),
            ),
        });

        const collapsed = applyPanelSectionCollapsedLayout(root, createPanelSectionsState([
            {
                id: "sidebar-panels",
                panels: [
                    { id: "outline", label: "Outline", symbol: "O", content: "Outline pane" },
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                ],
                focusedPanelId: "outline",
                isCollapsed: false,
            },
        ]), {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            isCollapsed: true,
        });

        const focused = focusPanelSectionWithLayout(collapsed.root, collapsed.state, {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            panelId: "problems",
        });

        const leaf = findSectionNode(focused.root, "sidebar-leaf");
        expect(focused.state.sections["sidebar-panels"]?.focusedPanelId).toBe("problems");
        expect(focused.state.sections["sidebar-panels"]?.isCollapsed).toBe(false);
        expect(leaf?.meta?.["layout-v2:fixedSize"]).toBeUndefined();
    });
});
