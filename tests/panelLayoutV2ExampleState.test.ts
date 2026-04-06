import { describe, expect, test } from "bun:test";
import {
    createActivityBarState,
    createPanelSectionsState,
    createRootSection,
    createSectionComponentBinding,
    splitSectionTree,
    type PanelSectionDragSession,
} from "../src";
import {
    buildActivityToPanelPreviewState,
    buildPanelToActivityPreviewState,
    buildPanelPreviewLayoutState,
    createEmptyPanelSectionStateItem,
    createExampleSectionDraft,
    createPanelFromActivityIcon,
    findPanelSectionLeaf,
    type ExampleSectionLayoutData,
} from "../example/exampleLayoutState";

describe("panel layout example state", () => {
    test("activity icon 拖到 panel bar 时应生成 panel 预览并插入目标位置", () => {
        const state = createPanelSectionsState([
            {
                id: "main-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
                isRoot: true,
            },
        ]);

        const previewState = buildActivityToPanelPreviewState(
            state,
            { id: "search", label: "Search", symbol: "S" },
            "main-panel",
            1,
        );

        expect(previewState?.sections["main-panel"]?.panels.map((panel) => panel.id)).toEqual([
            "terminal",
            createPanelFromActivityIcon({ id: "search", label: "Search", symbol: "S" }).id,
        ]);
    });

    test("panel preview split 应将拖拽 panel 放入预览分区并折叠空源 section", () => {
        let root = createRootSection<ExampleSectionLayoutData>(
            createExampleSectionDraft(
                "root",
                "Root",
                "root",
                createSectionComponentBinding("empty", {}),
            ),
        );

        root = splitSectionTree(root, "root", "vertical", {
            first: createExampleSectionDraft(
                "source-leaf",
                "Source Panel",
                "panel",
                createSectionComponentBinding("panel-section", {
                    panelSectionId: "source-panel",
                }),
            ),
            second: createExampleSectionDraft(
                "target-leaf",
                "Target Panel",
                "panel",
                createSectionComponentBinding("panel-section", {
                    panelSectionId: "target-panel",
                }),
            ),
        });

        const state = createPanelSectionsState([
            {
                id: "source-panel",
                panels: [
                    { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
                ],
                focusedPanelId: "terminal",
                isCollapsed: false,
                isRoot: false,
            },
            {
                id: "target-panel",
                panels: [
                    { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
                ],
                focusedPanelId: "problems",
                isCollapsed: false,
                isRoot: true,
            },
        ]);

        const session: PanelSectionDragSession = {
            sourcePanelSectionId: "source-panel",
            currentPanelSectionId: "source-panel",
            sourceLeafSectionId: "source-leaf",
            currentLeafSectionId: "source-leaf",
            activityTarget: null,
            panelId: "terminal",
            label: "Terminal",
            symbol: "T",
            content: "Terminal pane",
            pointerId: 1,
            originX: 10,
            originY: 10,
            pointerX: 120,
            pointerY: 180,
            phase: "dragging",
            hoverTarget: {
                area: "content",
                leafSectionId: "target-leaf",
                anchorLeafSectionId: "target-leaf",
                panelSectionId: "target-panel",
                splitSide: "bottom",
                contentBounds: {
                    left: 0,
                    top: 0,
                    right: 300,
                    bottom: 200,
                    width: 300,
                    height: 200,
                },
            },
        };

        const preview = buildPanelPreviewLayoutState(root, state, session);

        expect(preview).not.toBeNull();
        expect(preview?.state.sections["source-panel"]).toBeUndefined();
        expect(findPanelSectionLeaf(preview!.root, "source-panel")).toBeNull();

        const previewSectionEntry = Object.values(preview!.state.sections).find((section) => {
            return section.panels.some((panel) => panel.id === "terminal");
        });

        expect(previewSectionEntry?.id).not.toBe("target-panel");
        expect(findPanelSectionLeaf(preview!.root, previewSectionEntry!.id)).not.toBeNull();
    });

    test("无有效 panel 命中时不应生成 panel preview", () => {
        let root = createRootSection<ExampleSectionLayoutData>(
            createExampleSectionDraft(
                "root",
                "Root",
                "root",
                createSectionComponentBinding("empty", {}),
            ),
        );

        root = splitSectionTree(root, "root", "vertical", {
            first: createExampleSectionDraft(
                "main-panel-leaf",
                "Main Panel",
                "panel",
                createSectionComponentBinding("panel-section", {
                    panelSectionId: "main-panel",
                }),
            ),
            second: createExampleSectionDraft(
                "bottom-container",
                "Bottom",
                "container",
                createSectionComponentBinding("empty", {}),
            ),
        });

        root = splitSectionTree(root, "bottom-container", "vertical", {
            first: createExampleSectionDraft(
                "secondary-panel-leaf",
                "Secondary Panel",
                "panel",
                createSectionComponentBinding("panel-section", {
                    panelSectionId: "secondary-panel",
                }),
            ),
            second: createExampleSectionDraft(
                "tail-panel-leaf",
                "Tail Panel",
                "panel",
                createSectionComponentBinding("panel-section", {
                    panelSectionId: "tail-panel",
                }),
            ),
        });

        const state = createPanelSectionsState([
            {
                ...createEmptyPanelSectionStateItem("main-panel"),
                isRoot: true,
            },
            {
                id: "secondary-panel",
                panels: [{ id: "problems", label: "Problems", symbol: "P", content: "Problems pane" }],
                focusedPanelId: "problems",
                isCollapsed: false,
                isRoot: false,
            },
            {
                id: "tail-panel",
                panels: [{ id: "output", label: "Output", symbol: "O", content: "Output pane" }],
                focusedPanelId: "output",
                isCollapsed: false,
                isRoot: false,
            },
        ]);

        const preview = buildPanelPreviewLayoutState(root, state, {
            sourcePanelSectionId: "main-panel",
            currentPanelSectionId: "main-panel",
            sourceLeafSectionId: "main-panel-leaf",
            currentLeafSectionId: "main-panel-leaf",
            activityTarget: null,
            panelId: "missing",
            label: "Missing",
            symbol: "M",
            content: "Missing pane",
            pointerId: 2,
            originX: 0,
            originY: 0,
            pointerX: 1,
            pointerY: 1,
            phase: "dragging",
            hoverTarget: null,
        });

        expect(preview).toBeNull();
    });

    test("panel 拖到 activity bar 时应生成 activity 预览并插入目标位置", () => {
        const activityState = createActivityBarState([
            {
                id: "primary-activity-bar",
                icons: [
                    { id: "explorer", label: "Explorer", symbol: "E" },
                    { id: "search", label: "Search", symbol: "S" },
                ],
                selectedIconId: "explorer",
            },
        ]);

        const previewState = buildPanelToActivityPreviewState(
            activityState,
            { id: "panel-terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
            "primary-activity-bar",
            1,
        );

        expect(previewState?.bars["primary-activity-bar"]?.icons.map((icon) => icon.id)).toEqual([
            "explorer",
            "terminal",
            "search",
        ]);
        expect(previewState?.bars["primary-activity-bar"]?.selectedIconId).toBe("terminal");
    });
});