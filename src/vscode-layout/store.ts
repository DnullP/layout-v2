/**
 * @module host/layout-v2/vscode-layout/store
 * @description VSCode 风格布局的统一状态导出层。
 *   该模块将布局树、activity bar、tab section、panel section 四类状态收敛到一个统一 store 中，
 *   对外暴露稳定的创建、订阅和命令式操控接口，避免接入方直接组合内部 reducer 与纯模型。
 */

import { useSyncExternalStore } from "react";
import {
    createActivityBarState,
    getActivityBarById,
    insertActivityBarIcon,
    moveActivityBarIcon,
    removeActivityBarIcon,
    selectActivityBarIcon,
    updateActivityBarIconMetadata,
    updateActivityBarMetadata,
    type ActivityBarIconDefinition,
    type ActivityBarIconMove,
    type ActivityBarsState,
    type ActivityBarStateItem,
} from "../activity-bar/activityBarModel";
import {
    createPanelSectionsState,
    focusPanelSectionPanel,
    getPanelSectionById,
    insertPanelSectionPanel,
    movePanelSectionPanel,
    removePanelSection,
    removePanelSectionPanel,
    setPanelSectionCollapsed,
    updatePanelMetadata,
    updatePanelSectionMetadata,
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
    updateSectionMetadata,
    updateSectionTree,
    type SectionNode,
    type SectionSplitDirection,
    type SplitSectionOptions,
} from "../section/layoutModel";
import {
    closeTabSectionTab,
    createTabSectionsState,
    focusTabSectionTab,
    getTabSectionById,
    moveTabSectionTab,
    removeTabSection,
    updateTabMetadata,
    updateTabSectionMetadata,
    upsertTabSection,
    type TabSectionStateItem,
    type TabSectionsState,
    type TabSectionTabMove,
} from "../tab-section/tabSectionModel";
import {
    type LayoutHostMetadata,
    type LayoutHostMetadataUpdater,
} from "../hostMetadata";

export interface VSCodeLayoutWorkbenchState {
    activeGroupId: string | null;
}

export interface VSCodeLayoutGroup {
    id: string;
    tabSectionId: string;
    meta?: LayoutHostMetadata;
}

export interface VSCodeLayoutMoveTabAcrossGroups {
    sourceGroupId: string;
    targetGroupId: string;
    tabId: string;
    targetIndex: number;
}

export interface VSCodeLayoutState<T> {
    root: SectionNode<T>;
    activityBars: ActivityBarsState;
    tabSections: TabSectionsState;
    panelSections: PanelSectionsState;
    workbench?: VSCodeLayoutWorkbenchState;
}

export interface CreateVSCodeLayoutStateOptions<T> {
    root: SectionNode<T>;
    activityBars?: ActivityBarsState | ActivityBarStateItem[];
    tabSections?: TabSectionsState | TabSectionStateItem[];
    panelSections?: PanelSectionsState | PanelSectionStateItem[];
    workbench?: VSCodeLayoutWorkbenchState;
}

export interface CreateVSCodeLayoutStoreOptions<T> {
    initialState: VSCodeLayoutState<T>;
}

export interface VSCodeLayoutCommandOptions {
    reason?: string;
    metadata?: LayoutHostMetadata;
}

export type VSCodeLayoutSnapshotVersion = number | string;

export interface VSCodeLayoutSnapshot<T> {
    version: VSCodeLayoutSnapshotVersion;
    metadata?: LayoutHostMetadata;
    state: VSCodeLayoutState<T>;
}

export interface ExportVSCodeLayoutSnapshotOptions {
    version?: VSCodeLayoutSnapshotVersion;
    metadata?: LayoutHostMetadata;
}

export interface ImportVSCodeLayoutSnapshotOptions<T> {
    version?: VSCodeLayoutSnapshotVersion;
    migrateSnapshot?: (
        snapshot: VSCodeLayoutSnapshot<T>,
    ) => VSCodeLayoutSnapshot<T>;
}

export type VSCodeLayoutStoreListener = () => void;

