import { type SectionComponentData, type SectionComponentRegistry } from "../section/sectionComponent";
import { type ActivityBarIconRenderer } from "../activity-bar/ActivityBarIcon";
import {
    type PanelSectionContentRenderer,
    type PanelSectionTabRenderer,
} from "../panel-section/PanelSection";
import {
    type TabSectionContentRenderer,
    type TabSectionContentRendererRegistry,
    type TabSectionTitleRenderer,
} from "../tab-section/TabSection";

export interface ActivityBarRenderAdapter {
    renderIcon?: ActivityBarIconRenderer;
}

export interface TabSectionRenderAdapter {
    contentRegistry?: TabSectionContentRendererRegistry;
    renderTabContent?: TabSectionContentRenderer;
    renderTabTitle?: TabSectionTitleRenderer;
}

export interface PanelSectionRenderAdapter {
    renderPanelTab?: PanelSectionTabRenderer;
    renderPanelContent?: PanelSectionContentRenderer;
}

export interface VSCodeLayoutRenderAdapters<
    TData extends SectionComponentData = SectionComponentData,
> {
    sections?: SectionComponentRegistry<TData>;
    activityBar?: ActivityBarRenderAdapter;
    tabs?: TabSectionRenderAdapter;
    panels?: PanelSectionRenderAdapter;
}

export function createActivityBarRenderAdapter(
    adapter: ActivityBarRenderAdapter,
): ActivityBarRenderAdapter {
    return adapter;
}

export function createTabSectionRenderAdapter(
    adapter: TabSectionRenderAdapter,
): TabSectionRenderAdapter {
    return adapter;
}

export function createPanelSectionRenderAdapter(
    adapter: PanelSectionRenderAdapter,
): PanelSectionRenderAdapter {
    return adapter;
}

export function createVSCodeLayoutRenderAdapters<
    TData extends SectionComponentData,
>(adapters: VSCodeLayoutRenderAdapters<TData>): VSCodeLayoutRenderAdapters<TData> {
    return adapters;
}