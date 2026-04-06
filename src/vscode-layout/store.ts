/**
 * @module host/layout-v2/vscode-layout/store
 * @description VSCode 风格布局的统一状态导出层。
 *   该模块将布局树、activity bar、tab section、panel section 四类状态收敛到一个统一 store 中，
 *   对外暴露稳定的创建、订阅和命令式操控接口，避免接入方直接组合内部 reducer 与纯模型。
 */

import { useSyncExternalStore } from "react";
import {
    getActivityBarById,
    createActivityBarState,
    insertActivityBarIcon,
    moveActivityBarIcon,
    removeActivityBarIcon,
    selectActivityBarIcon,
    type ActivityBarIconDefinition,
    type ActivityBarIconMove,
    type ActivityBarsState,
    type ActivityBarStateItem,
} from "../activity-bar/activityBarModel";
import {
    closeTabSectionTab,
    createTabSectionsState,
    focusTabSectionTab,
    getTabSectionById,
    moveTabSectionTab,
    removeTabSection,
    upsertTabSection,
    type TabSectionStateItem,
    type TabSectionsState,
    type TabSectionTabMove,
} from "../tab-section/tabSectionModel";
import {
    createPanelSectionsState,
    focusPanelSectionPanel,
    getPanelSectionById,
    insertPanelSectionPanel,
    movePanelSectionPanel,
    removePanelSection,
    removePanelSectionPanel,
    setPanelSectionCollapsed,
    upsertPanelSection,
    type PanelSectionPanelDefinition,
    type PanelSectionPanelMove,
    type PanelSectionStateItem,
    type PanelSectionsState,
} from "../panel-section/panelSectionModel";
import {
    destroySectionTree,
    findSectionNode,
    resizeSectionSplit,
    splitSectionTree,
    updateSectionTree,
    type SectionNode,
    type SectionSplitDirection,
    type SplitSectionOptions,
} from "../section/layoutModel";

export interface VSCodeLayoutState<T> {
    root: SectionNode<T>;
    activityBars: ActivityBarsState;
    tabSections: TabSectionsState;
    panelSections: PanelSectionsState;
}

export interface CreateVSCodeLayoutStateOptions<T> {
    root: SectionNode<T>;
    activityBars?: ActivityBarsState | ActivityBarStateItem[];
    tabSections?: TabSectionsState | TabSectionStateItem[];
    panelSections?: PanelSectionsState | PanelSectionStateItem[];
}

export interface CreateVSCodeLayoutStoreOptions<T> {
    initialState: VSCodeLayoutState<T>;
}

export type VSCodeLayoutStoreListener = () => void;

export interface VSCodeLayoutStore<T> {
    getState: () => VSCodeLayoutState<T>;
    subscribe: (listener: VSCodeLayoutStoreListener) => () => void;
    replaceState: (nextState: VSCodeLayoutState<T>) => void;
    updateState: (updater: (state: VSCodeLayoutState<T>) => VSCodeLayoutState<T>) => void;
    getSection: (sectionId: string) => SectionNode<T> | null;
    getActivityBar: (barId: string) => ActivityBarStateItem | null;
    getTabSection: (sectionId: string) => TabSectionStateItem | null;
    getPanelSection: (sectionId: string) => PanelSectionStateItem | null;
    splitSection: (
        sectionId: string,
        direction: SectionSplitDirection,
        options: SplitSectionOptions<T>,
    ) => void;
    destroySection: (sectionId: string) => void;
    resizeSection: (sectionId: string, ratio: number) => void;
    updateSection: (
        sectionId: string,
        updater: (section: SectionNode<T>) => SectionNode<T>,
    ) => void;
    resetLayout: (nextRoot: SectionNode<T>) => void;
    selectActivityIcon: (barId: string, iconId: string) => void;
    insertActivityIcon: (barId: string, icon: ActivityBarIconDefinition, targetIndex: number) => void;
    removeActivityIcon: (barId: string, iconId: string) => void;
    moveActivityIcon: (move: ActivityBarIconMove) => void;
    resetActivityBars: (nextState: ActivityBarsState) => void;
    focusTab: (sectionId: string, tabId: string) => void;
    closeTab: (sectionId: string, tabId: string) => void;
    moveTab: (move: TabSectionTabMove) => void;
    upsertTabSection: (section: TabSectionStateItem) => void;
    removeTabSection: (sectionId: string) => void;
    resetTabSections: (nextState: TabSectionsState) => void;
    focusPanel: (sectionId: string, panelId: string) => void;
    movePanel: (move: PanelSectionPanelMove) => void;
    insertPanel: (sectionId: string, panel: PanelSectionPanelDefinition, targetIndex: number) => void;
    removePanel: (sectionId: string, panelId: string) => void;
    setPanelCollapsed: (sectionId: string, isCollapsed: boolean) => void;
    upsertPanelSection: (section: PanelSectionStateItem) => void;
    removePanelSection: (sectionId: string) => void;
    resetPanelSections: (nextState: PanelSectionsState) => void;
}

function normalizeActivityBarsState(
    input?: ActivityBarsState | ActivityBarStateItem[],
): ActivityBarsState {
    if (!input) {
        return createActivityBarState([]);
    }

    return Array.isArray(input) ? createActivityBarState(input) : input;
}

function normalizeTabSectionsState(
    input?: TabSectionsState | TabSectionStateItem[],
): TabSectionsState {
    if (!input) {
        return createTabSectionsState([]);
    }

    return Array.isArray(input) ? createTabSectionsState(input) : input;
}

