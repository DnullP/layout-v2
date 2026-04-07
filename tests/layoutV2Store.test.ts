import { describe, expect, test } from "bun:test";
import {
    createVSCodeLayoutState,
    exportVSCodeLayoutSnapshot,
    createVSCodeLayoutStore,
    createRootSection,
    createSectionComponentBinding,
    selectActivityBarIcon,
    updateSectionTree,
    type SectionNode,
} from "../src";

interface TestSectionData {
    role: "root" | "sidebar" | "main";
    component: ReturnType<typeof createSectionComponentBinding>;
}

function createTestRoot(): SectionNode<TestSectionData> {
    return createRootSection<TestSectionData>({
        id: "root",
        title: "Root",
        data: {
            role: "root",
            component: createSectionComponentBinding("empty", {}),
        },
    });
}

describe("vscode layout store", () => {
    test("应支持通过统一状态工厂创建外部应用可消费的初始状态", () => {
        const state = createVSCodeLayoutState({
            root: createTestRoot(),
            activityBars: [{
                id: "primary-activity-bar",
                icons: [{ id: "explorer", label: "Explorer", symbol: "E" }],
                selectedIconId: "explorer",
            }],
            tabSections: [{
                id: "main-tabs",
                tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                focusedTabId: "welcome",
                isRoot: true,
            }],
            panelSections: [{
                id: "left-panel",
                panels: [{ id: "panel-files", label: "Files", symbol: "F", content: "Files panel" }],
                focusedPanelId: "panel-files",
                isCollapsed: false,
                isRoot: true,
            }],
        });

        expect(state.activityBars.bars["primary-activity-bar"]?.icons).toHaveLength(1);
        expect(state.tabSections.sections["main-tabs"]?.tabs[0]?.id).toBe("welcome");
        expect(state.panelSections.sections["left-panel"]?.panels[0]?.id).toBe("panel-files");
        expect(state.workbench?.activeGroupId).toBe("main-tabs");
    });

    test("应支持通过统一 store 对布局与 section 状态进行操控", () => {
        const store = createVSCodeLayoutStore({
            initialState: createVSCodeLayoutState({
                root: createTestRoot(),
                activityBars: [{
                    id: "primary-activity-bar",
                    icons: [{ id: "explorer", label: "Explorer", symbol: "E" }],
                    selectedIconId: "explorer",
                }],
                tabSections: [{
                    id: "main-tabs",
                    tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                    focusedTabId: "welcome",
                    isRoot: true,
                }],
                panelSections: [{
                    id: "left-panel",
                    panels: [{ id: "panel-files", label: "Files", symbol: "F", content: "Files panel" }],
                    focusedPanelId: "panel-files",
                    isCollapsed: false,
                    isRoot: true,
                }],
            }),
        });

        let notificationCount = 0;
        const unsubscribe = store.subscribe(() => {
            notificationCount += 1;
        });

        store.splitSection("root", "horizontal", {
            first: {
                id: "left",
                title: "Left",
                data: {
                    role: "sidebar",
                    component: createSectionComponentBinding("panel-section", { panelSectionId: "left-panel" }),
                },
            },
            second: {
                id: "main",
                title: "Main",
                data: {
                    role: "main",
                    component: createSectionComponentBinding("tab-section", { tabSectionId: "main-tabs" }),
                },
            },
        });

        store.insertActivityIcon("primary-activity-bar", {
            id: "search",
            label: "Search",
            symbol: "S",
        }, 1);
        store.focusPanel("left-panel", "panel-files");
        store.closeTab("main-tabs", "welcome");

        const state = store.getState();

        expect(state.root.split?.children.map((child) => child.id)).toEqual(["left", "main"]);
        expect(state.activityBars.bars["primary-activity-bar"]?.icons.map((icon) => icon.id)).toEqual([
            "explorer",
            "search",
        ]);
        expect(state.tabSections.sections["main-tabs"]?.tabs).toHaveLength(0);
        expect(state.panelSections.sections["left-panel"]?.focusedPanelId).toBe("panel-files");
        expect(notificationCount).toBe(4);

        unsubscribe();
        store.removePanel("left-panel", "panel-files");
        expect(notificationCount).toBe(4);
    });

    test("外部应用可在一次状态更新中同步切换 activity icon 与 left sidebar panel section", () => {
        const store = createVSCodeLayoutStore({
            initialState: createVSCodeLayoutState({
                root: createRootSection<TestSectionData>({
                    id: "root",
                    title: "Root",
                    data: {
                        role: "root",
                        component: createSectionComponentBinding("empty", {}),
                    },
                }),
                activityBars: [{
                    id: "primary-activity-bar",
                    icons: [
                        { id: "explorer", label: "Explorer", symbol: "E" },
                        { id: "search", label: "Search", symbol: "S" },
                    ],
                    selectedIconId: "explorer",
                }],
                panelSections: [
                    {
                        id: "left-explorer-panel",
                        panels: [{ id: "files", label: "Files", symbol: "F", content: "Files panel" }],
                        focusedPanelId: "files",
                        isCollapsed: false,
                        isRoot: true,
                    },
                    {
                        id: "left-search-panel",
                        panels: [{ id: "results", label: "Results", symbol: "R", content: "Results panel" }],
                        focusedPanelId: "results",
                        isCollapsed: false,
                    },
                ],
            }),
        });

        store.splitSection("root", "horizontal", {
            first: {
                id: "left-sidebar",
                title: "Left Sidebar",
                data: {
                    role: "sidebar",
                    component: createSectionComponentBinding("panel-section", {
                        panelSectionId: "left-explorer-panel",
                    }),
                },
            },
            second: {
                id: "main",
                title: "Main",
                data: {
                    role: "main",
                    component: createSectionComponentBinding("empty", {}),
                },
            },
        });

        const iconToPanelSectionId: Record<string, string> = {
            explorer: "left-explorer-panel",
            search: "left-search-panel",
        };

        let notificationCount = 0;
        const unsubscribe = store.subscribe(() => {
            notificationCount += 1;
        });

        store.updateState((state) => {
            const panelSectionId = iconToPanelSectionId.search;

            return {
                ...state,
                activityBars: selectActivityBarIcon(state.activityBars, "primary-activity-bar", "search"),
                root: updateSectionTree(state.root, "left-sidebar", (section) => ({
                    ...section,
                    data: {
                        ...section.data,
                        component: createSectionComponentBinding("panel-section", {
                            panelSectionId,
                        }),
                    },
                })),
            };
        });

        const nextState = store.getState();
        const leftSidebar = store.getSection("left-sidebar");

        expect(notificationCount).toBe(1);
        expect(nextState.activityBars.bars["primary-activity-bar"]?.selectedIconId).toBe("search");
        expect(leftSidebar?.data.component.type).toBe("panel-section");
        expect(leftSidebar?.data.component.props).toEqual({
            panelSectionId: "left-search-panel",
        });

        unsubscribe();
    });

    test("应提供宿主级 metadata、lifecycle hooks 与 reason 上下文", () => {
        const store = createVSCodeLayoutStore({
            initialState: createVSCodeLayoutState({
                root: createTestRoot(),
                tabSections: [{
                    id: "main-tabs",
                    tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                    focusedTabId: "welcome",
                    isRoot: true,
                }],
            }),
        });

        const lifecycleEvents: string[] = [];
        store.addLifecycleHook((event) => {
            lifecycleEvents.push(`${event.phase}:${event.command}:${event.reason ?? "none"}`);
        });

        store.updateTabSectionMetadata("main-tabs", (meta) => ({
            ...meta,
            componentId: "editor-group",
            stateKey: "workspace:main",
        }), {
            reason: "restore",
            metadata: {
                requestId: "req-1",
            },
        });

        store.updateSectionMetadata("root", (meta) => ({
            ...meta,
            lifecycleScope: "workbench",
        }));

        expect(store.getTabSection("main-tabs")?.meta).toEqual({
            componentId: "editor-group",
            stateKey: "workspace:main",
        });
        expect(store.getSection("root")?.meta).toEqual({
            lifecycleScope: "workbench",
        });
        expect(lifecycleEvents).toEqual([
            "before:update-tab-section-metadata:restore",
            "after:update-tab-section-metadata:restore",
            "before:update-section-metadata:none",
            "after:update-section-metadata:none",
        ]);
    });

    test("应支持 workbench group 查询、跨 group 移动与 snapshot 导入导出", () => {
        const store = createVSCodeLayoutStore({
            initialState: createVSCodeLayoutState({
                root: createTestRoot(),
                tabSections: [
                    {
                        id: "main-tabs",
                        tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                        focusedTabId: "welcome",
                        isRoot: true,
                    },
                    {
                        id: "secondary-tabs",
                        tabs: [{ id: "notes", title: "Notes", content: "Notes page" }],
                        focusedTabId: "notes",
                    },
                ],
            }),
        });

        expect(store.listGroups().map((group) => group.id)).toEqual([
            "main-tabs",
            "secondary-tabs",
        ]);
        expect(store.getActiveGroup()?.id).toBe("main-tabs");

        store.setActiveGroup("secondary-tabs");
        store.moveTabAcrossGroups({
            sourceGroupId: "main-tabs",
            targetGroupId: "secondary-tabs",
            tabId: "welcome",
            targetIndex: 1,
        }, {
            reason: "user-drag",
        });

        const snapshot = store.exportSnapshot({
            version: "2",
            metadata: {
                source: "unit-test",
            },
        });

        const importedStore = createVSCodeLayoutStore({
            initialState: createVSCodeLayoutState({
                root: createTestRoot(),
            }),
        });

        importedStore.importSnapshot(snapshot, {
            version: "2",
        });

        expect(snapshot.metadata).toEqual({
            source: "unit-test",
        });
        expect(importedStore.getActiveGroup()?.id).toBe("secondary-tabs");
        expect(importedStore.getTabSection("secondary-tabs")?.tabs.map((tab) => tab.id)).toEqual([
            "notes",
            "welcome",
        ]);
    });

    test("应支持单独导出 snapshot 工具函数", () => {
        const state = createVSCodeLayoutState({
            root: createTestRoot(),
            tabSections: [{
                id: "main-tabs",
                tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                focusedTabId: "welcome",
                isRoot: true,
            }],
        });

        const snapshot = exportVSCodeLayoutSnapshot(state, {
            version: 3,
            metadata: {
                sourceParams: {
                    workspaceId: "demo",
                },
            },
        });

        expect(snapshot.version).toBe(3);
        expect(snapshot.state.workbench?.activeGroupId).toBe("main-tabs");
    });
});