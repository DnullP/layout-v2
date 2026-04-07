import { describe, expect, test } from "bun:test";
import {
    createPanelSectionsState,
    focusPanelSectionPanel,
    insertPanelSectionPanel,
    movePanelSectionPanel,
    setPanelSectionCollapsed,
    updatePanelMetadata,
} from "../src";

describe("panelSectionModel", () => {
    test("应支持切换指定 panel 的 focus 并自动展开内容", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: true,
            },
        ]);

        const nextState = focusPanelSectionPanel(state, "main-panel", "problems");

        expect(nextState.sections["main-panel"]?.focusedPanelId).toBe("problems");
        expect(nextState.sections["main-panel"]?.isCollapsed).toBe(false);
    });

    test("应支持同一个 section 内实时重排 panel", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                    { id: "output", label: "Output", symbol: "O", content: "Output pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
            },
        ]);

        const nextState = movePanelSectionPanel(state, {
            sourceSectionId: "main-panel",
            targetSectionId: "main-panel",
            panelId: "output",
            targetIndex: 1,
        });

        expect(nextState.sections["main-panel"]?.panels.map((panel) => panel.id)).toEqual([
            "terminal",
            "output",
            "problems",
        ]);
        expect(nextState.sections["main-panel"]?.focusedPanelId).toBe("output");
    });

    test("应支持插入来自 activity bar 的 panel", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
            },
        ]);

        const nextState = insertPanelSectionPanel(
            state,
            "main-panel",
            { id: "search", label: "Search", symbol: "S", content: "Search pane" },
            1,
        );

        expect(nextState.sections["main-panel"]?.panels.map((panel) => panel.id)).toEqual([
            "terminal",
            "search",
        ]);
        expect(nextState.sections["main-panel"]?.focusedPanelId).toBe("search");
    });

    test("应支持折叠与展开 panel content", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
            },
        ]);

        const collapsedState = setPanelSectionCollapsed(state, "main-panel", true);
        const expandedState = setPanelSectionCollapsed(collapsedState, "main-panel", false);

        expect(collapsedState.sections["main-panel"]?.isCollapsed).toBe(true);
        expect(expandedState.sections["main-panel"]?.isCollapsed).toBe(false);
    });

    test("应支持为 panel 挂载宿主元数据", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
            },
        ]);

        const nextState = updatePanelMetadata(state, "main-panel", "terminal", (meta) => ({
            ...meta,
            lifecycleScope: "workspace",
        }));

        expect(nextState.sections["main-panel"]?.panels[0]?.meta).toEqual({
            lifecycleScope: "workspace",
        });
    });
});