function normalizePanelSectionsState(
    input?: PanelSectionsState | PanelSectionStateItem[],
): PanelSectionsState {
    if (!input) {
        return createPanelSectionsState([]);
    }

    return Array.isArray(input) ? createPanelSectionsState(input) : input;
}

export function createVSCodeLayoutState<T>(
    options: CreateVSCodeLayoutStateOptions<T>,
): VSCodeLayoutState<T> {
    return {
        root: options.root,
        activityBars: normalizeActivityBarsState(options.activityBars),
        tabSections: normalizeTabSectionsState(options.tabSections),
        panelSections: normalizePanelSectionsState(options.panelSections),
    };
}

export function createVSCodeLayoutStore<T>(
    options: CreateVSCodeLayoutStoreOptions<T>,
): VSCodeLayoutStore<T> {
    let state = options.initialState;
    const listeners = new Set<VSCodeLayoutStoreListener>();

    const commit = (nextState: VSCodeLayoutState<T>) => {
        if (nextState === state) {
            return;
        }

        state = nextState;
        listeners.forEach((listener) => listener());
    };

    const updateRoot = (nextRoot: SectionNode<T>) => {
        commit({
            ...state,
            root: nextRoot,
        });
    };

    const updateActivityBars = (nextActivityBars: ActivityBarsState) => {
        commit({
            ...state,
            activityBars: nextActivityBars,
        });
    };

    const updateTabSections = (nextTabSections: TabSectionsState) => {
        commit({
            ...state,
            tabSections: nextTabSections,
        });
    };

    const updatePanelSections = (nextPanelSections: PanelSectionsState) => {
        commit({
            ...state,
            panelSections: nextPanelSections,
        });
    };

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        replaceState: (nextState) => {
            commit(nextState);
        },
        updateState: (updater) => {
            commit(updater(state));
        },
        getSection: (sectionId) => findSectionNode(state.root, sectionId),
        getActivityBar: (barId) => getActivityBarById(state.activityBars, barId),
        getTabSection: (sectionId) => getTabSectionById(state.tabSections, sectionId),
        getPanelSection: (sectionId) => getPanelSectionById(state.panelSections, sectionId),
        splitSection: (sectionId, direction, options) => {
            updateRoot(splitSectionTree(state.root, sectionId, direction, options));
        },
        destroySection: (sectionId) => {
            updateRoot(destroySectionTree(state.root, sectionId));
        },
        resizeSection: (sectionId, ratio) => {
            updateRoot(resizeSectionSplit(state.root, sectionId, ratio));
        },
        updateSection: (sectionId, updater) => {
            updateRoot(updateSectionTree(state.root, sectionId, updater));
        },
        resetLayout: (nextRoot) => {
            updateRoot(nextRoot);
        },
        selectActivityIcon: (barId, iconId) => {
            updateActivityBars(selectActivityBarIcon(state.activityBars, barId, iconId));
        },
        insertActivityIcon: (barId, icon, targetIndex) => {
            updateActivityBars(insertActivityBarIcon(state.activityBars, barId, icon, targetIndex));
        },
        removeActivityIcon: (barId, iconId) => {
            updateActivityBars(removeActivityBarIcon(state.activityBars, barId, iconId));
        },
        moveActivityIcon: (move) => {
            updateActivityBars(moveActivityBarIcon(state.activityBars, move));
        },
        resetActivityBars: (nextState) => {
            updateActivityBars(nextState);
        },
        focusTab: (sectionId, tabId) => {
            updateTabSections(focusTabSectionTab(state.tabSections, sectionId, tabId));
        },
        closeTab: (sectionId, tabId) => {
            updateTabSections(closeTabSectionTab(state.tabSections, sectionId, tabId));
        },
        moveTab: (move) => {
            updateTabSections(moveTabSectionTab(state.tabSections, move));
        },
        upsertTabSection: (section) => {
            updateTabSections(upsertTabSection(state.tabSections, section));
        },
        removeTabSection: (sectionId) => {
            updateTabSections(removeTabSection(state.tabSections, sectionId));
        },
        resetTabSections: (nextState) => {
            updateTabSections(nextState);
        },
        focusPanel: (sectionId, panelId) => {
            updatePanelSections(focusPanelSectionPanel(state.panelSections, sectionId, panelId));
        },
        movePanel: (move) => {
            updatePanelSections(movePanelSectionPanel(state.panelSections, move));
        },
        insertPanel: (sectionId, panel, targetIndex) => {
            updatePanelSections(insertPanelSectionPanel(state.panelSections, sectionId, panel, targetIndex));
        },
        removePanel: (sectionId, panelId) => {
            updatePanelSections(removePanelSectionPanel(state.panelSections, sectionId, panelId));
        },
        setPanelCollapsed: (sectionId, isCollapsed) => {
            updatePanelSections(setPanelSectionCollapsed(state.panelSections, sectionId, isCollapsed));
        },
        upsertPanelSection: (section) => {
            updatePanelSections(upsertPanelSection(state.panelSections, section));
        },
        removePanelSection: (sectionId) => {
            updatePanelSections(removePanelSection(state.panelSections, sectionId));
        },
        resetPanelSections: (nextState) => {
            updatePanelSections(nextState);
        },
    };
}

export function useVSCodeLayoutStoreState<T>(store: VSCodeLayoutStore<T>): VSCodeLayoutState<T> {
    return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
