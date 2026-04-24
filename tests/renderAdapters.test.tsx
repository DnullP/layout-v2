import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
    ActivityBar,
    PanelSection,
    TabSection,
    createActivityBarRenderAdapterFromRegistry,
    createPanelSectionRenderAdapterFromRegistry,
    createTabSectionRenderAdapterFromRegistry,
} from "../src";

describe("render adapters", () => {
    test("应支持 activity、panel、tab 的宿主渲染适配入口", () => {
        const activityMarkup = renderToStaticMarkup(
            <ActivityBar
                bar={{
                    id: "primary",
                    icons: [{ id: "explorer", label: "Explorer", symbol: "E" }],
                    selectedIconId: "explorer",
                }}
                renderIcon={(icon) => <span data-host-icon={icon.id}>HOST-{icon.symbol}</span>}
                onSelectIcon={() => { }}
                onMoveIcon={() => { }}
            />,
        );

        const panelMarkup = renderToStaticMarkup(
            <PanelSection
                leafSectionId="left"
                committedLeafSectionId="left"
                panelSectionId="left-panel"
                panelSection={{
                    id: "left-panel",
                    panels: [{ id: "files", label: "Files", symbol: "F", content: "Files panel" }],
                    focusedPanelId: "files",
                    isCollapsed: false,
                }}
                renderPanelTab={(panel) => <span data-host-panel-tab={panel.id}>{panel.label}</span>}
                renderPanelContent={(panel) => <div data-host-panel-content={panel.id}>{panel.content}</div>}
                onFocusPanel={() => { }}
                onToggleCollapsed={() => { }}
                onMovePanel={() => { }}
            />,
        );

        const tabMarkup = renderToStaticMarkup(
            <TabSection
                leafSectionId="main"
                committedLeafSectionId="main"
                tabSectionId="main-tabs"
                tabSection={{
                    id: "main-tabs",
                    tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page" }],
                    focusedTabId: "welcome",
                }}
                renderTabTitle={(tab) => <span data-host-tab-title={tab.id}>{tab.title}</span>}
                renderTabContent={(tab) => <div data-host-tab-content={tab.id}>{tab.content}</div>}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />,
        );

        expect(activityMarkup).toContain("HOST-E");
        expect(panelMarkup).toContain("data-host-panel-content=\"files\"");
        expect(tabMarkup).toContain("data-host-tab-title=\"welcome\"");
    });

    test("切换 focusedTabId 时应继续保留非激活 tab 的内容节点", () => {
        const tabMarkup = renderToStaticMarkup(
            <TabSection
                leafSectionId="main"
                committedLeafSectionId="main"
                tabSectionId="main-tabs"
                tabSection={{
                    id: "main-tabs",
                    tabs: [
                        { id: "welcome", title: "Welcome", content: "Welcome page" },
                        { id: "guide", title: "Guide", content: "Guide page" },
                    ],
                    focusedTabId: "guide",
                }}
                renderTabTitle={(tab) => <span data-host-tab-title={tab.id}>{tab.title}</span>}
                renderTabContent={(tab) => <div data-host-tab-content={tab.id}>{tab.content}</div>}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />,
        );

        expect(tabMarkup).toContain('data-host-tab-content="welcome"');
        expect(tabMarkup).toContain('data-host-tab-content="guide"');
        expect(tabMarkup).toContain("layout-v2-tab-section__card--inactive");
        expect(tabMarkup).toContain("layout-v2-tab-section__card--active");
    });

    test("应支持在空 panel section 时隐藏 panel bar", () => {
        const panelMarkup = renderToStaticMarkup(
            <PanelSection
                leafSectionId="left"
                committedLeafSectionId="left"
                panelSectionId="left-panel"
                panelSection={{
                    id: "left-panel",
                    panels: [],
                    focusedPanelId: null,
                    isCollapsed: false,
                }}
                hideBarWhenEmpty
                onFocusPanel={() => { }}
                onToggleCollapsed={() => { }}
                onMovePanel={() => { }}
            />,
        );

        expect(panelMarkup).not.toContain("layout-v2-panel-section__bar");
        expect(panelMarkup).toContain("Drop panel here");
        expect(panelMarkup).not.toContain("pick one from the bar");
    });

    test("dragging focused panel over the bar should keep source pane content rendered", () => {
        const panelMarkup = renderToStaticMarkup(
            <PanelSection
                leafSectionId="right-sidebar"
                committedLeafSectionId="right-sidebar"
                panelSectionId="right-panel"
                panelSection={{
                    id: "right-panel",
                    panels: [
                        { id: "ai-chat", label: "AI Chat", symbol: "A", content: "AI content" },
                        { id: "outline", label: "Outline", symbol: "O", content: "Outline content" },
                    ],
                    focusedPanelId: "ai-chat",
                    isCollapsed: false,
                }}
                dragSession={{
                    sessionId: 1,
                    sourcePanelSectionId: "right-panel",
                    currentPanelSectionId: "right-panel",
                    sourceLeafSectionId: "right-sidebar",
                    currentLeafSectionId: "right-sidebar",
                    activityTarget: null,
                    panelId: "ai-chat",
                    label: "AI Chat",
                    symbol: "A",
                    content: "AI content",
                    pointerId: 1,
                    originX: 100,
                    originY: 50,
                    pointerX: 140,
                    pointerY: 90,
                    phase: "dragging",
                    hoverTarget: {
                        area: "bar",
                        leafSectionId: "right-sidebar",
                        anchorLeafSectionId: "right-sidebar",
                        panelSectionId: "right-panel",
                        targetIndex: 1,
                    },
                }}
                renderPanelContent={(panel) => <div data-host-panel-content={panel.id}>{panel.content}</div>}
                onFocusPanel={() => { }}
                onToggleCollapsed={() => { }}
                onMovePanel={() => { }}
            />,
        );

        expect(panelMarkup).toContain('data-host-panel-content="ai-chat"');
        expect(panelMarkup).toContain("AI content");
    });
});

