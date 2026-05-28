import { describe, expect, test } from "bun:test";
import {
    createWorkbenchLayoutState,
    createWorkbenchRootLayout,
    findSectionNode,
    getSectionComponentBinding,
    WORKBENCH_MAIN_TAB_SECTION_ID,
} from "../src";

describe("workbench main-only layout", () => {
    test("creates a root with only the main tab section", () => {
        const root = createWorkbenchRootLayout({ hasRightSidebar: true, mainOnly: true });
        const binding = getSectionComponentBinding(root);

        expect(root.id).toBe("main-tabs");
        expect(root.split).toBeNull();
        expect(binding.type).toBe("tab-section");
        expect((binding.props as { tabSectionId?: string }).tabSectionId).toBe(WORKBENCH_MAIN_TAB_SECTION_ID);
        expect(findSectionNode(root, "left-sidebar")).toBeNull();
        expect(findSectionNode(root, "right-sidebar")).toBeNull();
    });

    test("keeps initial tabs without creating sidebars", () => {
        const state = createWorkbenchLayoutState({
            mainOnly: true,
            hasRightSidebar: true,
            initialTabs: [
                { id: "note-1", title: "Note 1", component: "codemirror", params: { path: "Note 1.md" } },
            ],
        });

        expect(state.root.id).toBe("main-tabs");
        expect(findSectionNode(state.root, "left-sidebar")).toBeNull();
        expect(findSectionNode(state.root, "right-sidebar")).toBeNull();
        expect(state.tabSections.sections[WORKBENCH_MAIN_TAB_SECTION_ID]?.tabs.map((tab) => tab.id)).toEqual(["note-1"]);
        expect(state.workbench?.activeGroupId).toBe(WORKBENCH_MAIN_TAB_SECTION_ID);
    });
});
