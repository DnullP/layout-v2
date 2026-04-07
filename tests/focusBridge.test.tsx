import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
    ActivityBar,
    PanelSection,
    TabSection,
    createActivityBarFocusBridge,
    createPanelSectionFocusBridge,
    createTabSectionFocusBridge,
} from "../src";

describe("focus bridge", () => {
    test("应为 activity、panel、tab 输出默认布局角色与宿主 focus 属性", () => {
        const activityMarkup = renderToStaticMarkup(
            <ActivityBar
                bar={{
                    id: "primary",
                    icons: [{ id: "explorer", label: "Explorer", symbol: "E", meta: { componentId: "explorer" } }],
                    selectedIconId: "explorer",
                }}
                focusBridge={createActivityBarFocusBridge({
                    getBarAttributes: (bar) => ({
                        "data-panel-id": `${bar.id}:rail`,
                    }),
                    getIconAttributes: (_bar, icon) => ({
                        "data-tab-component": String(icon.meta?.componentId ?? ""),
                    }),
                })}
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
                    panels: [{ id: "files", label: "Files", symbol: "F", content: "Files panel", meta: { panelId: "files" } }],
                    focusedPanelId: "files",
                    isCollapsed: false,
                }}
                focusBridge={createPanelSectionFocusBridge({
                    getPanelAttributes: (_section, panel) => ({
                        "data-panel-id": String(panel.meta?.panelId ?? ""),
                    }),
                })}
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
                focusBridge={createTabSectionFocusBridge({
                    getTabAttributes: (_section, tab) => ({
                        "data-tab-component": String(tab.meta?.componentId ?? ""),
                    }),
                })}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />,
        );

        expect(activityMarkup).toContain('data-layout-role="activity-bar"');
        expect(activityMarkup).toContain('data-panel-id="primary:rail"');
        expect(activityMarkup).toContain('data-tab-component="explorer"');
        expect(panelMarkup).toContain('data-layout-role="panel-section"');
        expect(panelMarkup).toContain('data-panel-id="files"');
        expect(tabMarkup).toContain('data-layout-role="tab-section"');
        expect(tabMarkup).toContain('data-tab-component="editor"');
    });
});