describe("render adapter registries", () => {
    test("应支持从 registry 工厂创建 activity、panel、tab 渲染适配器", () => {
        const activityAdapter = createActivityBarRenderAdapterFromRegistry({
            resolveRendererId: (icon) => String(icon.meta?.componentId ?? "fallback"),
            renderers: {
                explorer: (icon) => <span data-registry-activity={icon.id}>A-{icon.label}</span>,
                fallback: (icon) => <span data-registry-activity={icon.id}>F-{icon.label}</span>,
            },
        });

        const panelAdapter = createPanelSectionRenderAdapterFromRegistry({
            resolveRendererId: (panel) => String(panel.meta?.componentId ?? "fallback"),
            renderers: {
                files: {
                    renderPanelTab: (panel) => <span data-registry-panel-tab={panel.id}>P-{panel.label}</span>,
                    renderPanelContent: (panel) => <div data-registry-panel-content={panel.id}>PC-{panel.content}</div>,
                },
            },
            fallbackRenderPanelContent: (panel) => <div data-registry-panel-fallback={panel.id}>{panel.content}</div>,
        });

        const tabAdapter = createTabSectionRenderAdapterFromRegistry({
            resolveRendererId: (tab) => String(tab.meta?.componentId ?? tab.type ?? "fallback"),
            renderers: {
                editor: {
                    renderTabTitle: (tab) => <span data-registry-tab-title={tab.id}>T-{tab.title}</span>,
                    renderTabContent: (tab) => <div data-registry-tab-content={tab.id}>TC-{tab.content}</div>,
                },
            },
            fallbackRenderTabTitle: (tab) => <span data-registry-tab-fallback={tab.id}>{tab.title}</span>,
        });

        const activityMarkup = renderToStaticMarkup(
            <ActivityBar
                bar={{
                    id: "primary",
                    icons: [{ id: "explorer", label: "Explorer", symbol: "E", meta: { componentId: "explorer" } }],
                    selectedIconId: "explorer",
                }}
                renderIcon={activityAdapter.renderIcon}
                onSelectIcon={() => { }}
                onMoveIcon={() => { }}
            />,
        );

        const panelMarkup = renderToStaticMarkup(
            <PanelSection
                leafSectionId="left"
                committedLeafSectionId="left"
                panelSectionId="left-panel"
                panelSection={{
                    id: "left-panel",
                    panels: [{ id: "files", label: "Files", symbol: "F", content: "Files panel", meta: { componentId: "files" } }],
                    focusedPanelId: "files",
                    isCollapsed: false,
                }}
                renderPanelTab={panelAdapter.renderPanelTab}
                renderPanelContent={panelAdapter.renderPanelContent}
                onFocusPanel={() => { }}
                onToggleCollapsed={() => { }}
                onMovePanel={() => { }}
            />,
        );

        const tabMarkup = renderToStaticMarkup(
            <TabSection
                leafSectionId="main"
                committedLeafSectionId="main"
                tabSectionId="main-tabs"
                tabSection={{
                    id: "main-tabs",
                    tabs: [{ id: "welcome", title: "Welcome", content: "Welcome page", meta: { componentId: "editor" } }],
                    focusedTabId: "welcome",
                }}
                renderTabTitle={tabAdapter.renderTabTitle}
                renderTabContent={tabAdapter.renderTabContent}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />,
        );

        expect(activityMarkup).toContain("data-registry-activity=\"explorer\"");
        expect(panelMarkup).toContain("data-registry-panel-tab=\"files\"");
        expect(panelMarkup).toContain("data-registry-panel-content=\"files\"");
        expect(tabMarkup).toContain("data-registry-tab-title=\"welcome\"");
        expect(tabMarkup).toContain("data-registry-tab-content=\"welcome\"");
    });
});