export type VSCodeLayoutCommandName =
    | "replace-state"
    | "update-state"
    | "import-snapshot"
    | "split-section"
    | "destroy-section"
    | "resize-section"
    | "update-section"
    | "update-section-metadata"
    | "reset-layout"
    | "set-active-group"
    | "move-tab-across-groups"
    | "reset-workbench"
    | "select-activity-icon"
    | "insert-activity-icon"
    | "remove-activity-icon"
    | "move-activity-icon"
    | "update-activity-bar-metadata"
    | "update-activity-icon-metadata"
    | "reset-activity-bars"
    | "focus-tab"
    | "close-tab"
    | "move-tab"
    | "upsert-tab-section"
    | "remove-tab-section"
    | "update-tab-section-metadata"
    | "update-tab-metadata"
    | "reset-tab-sections"
    | "focus-panel"
    | "move-panel"
    | "insert-panel"
    | "remove-panel"
    | "set-panel-collapsed"
    | "upsert-panel-section"
    | "remove-panel-section"
    | "update-panel-section-metadata"
    | "update-panel-metadata"
    | "reset-panel-sections";

export interface VSCodeLayoutLifecycleEvent<T> {
    phase: "before" | "after";
    command: VSCodeLayoutCommandName;
    payload: unknown;
    state: VSCodeLayoutState<T>;
    nextState: VSCodeLayoutState<T>;
    changed: boolean;
    reason?: string;
    metadata?: LayoutHostMetadata;
}

export type VSCodeLayoutLifecycleHook<T> = (
    event: VSCodeLayoutLifecycleEvent<T>,
) => void;

