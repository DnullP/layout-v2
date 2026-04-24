import { describe, expect, test } from "bun:test";
import {
    applyPanelSectionCollapsedLayout,
    focusPanelSectionWithLayout,
    resolvePanelSectionCollapsedFixedSize,
    resolvePanelSectionParentSplitDirection,
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
): SectionDraft<TestBindingData> {
    return {
        id,
        title,
        data: {
            role,
            component,
        },
    };
}

describe("panelSectionLayout", () => {
    test("应根据父 split 方向解析折叠固定尺寸", () => {
        expect(resolvePanelSectionCollapsedFixedSize(2, "horizontal")).toBe(122);
        expect(resolvePanelSectionCollapsedFixedSize(2, "vertical")).toBe(48);
        expect(resolvePanelSectionCollapsedFixedSize(2, null)).toBeNull();
    });

    test("折叠 panel section 时应给 leaf 写入 bar-only fixed size", () => {
        let root = createRootSection<TestBindingData>(
            createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
        );

        root = splitSectionTree(root, "root", "horizontal", {
            first: createDraft(
                "sidebar-leaf",
                "Sidebar",
                "sidebar",
                createSectionComponentBinding("panel-section", { panelSectionId: "sidebar-panels" }),
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

        expect(resolvePanelSectionParentSplitDirection(root, "sidebar-leaf")).toBe("horizontal");

        const collapsed = applyPanelSectionCollapsedLayout(root, state, {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            isCollapsed: true,
        });

        const collapsedLeaf = findSectionNode(collapsed.root, "sidebar-leaf");
        expect(collapsed.state.sections["sidebar-panels"]?.isCollapsed).toBe(true);
        expect(collapsedLeaf?.meta?.["layout-v2:fixedSize"]).toBe(122);

        const expanded = applyPanelSectionCollapsedLayout(collapsed.root, collapsed.state, {
            leafSectionId: "sidebar-leaf",
            panelSectionId: "sidebar-panels",
            isCollapsed: false,
        });

        const expandedLeaf = findSectionNode(expanded.root, "sidebar-leaf");
        expect(expanded.state.sections["sidebar-panels"]?.isCollapsed).toBe(false);
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