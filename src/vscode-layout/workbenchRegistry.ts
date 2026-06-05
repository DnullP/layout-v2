import { useSyncExternalStore, type ReactNode } from "react";
import type {
    WorkbenchActivityDefinition,
    WorkbenchPanelContext,
    WorkbenchPanelDefinition,
    WorkbenchTabApi,
} from "./workbenchTypes";

export type WorkbenchTabRenderer = (props: {
    params: Record<string, unknown>;
    api: WorkbenchTabApi;
}) => ReactNode;

export interface WorkbenchActivityContribution extends WorkbenchActivityDefinition {
    order?: number;
    onActivate?: (context: WorkbenchPanelContext) => void;
}

export interface WorkbenchPanelContribution extends WorkbenchPanelDefinition {
    render: (context: WorkbenchPanelContext) => ReactNode;
}

export interface WorkbenchTabComponentContribution {
    id: string;
    render: WorkbenchTabRenderer;
}

export interface WorkbenchRegistrySnapshot {
    activities: WorkbenchActivityContribution[];
    panels: WorkbenchPanelContribution[];
    tabComponents: WorkbenchTabComponentContribution[];
    activityDefinitions: WorkbenchActivityDefinition[];
    panelDefinitions: WorkbenchPanelDefinition[];
    tabComponentRenderers: Record<string, WorkbenchTabRenderer>;
}

export interface WorkbenchRegistry {
    registerActivity(contribution: WorkbenchActivityContribution): () => void;
    registerPanel(contribution: WorkbenchPanelContribution): () => void;
    registerTabComponent(contribution: WorkbenchTabComponentContribution): () => void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): WorkbenchRegistrySnapshot;
    getActivitiesSnapshot(): WorkbenchActivityContribution[];
    getPanelsSnapshot(): WorkbenchPanelContribution[];
    getTabComponentsSnapshot(): WorkbenchTabComponentContribution[];
    getActivityById(activityId: string): WorkbenchActivityContribution | undefined;
    getPanelById(panelId: string): WorkbenchPanelContribution | undefined;
    getTabComponentById(componentId: string): WorkbenchTabComponentContribution | undefined;
    useActivityDefinitions(): WorkbenchActivityDefinition[];
    usePanelDefinitions(): WorkbenchPanelDefinition[];
    useTabComponentRenderers(): Record<string, WorkbenchTabRenderer>;
}

function createEmptySnapshot(): WorkbenchRegistrySnapshot {
    return {
        activities: [],
        panels: [],
        tabComponents: [],
        activityDefinitions: [],
        panelDefinitions: [],
        tabComponentRenderers: {},
    };
}

function compareContributionOrder<TContribution extends { id: string; order?: number }>(
    left: TContribution,
    right: TContribution,
): number {
    const leftOrder = left.order ?? 0;
    const rightOrder = right.order ?? 0;
    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }
    return left.id.localeCompare(right.id);
}

function toActivityDefinition(
    contribution: WorkbenchActivityContribution,
): WorkbenchActivityDefinition {
    return {
        id: contribution.id,
        label: contribution.label,
        bar: contribution.bar,
        section: contribution.section,
        activationMode: contribution.activationMode,
        icon: contribution.icon,
    };
}

function toPanelDefinition(
    contribution: WorkbenchPanelContribution,
): WorkbenchPanelDefinition {
    return {
        id: contribution.id,
        label: contribution.label,
        icon: contribution.icon,
        activityId: contribution.activityId,
        position: contribution.position,
        order: contribution.order,
    };
}

function buildTabComponentRendererMap(
    contributions: WorkbenchTabComponentContribution[],
): Record<string, WorkbenchTabRenderer> {
    return Object.fromEntries(contributions.map((entry) => [entry.id, entry.render]));
}

export function createWorkbenchRegistry(): WorkbenchRegistry {
    const activities = new Map<string, WorkbenchActivityContribution>();
    const panels = new Map<string, WorkbenchPanelContribution>();
    const tabComponents = new Map<string, WorkbenchTabComponentContribution>();
    const listeners = new Set<() => void>();
    let snapshot = createEmptySnapshot();

    function emit(): void {
        const nextActivities = Array.from(activities.values()).sort(compareContributionOrder);
        const nextPanels = Array.from(panels.values()).sort(compareContributionOrder);
        const nextTabComponents = Array.from(tabComponents.values()).sort((left, right) =>
            left.id.localeCompare(right.id),
        );

        snapshot = {
            activities: nextActivities,
            panels: nextPanels,
            tabComponents: nextTabComponents,
            activityDefinitions: nextActivities.map(toActivityDefinition),
            panelDefinitions: nextPanels.map(toPanelDefinition),
            tabComponentRenderers: buildTabComponentRendererMap(nextTabComponents),
        };

        listeners.forEach((listener) => listener());
    }

    function registerActivity(contribution: WorkbenchActivityContribution): () => void {
        activities.set(contribution.id, contribution);
        emit();

        return () => {
            if (activities.get(contribution.id) !== contribution) {
                return;
            }
            activities.delete(contribution.id);
            emit();
        };
    }

    function registerPanel(contribution: WorkbenchPanelContribution): () => void {
        panels.set(contribution.id, contribution);
        emit();

        return () => {
            if (panels.get(contribution.id) !== contribution) {
                return;
            }
            panels.delete(contribution.id);
            emit();
        };
    }

    function registerTabComponent(contribution: WorkbenchTabComponentContribution): () => void {
        tabComponents.set(contribution.id, contribution);
        emit();

        return () => {
            if (tabComponents.get(contribution.id) !== contribution) {
                return;
            }
            tabComponents.delete(contribution.id);
            emit();
        };
    }

    function subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }

    function getSnapshot(): WorkbenchRegistrySnapshot {
        return snapshot;
    }

    function getActivitiesSnapshot(): WorkbenchActivityContribution[] {
        return snapshot.activities;
    }

    function getPanelsSnapshot(): WorkbenchPanelContribution[] {
        return snapshot.panels;
    }

    function getTabComponentsSnapshot(): WorkbenchTabComponentContribution[] {
        return snapshot.tabComponents;
    }

    function getActivityById(activityId: string): WorkbenchActivityContribution | undefined {
        return activities.get(activityId);
    }

    function getPanelById(panelId: string): WorkbenchPanelContribution | undefined {
        return panels.get(panelId);
    }

    function getTabComponentById(componentId: string): WorkbenchTabComponentContribution | undefined {
        return tabComponents.get(componentId);
    }

    function useActivityDefinitions(): WorkbenchActivityDefinition[] {
        return useSyncExternalStore(
            subscribe,
            () => snapshot.activityDefinitions,
            () => snapshot.activityDefinitions,
        );
    }

    function usePanelDefinitions(): WorkbenchPanelDefinition[] {
        return useSyncExternalStore(
            subscribe,
            () => snapshot.panelDefinitions,
            () => snapshot.panelDefinitions,
        );
    }

    function useTabComponentRenderers(): Record<string, WorkbenchTabRenderer> {
        return useSyncExternalStore(
            subscribe,
            () => snapshot.tabComponentRenderers,
            () => snapshot.tabComponentRenderers,
        );
    }

    return {
        registerActivity,
        registerPanel,
        registerTabComponent,
        subscribe,
        getSnapshot,
        getActivitiesSnapshot,
        getPanelsSnapshot,
        getTabComponentsSnapshot,
        getActivityById,
        getPanelById,
        getTabComponentById,
        useActivityDefinitions,
        usePanelDefinitions,
        useTabComponentRenderers,
    };
}
