import { type SectionComponentData, type SectionComponentRegistry } from "../section/sectionComponent";
import { type ActivityBarIconRenderer } from "../activity-bar/ActivityBarIcon";
import { type ActivityBarIconDefinition } from "../activity-bar/activityBarModel";
import {
    type PanelSectionContentRenderer,
    type PanelSectionPanelDefinition,
    type PanelSectionTabRenderer,
} from "../panel-section/PanelSection";
import {
    type TabSectionContentRenderer,
    type TabSectionContentRendererRegistry,
    type TabSectionTabDefinition,
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

export interface ActivityBarRenderRegistry<TKey extends string = string> {
    resolveRendererId: (icon: ActivityBarIconDefinition) => TKey | null | undefined;
    renderers: Record<TKey, ActivityBarIconRenderer>;
    fallbackRenderIcon?: ActivityBarIconRenderer;
}

export interface TabSectionRendererDefinition {
    renderTabTitle?: TabSectionTitleRenderer;
    renderTabContent?: TabSectionContentRenderer;
}

export interface TabSectionRenderRegistry<TKey extends string = string> {
    resolveRendererId: (tab: TabSectionTabDefinition) => TKey | null | undefined;
    renderers: Record<TKey, TabSectionRendererDefinition>;
    fallbackRenderTabTitle?: TabSectionTitleRenderer;
    fallbackRenderTabContent?: TabSectionContentRenderer;
}

export interface PanelSectionRendererDefinition {
    renderPanelTab?: PanelSectionTabRenderer;
    renderPanelContent?: PanelSectionContentRenderer;
}

export interface PanelSectionRenderRegistry<TKey extends string = string> {
    resolveRendererId: (panel: PanelSectionPanelDefinition) => TKey | null | undefined;
    renderers: Record<TKey, PanelSectionRendererDefinition>;
    fallbackRenderPanelTab?: PanelSectionTabRenderer;
    fallbackRenderPanelContent?: PanelSectionContentRenderer;
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

export function createActivityBarRenderAdapterFromRegistry<TKey extends string>(
    registry: ActivityBarRenderRegistry<TKey>,
): ActivityBarRenderAdapter {
    return {
        renderIcon: (icon) => {
            const rendererId = registry.resolveRendererId(icon);
            const renderer = rendererId ? registry.renderers[rendererId] : undefined;
            return (renderer ?? registry.fallbackRenderIcon)?.(icon);
        },
    };
}

export function createTabSectionRenderAdapterFromRegistry<TKey extends string>(
    registry: TabSectionRenderRegistry<TKey>,
): TabSectionRenderAdapter {
    return {
        renderTabTitle: (tab) => {
            const rendererId = registry.resolveRendererId(tab);
            const renderer = rendererId ? registry.renderers[rendererId] : undefined;
            return (renderer?.renderTabTitle ?? registry.fallbackRenderTabTitle)?.(tab);
        },
        renderTabContent: (tab) => {
            const rendererId = registry.resolveRendererId(tab);
            const renderer = rendererId ? registry.renderers[rendererId] : undefined;
            return (renderer?.renderTabContent ?? registry.fallbackRenderTabContent)?.(tab);
        },
    };
}

export function createPanelSectionRenderAdapterFromRegistry<TKey extends string>(
    registry: PanelSectionRenderRegistry<TKey>,
): PanelSectionRenderAdapter {
    return {
        renderPanelTab: (panel) => {
            const rendererId = registry.resolveRendererId(panel);
            const renderer = rendererId ? registry.renderers[rendererId] : undefined;
            return (renderer?.renderPanelTab ?? registry.fallbackRenderPanelTab)?.(panel);
        },
        renderPanelContent: (panel) => {
            const rendererId = registry.resolveRendererId(panel);
            const renderer = rendererId ? registry.renderers[rendererId] : undefined;
            return (renderer?.renderPanelContent ?? registry.fallbackRenderPanelContent)?.(panel);
        },
    };
}

export function createVSCodeLayoutRenderAdapters<
    TData extends SectionComponentData,
>(adapters: VSCodeLayoutRenderAdapters<TData>): VSCodeLayoutRenderAdapters<TData> {
    return adapters;
}

export function createVSCodeLayoutRenderAdaptersFromRegistry<
    TData extends SectionComponentData,
    TActivityKey extends string = string,
    TTabKey extends string = string,
    TPanelKey extends string = string,
>(adapters: {
    sections?: SectionComponentRegistry<TData>;
    activityBar?: ActivityBarRenderRegistry<TActivityKey>;
    tabs?: TabSectionRenderRegistry<TTabKey>;
    panels?: PanelSectionRenderRegistry<TPanelKey>;
}): VSCodeLayoutRenderAdapters<TData> {
    return {
        sections: adapters.sections,
        activityBar: adapters.activityBar
            ? createActivityBarRenderAdapterFromRegistry(adapters.activityBar)
            : undefined,
        tabs: adapters.tabs
            ? createTabSectionRenderAdapterFromRegistry(adapters.tabs)
            : undefined,
        panels: adapters.panels
            ? createPanelSectionRenderAdapterFromRegistry(adapters.panels)
            : undefined,
    };
}