export interface VSCodeLayoutStore<T> {
    getState: () => VSCodeLayoutState<T>;
    getWorkbench: () => VSCodeLayoutWorkbenchState;
    subscribe: (listener: VSCodeLayoutStoreListener) => () => void;
    addLifecycleHook: (hook: VSCodeLayoutLifecycleHook<T>) => () => void;
    replaceState: (
        nextState: VSCodeLayoutState<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateState: (
        updater: (state: VSCodeLayoutState<T>) => VSCodeLayoutState<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    exportSnapshot: (options?: ExportVSCodeLayoutSnapshotOptions) => VSCodeLayoutSnapshot<T>;
    importSnapshot: (
        snapshot: VSCodeLayoutSnapshot<T>,
        options?: ImportVSCodeLayoutSnapshotOptions<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    migrateSnapshot: (
        snapshot: VSCodeLayoutSnapshot<T>,
        migrateSnapshot: (snapshot: VSCodeLayoutSnapshot<T>) => VSCodeLayoutSnapshot<T>,
    ) => VSCodeLayoutSnapshot<T>;
    getSection: (sectionId: string) => SectionNode<T> | null;
    getActivityBar: (barId: string) => ActivityBarStateItem | null;
    getTabSection: (sectionId: string) => TabSectionStateItem | null;
    getPanelSection: (sectionId: string) => PanelSectionStateItem | null;
    listGroups: () => VSCodeLayoutGroup[];
    getGroup: (groupId: string) => VSCodeLayoutGroup | null;
    getActiveGroup: () => VSCodeLayoutGroup | null;
    splitSection: (
        sectionId: string,
        direction: SectionSplitDirection,
        options: SplitSectionOptions<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    destroySection: (sectionId: string, commandOptions?: VSCodeLayoutCommandOptions) => void;
    resizeSection: (
        sectionId: string,
        ratio: number,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateSection: (
        sectionId: string,
        updater: (section: SectionNode<T>) => SectionNode<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateSectionMetadata: (
        sectionId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    resetLayout: (nextRoot: SectionNode<T>, commandOptions?: VSCodeLayoutCommandOptions) => void;
    setActiveGroup: (groupId: string, commandOptions?: VSCodeLayoutCommandOptions) => void;
    moveTabAcrossGroups: (
        move: VSCodeLayoutMoveTabAcrossGroups,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    resetWorkbench: (
        nextWorkbench: VSCodeLayoutWorkbenchState,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    selectActivityIcon: (
        barId: string,
        iconId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    insertActivityIcon: (
        barId: string,
        icon: ActivityBarIconDefinition,
        targetIndex: number,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    removeActivityIcon: (
        barId: string,
        iconId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    moveActivityIcon: (
        move: ActivityBarIconMove,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateActivityBarMetadata: (
        barId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateActivityIconMetadata: (
        barId: string,
        iconId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    resetActivityBars: (
        nextState: ActivityBarsState,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    focusTab: (
        sectionId: string,
        tabId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    closeTab: (
        sectionId: string,
        tabId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    moveTab: (
        move: TabSectionTabMove,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    upsertTabSection: (
        section: TabSectionStateItem,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    removeTabSection: (
        sectionId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateTabSectionMetadata: (
        sectionId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updateTabMetadata: (
        sectionId: string,
        tabId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    resetTabSections: (
        nextState: TabSectionsState,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    focusPanel: (
        sectionId: string,
        panelId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    movePanel: (
        move: PanelSectionPanelMove,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    insertPanel: (
        sectionId: string,
        panel: PanelSectionPanelDefinition,
        targetIndex: number,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    removePanel: (
        sectionId: string,
        panelId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    setPanelCollapsed: (
        sectionId: string,
        isCollapsed: boolean,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    upsertPanelSection: (
        section: PanelSectionStateItem,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    removePanelSection: (
        sectionId: string,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updatePanelSectionMetadata: (
        sectionId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    updatePanelMetadata: (
        sectionId: string,
        panelId: string,
        updater: LayoutHostMetadataUpdater,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
    resetPanelSections: (
        nextState: PanelSectionsState,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => void;
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

function listGroupsFromState<T>(state: VSCodeLayoutState<T>): VSCodeLayoutGroup[] {
    return Object.values(state.tabSections.sections).map((section) => ({
        id: section.id,
        tabSectionId: section.id,
        meta: section.meta,
    }));
}

function normalizeWorkbenchState<T>(
    input: VSCodeLayoutWorkbenchState | undefined,
    state: VSCodeLayoutState<T>,
): VSCodeLayoutWorkbenchState {
    const groups = listGroupsFromState(state);
    const fallbackGroupId = groups[0]?.id ?? null;
    const nextActiveGroupId = groups.some((group) => group.id === input?.activeGroupId)
        ? input?.activeGroupId ?? null
        : fallbackGroupId;

    if (input && input.activeGroupId === nextActiveGroupId) {
        return input;
    }

    return {
        activeGroupId: nextActiveGroupId,
    };
}

function normalizeLayoutState<T>(state: VSCodeLayoutState<T>): VSCodeLayoutState<T> {
    const nextWorkbench = normalizeWorkbenchState(state.workbench, state);
    if (state.workbench === nextWorkbench) {
        return state;
    }

    return {
        ...state,
        workbench: nextWorkbench,
    };
}

export function createVSCodeLayoutState<T>(
    options: CreateVSCodeLayoutStateOptions<T>,
): VSCodeLayoutState<T> {
    return normalizeLayoutState({
        root: options.root,
        activityBars: normalizeActivityBarsState(options.activityBars),
        tabSections: normalizeTabSectionsState(options.tabSections),
        panelSections: normalizePanelSectionsState(options.panelSections),
        workbench: options.workbench,
    });
}

export function exportVSCodeLayoutSnapshot<T>(
    state: VSCodeLayoutState<T>,
    options: ExportVSCodeLayoutSnapshotOptions = {},
): VSCodeLayoutSnapshot<T> {
    return {
        version: options.version ?? 1,
        metadata: options.metadata,
        state: normalizeLayoutState(state),
    };
}

export function migrateVSCodeLayoutSnapshot<T>(
    snapshot: VSCodeLayoutSnapshot<T>,
    migrateSnapshot: (snapshot: VSCodeLayoutSnapshot<T>) => VSCodeLayoutSnapshot<T>,
): VSCodeLayoutSnapshot<T> {
    const migratedSnapshot = migrateSnapshot(snapshot);
    return {
        ...migratedSnapshot,
        state: normalizeLayoutState(migratedSnapshot.state),
    };
}

export function importVSCodeLayoutSnapshot<T>(
    snapshot: VSCodeLayoutSnapshot<T>,
    options: ImportVSCodeLayoutSnapshotOptions<T> = {},
): VSCodeLayoutState<T> {
    const nextSnapshot = options.migrateSnapshot
        ? migrateVSCodeLayoutSnapshot(snapshot, options.migrateSnapshot)
        : snapshot;

    if (
        options.version !== undefined &&
        nextSnapshot.version !== options.version
    ) {
        throw new Error(
            `[layout-v2] snapshot version mismatch: expected ${options.version}, received ${nextSnapshot.version}`,
        );
    }

    return normalizeLayoutState(nextSnapshot.state);
}

export function createVSCodeLayoutStore<T>(
    options: CreateVSCodeLayoutStoreOptions<T>,
): VSCodeLayoutStore<T> {
    let state = normalizeLayoutState(options.initialState);
    const listeners = new Set<VSCodeLayoutStoreListener>();
    const lifecycleHooks = new Set<VSCodeLayoutLifecycleHook<T>>();

    const emitLifecycleEvent = (event: VSCodeLayoutLifecycleEvent<T>) => {
        lifecycleHooks.forEach((hook) => {
            try {
                hook(event);
            } catch (error) {
                console.error("[layout-v2] lifecycle hook failed", {
                    command: event.command,
                    phase: event.phase,
                    error,
                });
            }
        });
    };

    const commit = (nextState: VSCodeLayoutState<T>): boolean => {
        const normalizedState = normalizeLayoutState(nextState);
        if (normalizedState === state) {
            return false;
        }

        state = normalizedState;
        listeners.forEach((listener) => listener());
        return true;
    };

    const runCommand = (
        command: VSCodeLayoutCommandName,
        payload: unknown,
        updater: (currentState: VSCodeLayoutState<T>) => VSCodeLayoutState<T>,
        commandOptions?: VSCodeLayoutCommandOptions,
    ) => {
        const currentState = state;
        const nextState = normalizeLayoutState(updater(currentState));
        const changed = nextState !== currentState;

        emitLifecycleEvent({
            phase: "before",
            command,
            payload,
            state: currentState,
            nextState,
            changed,
            reason: commandOptions?.reason,
            metadata: commandOptions?.metadata,
        });

        if (changed) {
            commit(nextState);
        }

        emitLifecycleEvent({
            phase: "after",
            command,
            payload,
            state: currentState,
            nextState,
            changed,
            reason: commandOptions?.reason,
            metadata: commandOptions?.metadata,
        });
    };

    const getGroupFromState = (groupId: string): VSCodeLayoutGroup | null => {
        return listGroupsFromState(state).find((group) => group.id === groupId) ?? null;
    };

    return {
        getState: () => state,
        getWorkbench: () => state.workbench ?? normalizeWorkbenchState(undefined, state),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        addLifecycleHook: (hook) => {
            lifecycleHooks.add(hook);
            return () => {
                lifecycleHooks.delete(hook);
            };
        },
        replaceState: (nextState, commandOptions) => {
            runCommand("replace-state", { nextState }, () => nextState, commandOptions);
        },
        updateState: (updater, commandOptions) => {
            runCommand("update-state", { updater }, updater, commandOptions);
        },
        exportSnapshot: (snapshotOptions) => exportVSCodeLayoutSnapshot(state, snapshotOptions),
        importSnapshot: (snapshot, snapshotOptions, commandOptions) => {
            runCommand(
                "import-snapshot",
                { snapshot, snapshotOptions },
                () => importVSCodeLayoutSnapshot(snapshot, snapshotOptions),
                commandOptions,
            );
        },
        migrateSnapshot: (snapshot, migrateSnapshot) => {
            return migrateVSCodeLayoutSnapshot(snapshot, migrateSnapshot);
        },
        getSection: (sectionId) => findSectionNode(state.root, sectionId),
        getActivityBar: (barId) => getActivityBarById(state.activityBars, barId),
        getTabSection: (sectionId) => getTabSectionById(state.tabSections, sectionId),
        getPanelSection: (sectionId) => getPanelSectionById(state.panelSections, sectionId),
        listGroups: () => listGroupsFromState(state),
        getGroup: (groupId) => getGroupFromState(groupId),
        getActiveGroup: () => {
            const activeGroupId = (state.workbench ?? normalizeWorkbenchState(undefined, state)).activeGroupId;
            return activeGroupId ? getGroupFromState(activeGroupId) : null;
        },
        splitSection: (sectionId, direction, splitOptions, commandOptions) => {
            runCommand(
                "split-section",
                { sectionId, direction, options: splitOptions },
                (currentState) => ({
                    ...currentState,
                    root: splitSectionTree(currentState.root, sectionId, direction, splitOptions),
                }),
                commandOptions,
            );
        },
        destroySection: (sectionId, commandOptions) => {
            runCommand(
                "destroy-section",
                { sectionId },
                (currentState) => ({
                    ...currentState,
                    root: destroySectionTree(currentState.root, sectionId),
                }),
                commandOptions,
            );
        },
        resizeSection: (sectionId, ratio, commandOptions) => {
            runCommand(
                "resize-section",
                { sectionId, ratio },
                (currentState) => ({
                    ...currentState,
                    root: resizeSectionSplit(currentState.root, sectionId, ratio),
                }),
                commandOptions,
            );
        },
        updateSection: (sectionId, updater, commandOptions) => {
            runCommand(
                "update-section",
                { sectionId, updater },
                (currentState) => ({
                    ...currentState,
                    root: updateSectionTree(currentState.root, sectionId, updater),
                }),
                commandOptions,
            );
        },
        updateSectionMetadata: (sectionId, updater, commandOptions) => {
            runCommand(
                "update-section-metadata",
                { sectionId, updater },
                (currentState) => ({
                    ...currentState,
                    root: updateSectionMetadata(currentState.root, sectionId, updater),
                }),
                commandOptions,
            );
        },
        resetLayout: (nextRoot, commandOptions) => {
            runCommand(
                "reset-layout",
                { nextRoot },
                (currentState) => ({
                    ...currentState,
                    root: nextRoot,
                }),
                commandOptions,
            );
        },
        setActiveGroup: (groupId, commandOptions) => {
            runCommand(
                "set-active-group",
                { groupId },
                (currentState) => {
                    if (!listGroupsFromState(currentState).some((group) => group.id === groupId)) {
                        return currentState;
                    }

                    if (currentState.workbench?.activeGroupId === groupId) {
                        return currentState;
                    }

                    return {
                        ...currentState,
                        workbench: {
                            activeGroupId: groupId,
                        },
                    };
                },
                commandOptions,
            );
        },
        moveTabAcrossGroups: (move, commandOptions) => {
            runCommand(
                "move-tab-across-groups",
                move,
                (currentState) => {
                    const sourceGroup = listGroupsFromState(currentState).find(
                        (group) => group.id === move.sourceGroupId,
                    );
                    const targetGroup = listGroupsFromState(currentState).find(
                        (group) => group.id === move.targetGroupId,
                    );

                    if (!sourceGroup || !targetGroup) {
                        return currentState;
                    }

                    const nextTabSections = moveTabSectionTab(currentState.tabSections, {
                        sourceSectionId: sourceGroup.tabSectionId,
                        targetSectionId: targetGroup.tabSectionId,
                        tabId: move.tabId,
                        targetIndex: move.targetIndex,
                    });

                    if (
                        nextTabSections === currentState.tabSections &&
                        currentState.workbench?.activeGroupId === targetGroup.id
                    ) {
                        return currentState;
                    }

                    return {
                        ...currentState,
                        tabSections: nextTabSections,
                        workbench: {
                            activeGroupId: targetGroup.id,
                        },
                    };
                },
                commandOptions,
            );
        },
        resetWorkbench: (nextWorkbench, commandOptions) => {
            runCommand(
                "reset-workbench",
                { nextWorkbench },
                (currentState) => ({
                    ...currentState,
                    workbench: nextWorkbench,
                }),
                commandOptions,
            );
        },
        selectActivityIcon: (barId, iconId, commandOptions) => {
            runCommand(
                "select-activity-icon",
                { barId, iconId },
                (currentState) => ({
                    ...currentState,
                    activityBars: selectActivityBarIcon(currentState.activityBars, barId, iconId),
                }),
                commandOptions,
            );
        },
        insertActivityIcon: (barId, icon, targetIndex, commandOptions) => {
            runCommand(
                "insert-activity-icon",
                { barId, icon, targetIndex },
                (currentState) => ({
                    ...currentState,
                    activityBars: insertActivityBarIcon(currentState.activityBars, barId, icon, targetIndex),
                }),
                commandOptions,
            );
        },
        removeActivityIcon: (barId, iconId, commandOptions) => {
            runCommand(
                "remove-activity-icon",
                { barId, iconId },
                (currentState) => ({
                    ...currentState,
                    activityBars: removeActivityBarIcon(currentState.activityBars, barId, iconId),
                }),
                commandOptions,
            );
        },
        moveActivityIcon: (move, commandOptions) => {
            runCommand(
                "move-activity-icon",
                move,
                (currentState) => ({
                    ...currentState,
                    activityBars: moveActivityBarIcon(currentState.activityBars, move),
                }),
                commandOptions,
            );
        },
        updateActivityBarMetadata: (barId, updater, commandOptions) => {
            runCommand(
                "update-activity-bar-metadata",
                { barId, updater },
                (currentState) => ({
                    ...currentState,
                    activityBars: updateActivityBarMetadata(currentState.activityBars, barId, updater),
                }),
                commandOptions,
            );
        },
        updateActivityIconMetadata: (barId, iconId, updater, commandOptions) => {
            runCommand(
                "update-activity-icon-metadata",
                { barId, iconId, updater },
                (currentState) => ({
                    ...currentState,
                    activityBars: updateActivityBarIconMetadata(currentState.activityBars, barId, iconId, updater),
                }),
                commandOptions,
            );
        },
        resetActivityBars: (nextState, commandOptions) => {
            runCommand(
                "reset-activity-bars",
                { nextState },
                (currentState) => ({
                    ...currentState,
                    activityBars: nextState,
                }),
                commandOptions,
            );
        },
        focusTab: (sectionId, tabId, commandOptions) => {
            runCommand(
                "focus-tab",
                { sectionId, tabId },
                (currentState) => ({
                    ...currentState,
                    tabSections: focusTabSectionTab(currentState.tabSections, sectionId, tabId),
                }),
                commandOptions,
            );
        },
        closeTab: (sectionId, tabId, commandOptions) => {
            runCommand(
                "close-tab",
                { sectionId, tabId },
                (currentState) => ({
                    ...currentState,
                    tabSections: closeTabSectionTab(currentState.tabSections, sectionId, tabId),
                }),
                commandOptions,
            );
        },
        moveTab: (move, commandOptions) => {
            runCommand(
                "move-tab",
                move,
                (currentState) => ({
                    ...currentState,
                    tabSections: moveTabSectionTab(currentState.tabSections, move),
                }),
                commandOptions,
            );
        },
        upsertTabSection: (section, commandOptions) => {
            runCommand(
                "upsert-tab-section",
                { section },
                (currentState) => ({
                    ...currentState,
                    tabSections: upsertTabSection(currentState.tabSections, section),
                }),
                commandOptions,
            );
        },
        removeTabSection: (sectionId, commandOptions) => {
            runCommand(
                "remove-tab-section",
                { sectionId },
                (currentState) => ({
                    ...currentState,
                    tabSections: removeTabSection(currentState.tabSections, sectionId),
                }),
                commandOptions,
            );
        },
        updateTabSectionMetadata: (sectionId, updater, commandOptions) => {
            runCommand(
                "update-tab-section-metadata",
                { sectionId, updater },
                (currentState) => ({
                    ...currentState,
                    tabSections: updateTabSectionMetadata(currentState.tabSections, sectionId, updater),
                }),
                commandOptions,
            );
        },
        updateTabMetadata: (sectionId, tabId, updater, commandOptions) => {
            runCommand(
                "update-tab-metadata",
                { sectionId, tabId, updater },
                (currentState) => ({
                    ...currentState,
                    tabSections: updateTabMetadata(currentState.tabSections, sectionId, tabId, updater),
                }),
                commandOptions,
            );
        },
        resetTabSections: (nextState, commandOptions) => {
            runCommand(
                "reset-tab-sections",
                { nextState },
                (currentState) => ({
                    ...currentState,
                    tabSections: nextState,
                }),
                commandOptions,
            );
        },
        focusPanel: (sectionId, panelId, commandOptions) => {
            runCommand(
                "focus-panel",
                { sectionId, panelId },
                (currentState) => ({
                    ...currentState,
                    panelSections: focusPanelSectionPanel(currentState.panelSections, sectionId, panelId),
                }),
                commandOptions,
            );
        },
        movePanel: (move, commandOptions) => {
            runCommand(
                "move-panel",
                move,
                (currentState) => ({
                    ...currentState,
                    panelSections: movePanelSectionPanel(currentState.panelSections, move),
                }),
                commandOptions,
            );
        },
        insertPanel: (sectionId, panel, targetIndex, commandOptions) => {
            runCommand(
                "insert-panel",
                { sectionId, panel, targetIndex },
                (currentState) => ({
                    ...currentState,
                    panelSections: insertPanelSectionPanel(currentState.panelSections, sectionId, panel, targetIndex),
                }),
                commandOptions,
            );
        },
        removePanel: (sectionId, panelId, commandOptions) => {
            runCommand(
                "remove-panel",
                { sectionId, panelId },
                (currentState) => ({
                    ...currentState,
                    panelSections: removePanelSectionPanel(currentState.panelSections, sectionId, panelId),
                }),
                commandOptions,
            );
        },
        setPanelCollapsed: (sectionId, isCollapsed, commandOptions) => {
            runCommand(
                "set-panel-collapsed",
                { sectionId, isCollapsed },
                (currentState) => ({
                    ...currentState,
                    panelSections: setPanelSectionCollapsed(currentState.panelSections, sectionId, isCollapsed),
                }),
                commandOptions,
            );
        },
        upsertPanelSection: (section, commandOptions) => {
            runCommand(
                "upsert-panel-section",
                { section },
                (currentState) => ({
                    ...currentState,
                    panelSections: upsertPanelSection(currentState.panelSections, section),
                }),
                commandOptions,
            );
        },
        removePanelSection: (sectionId, commandOptions) => {
            runCommand(
                "remove-panel-section",
                { sectionId },
                (currentState) => ({
                    ...currentState,
                    panelSections: removePanelSection(currentState.panelSections, sectionId),
                }),
                commandOptions,
            );
        },
        updatePanelSectionMetadata: (sectionId, updater, commandOptions) => {
            runCommand(
                "update-panel-section-metadata",
                { sectionId, updater },
                (currentState) => ({
                    ...currentState,
                    panelSections: updatePanelSectionMetadata(currentState.panelSections, sectionId, updater),
                }),
                commandOptions,
            );
        },
        updatePanelMetadata: (sectionId, panelId, updater, commandOptions) => {
            runCommand(
                "update-panel-metadata",
                { sectionId, panelId, updater },
                (currentState) => ({
                    ...currentState,
                    panelSections: updatePanelMetadata(currentState.panelSections, sectionId, panelId, updater),
                }),
                commandOptions,
            );
        },
        resetPanelSections: (nextState, commandOptions) => {
            runCommand(
                "reset-panel-sections",
                { nextState },
                (currentState) => ({
                    ...currentState,
                    panelSections: nextState,
                }),
                commandOptions,
            );
        },
    };
}

export function useVSCodeLayoutStoreState<T>(store: VSCodeLayoutStore<T>): VSCodeLayoutState<T> {
    return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}