import { describe, expect, test } from "bun:test";
import {
    applyPersistedSectionRatios,
    applyWorkbenchPanelLayoutSnapshot,
    createVSCodeLayoutStore,
    createWorkbenchLayoutState,
    createSectionComponentBinding,
    splitSectionTree,
    WORKBENCH_LEFT_PANEL_SECTION_ID,
    type WorkbenchPanelLayoutSnapshot,
} from "../src";

function createLeftSidebarPanelSplitSnapshot(): WorkbenchPanelLayoutSnapshot {
    let baseState = createWorkbenchLayoutState({
        panels: [
            { id: "files", label: "Files", activityId: "files", position: "left" },
            { id: "backlinks", label: "Backlinks", activityId: "backlinks", position: "right" },
        ],
        activities: [
            { id: "files", label: "Files", bar: "left" },
            { id: "backlinks", label: "Backlinks", bar: "right" },
        ],
        hasRightSidebar: true,
    });

    baseState = {
        ...baseState,
        root: splitSectionTree(baseState.root, "left-sidebar", "vertical", {
            ratio: 0.62,
            first: {
                id: "left-sidebar-section",
                title: "Left Sidebar",
                data: {
                    role: "sidebar",
                    component: createSectionComponentBinding("panel-section", {
                        panelSectionId: WORKBENCH_LEFT_PANEL_SECTION_ID,
                    }),
                },
            },
            second: {
                id: "left-sidebar-split",
                title: "Backlinks",
                data: {
                    role: "sidebar",
                    component: createSectionComponentBinding("panel-section", {
                        panelSectionId: "left-sidebar-panels",
                    }),
                },
            },
        }),
    };

    return {
        root: baseState.root,
        sections: [
            {
                id: WORKBENCH_LEFT_PANEL_SECTION_ID,
                panelIds: ["files"],
                focusedPanelId: "files",
                isCollapsed: false,
                isRoot: true,
            },
            {
                id: "left-sidebar-panels",
                panelIds: ["backlinks"],
                focusedPanelId: "backlinks",
                isCollapsed: false,
            },
        ],
    };
}

describe("applyPersistedSectionRatios", () => {
    test("skips stale ratios until panel split topology is restored", () => {
        const store = createVSCodeLayoutStore({
            initialState: createWorkbenchLayoutState({
                panels: [
                    { id: "files", label: "Files", activityId: "files", position: "left" },
                    { id: "backlinks", label: "Backlinks", activityId: "backlinks", position: "right" },
                ],
                activities: [
                    { id: "files", label: "Files", bar: "left" },
                    { id: "backlinks", label: "Backlinks", bar: "right" },
                ],
                hasRightSidebar: true,
            }),
        });

        expect(store.getSection("left-sidebar")?.split).toBeNull();
        expect(() => applyPersistedSectionRatios(store, { "left-sidebar": 0.44 })).not.toThrow();
        expect(store.getSection("left-sidebar")?.split).toBeNull();

        const panelLayoutSnapshot = createLeftSidebarPanelSplitSnapshot();
        store.updateState((currentState) => applyWorkbenchPanelLayoutSnapshot(currentState, panelLayoutSnapshot));

        expect(store.getSection("left-sidebar")?.split?.ratio).toBe(0.62);
        expect(applyPersistedSectionRatios(store, { "left-sidebar": 0.44 })).toBe(true);
        expect(store.getSection("left-sidebar")?.split?.ratio).toBe(0.44);
    });
});
