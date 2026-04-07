import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
    ActivityBar,
    PanelSection,
    TabSection,
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
                onSelectIcon={() => {}}
                onMoveIcon={() => {}}
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
                onFocusPanel={() => {}}
                onToggleCollapsed={() => {}}
                onMovePanel={() => {}}
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
                onFocusTab={() => {}}
                onCloseTab={() => {}}
                onMoveTab={() => {}}
            />,
        );

        expect(activityMarkup).toContain("HOST-E");
        expect(panelMarkup).toContain("data-host-panel-content=\"files\"");
        expect(tabMarkup).toContain("data-host-tab-title=\"welcome\"");
    });
});