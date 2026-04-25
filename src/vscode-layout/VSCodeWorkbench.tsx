/**
 * @module host/layout-v2/vscode-layout/VSCodeWorkbench
 * @description 高层 VSCode 风格 Workbench 组件。
 *   将 section tree 构建、store 管理、component registry 编排、DnD 逻辑全部内化，
 *   消费方只需提供声明式的 activity / panel / tab 定义和渲染回调。
 */

import {
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type Ref,
} from "react";
import { findSectionNode, isSectionHidden, setSectionHidden, type SectionNode } from "../section/layoutModel";
import { createSectionComponentBinding, createSectionComponentRegistry, getSectionComponentBinding, SectionComponentHost } from "../section/sectionComponent";
import { SectionLayoutView } from "../section/SectionLayoutView";
import { ActivityBar } from "../activity-bar/ActivityBar";
import { ActivityBarDragPreview } from "../activity-bar/ActivityBarDragPreview";
import { type ActivityBarDragSession } from "../activity-bar/activityBarDrag";
import { type ActivityBarIconMove } from "../activity-bar/activityBarModel";
import { PanelSection } from "../panel-section/PanelSection";
import { PanelSectionDragPreview } from "../panel-section/PanelSectionDragPreview";
import {
    applyPanelSectionCollapsedLayout,
    focusPanelSectionWithLayout,
} from "../panel-section/panelSectionLayout";
import {
    isEndedPanelSectionDragSession,
    type PanelSectionDragSession,
    type PanelSectionHoverTarget,
} from "../panel-section/panelSectionDrag";
import { TabSection, TabDragSessionContext } from "../tab-section/TabSection";
import { TabSectionDragPreview } from "../tab-section/TabSectionDragPreview";
import { type TabSectionDragSession } from "../tab-section/tabSectionDrag";
import { type TabSectionTabDefinition, type TabSectionTabMove, type TabSectionsState } from "../tab-section/tabSectionModel";
import { createVSCodeLayoutStore, useVSCodeLayoutStoreState, type VSCodeLayoutState, type VSCodeLayoutStore } from "./store";
import {
    applyTabWorkbenchTabMove,
    buildTabWorkbenchPreviewState,
    commitTabWorkbenchDrop,
    cleanupEmptyTabWorkbenchSections,
    PREVIEW_TAB_SECTION_ID_PREFIX,
    type TabWorkbenchAdapter,
} from "./tabWorkbench";
import {
    buildPanelWorkbenchPreviewState,
    buildActivityBarContentPreviewState,
    commitActivityBarContentDrop,
    cleanupEmptyPanelWorkbenchSections,
    finalizePanelWorkbenchDrop,
    isPanelWorkbenchPreviewLeaf,
    resolvePanelWorkbenchCommittedLeafSectionId,
    type PanelWorkbenchAdapter,
} from "./panelWorkbench";
import {
    type WorkbenchSectionData,
    type WorkbenchTabPayload,
    buildWorkbenchActivityBars,
    buildWorkbenchPanelSections,
    createWorkbenchLayoutState,
    createWorkbenchRootLayout,
    readWorkbenchTabPayload,
    WORKBENCH_MAIN_TAB_SECTION_ID,
    WORKBENCH_LEFT_ACTIVITY_BAR_ID,
    WORKBENCH_LEFT_PANEL_SECTION_ID,
    WORKBENCH_RIGHT_PANEL_SECTION_ID,
} from "./workbenchPreset";
import type { ActivityBarFocusBridge } from "./focusBridge";
import type { PanelSectionFocusBridge } from "./focusBridge";
import type { ActivityBarStateItem } from "../activity-bar/activityBarModel";
import type { PanelSectionStateItem, PanelSectionPanelDefinition } from "../panel-section/panelSectionModel";
import type {
    WorkbenchActivityDefinition,
    WorkbenchApi,
    WorkbenchPanelContext,
    WorkbenchPanelDefinition,
    WorkbenchSidebarState,
    WorkbenchTabApi,
    WorkbenchTabDefinition,
} from "./workbenchTypes";

export interface VSCodeWorkbenchProps {
    /** 声明式 activity 定义列表。 */
    activities?: WorkbenchActivityDefinition[];
    /** 声明式 panel 定义列表。 */
    panels?: WorkbenchPanelDefinition[];
    /** tab component 渲染器表（key 是 component ID）。 */
    tabComponents?: Record<string, (props: { params: Record<string, unknown>; api: WorkbenchTabApi }) => ReactNode>;
    /** 初始打开的 tab 列表。 */
    initialTabs?: WorkbenchTabDefinition[];
    /** 是否启用右侧边栏。 */
    hasRightSidebar?: boolean;
    /** 初始侧边栏状态（用于恢复持久化）。 */
    initialSidebarState?: WorkbenchSidebarState;
    /** 初始 section 分割比例（sectionId → ratio）。 */
    initialSectionRatios?: Record<string, number>;
    /** 空 panel section 是否隐藏 panel bar。 */
    hideEmptyPanelBar?: boolean;
    /** 是否渲染非激活 tab 内容。默认开启以保留通用宿主的缓存行为。 */
    renderInactiveTabContent?: boolean;
    /** 是否在拖拽 tab 时实时渲染 split/merge 预览布局。默认开启；重型 editor 宿主可关闭以避免预览期反复 remount。 */
    renderTabDragPreviewLayout?: boolean;
    /** tab 拖拽预览布局渲染模式。inline 会替换主布局；overlay 会覆盖显示预览但保留已提交布局挂载。 */
    tabDragPreviewRenderMode?: "inline" | "overlay";
    /** 拖拽当前 active tab 时是否保留其内容挂载但隐藏。默认关闭；重型 editor 宿主可开启以避免 drag-start teardown。 */
    preserveActiveTabContentDuringDrag?: boolean;
    /** 是否在新建的 tab split preview section 中渲染真实 tab 内容。默认开启；重型 editor 宿主可关闭，仅保留预览结构和标题。 */
    renderTabContentInDragPreviewLayout?: boolean;

    /** 渲染 activity bar icon。 */
    renderActivityIcon?: (activity: WorkbenchActivityDefinition) => ReactNode;
    /** 渲染 panel 内容。 */
    renderPanelContent?: (panelId: string, context: WorkbenchPanelContext) => ReactNode;
    /** 渲染 tab 标题（默认使用 tab.title）。 */
    renderTabTitle?: (tab: TabSectionTabDefinition) => ReactNode;

    /** activity icon 被激活时的回调（activationMode="action" 时触发）。 */
    onActivateActivity?: (activityId: string, context: WorkbenchPanelContext) => void;
    /** activity icon 被选中时的回调（activationMode="focus" 时触发）。 */
    onSelectActivity?: (activityId: string, bar: "left" | "right") => void;
    /** 侧边栏状态变化回调（用于持久化）。 */
    onSidebarStateChange?: (state: WorkbenchSidebarState) => void;
    /** 活跃 tab 变化回调。 */
    onActiveTabChange?: (tabId: string | null) => void;
    /** tab 关闭回调。 */
    onCloseTab?: (tabId: string) => void;
    /** activity icon 右键菜单回调。 */
    onActivityIconContextMenu?: (iconId: string, event: { clientX: number; clientY: number }) => void;
    /** activity icon 拖拽到面板内容区触发分裂后的回调。 */
    onActivityIconDrop?: (iconId: string, newPanelSectionId: string) => void;
    /** activity bar 空白区域右键菜单回调。 */
    onActivityBarBackgroundContextMenu?: (event: { clientX: number; clientY: number }) => void;
    /** section 分割比例变化回调（用于持久化）。 */
    onSectionRatioChange?: (ratios: Record<string, number>) => void;

    /** 命令式 API ref。 */
    apiRef?: Ref<WorkbenchApi | null>;
    /** 根容器 className。 */
    className?: string;
}

function findTabSectionIdByTabId(sections: TabSectionsState, tabId: string): string | null {
    for (const section of Object.values(sections.sections)) {
        if (section.tabs.some((tab) => tab.id === tabId)) {
            return section.id;
        }
    }
    return null;
}

function resolveActiveTabSectionId(state: VSCodeLayoutState<WorkbenchSectionData>): string | null {
    const preferred = state.workbench?.activeGroupId ?? null;

    if (preferred && state.tabSections.sections[preferred]) {
        return preferred;
    }
    return Object.keys(state.tabSections.sections)[0] ?? null;
}

export function isCloseActiveTabShortcut(
    event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented">,
): boolean {
    if (event.defaultPrevented || event.altKey || event.shiftKey) {
        return false;
    }

    const key = event.key.toLowerCase();
    const isCloseKey = event.code === "KeyW" || key === "w";
    return isCloseKey && (event.metaKey || event.ctrlKey);
}

/**
 * Shallow-compare two panel section items to avoid unnecessary store updates.
 * Returns true when panels list, focusedPanelId, and isCollapsed are identical.
 */
function arePanelSectionsEqual(a: PanelSectionStateItem, b: PanelSectionStateItem): boolean {
    if (a === b) return true;
    if (a.focusedPanelId !== b.focusedPanelId) return false;
    if (a.isCollapsed !== b.isCollapsed) return false;
    if (a.isRoot !== b.isRoot) return false;
    if (a.panels.length !== b.panels.length) return false;
    for (let i = 0; i < a.panels.length; i++) {
        if (a.panels[i].id !== b.panels[i].id) return false;
        if (a.panels[i].label !== b.panels[i].label) return false;
    }
    return true;
}

function reconcileDeclarativePanelSection(
    existing: PanelSectionStateItem | undefined,
    next: PanelSectionStateItem,
): PanelSectionStateItem {
    if (!existing) {
        return next;
    }

    const nextPanelsById = new Map(next.panels.map((panel) => [panel.id, panel]));
    const reconciledPanels: PanelSectionPanelDefinition[] = [];
    const seenPanelIds = new Set<string>();

    for (const panel of existing.panels) {
        const updatedPanel = nextPanelsById.get(panel.id);
        if (!updatedPanel) {
            continue;
        }
        reconciledPanels.push(updatedPanel);
        seenPanelIds.add(panel.id);
    }

    for (const panel of next.panels) {
        if (seenPanelIds.has(panel.id)) {
            continue;
        }
        reconciledPanels.push(panel);
    }

    const focusedPanelId = reconciledPanels.some((panel) => panel.id === next.focusedPanelId)
        ? next.focusedPanelId
        : (reconciledPanels[0]?.id ?? null);

    return {
        ...next,
        panels: reconciledPanels,
        focusedPanelId,
        isCollapsed: existing.isCollapsed,
    };
}

/**
 * Shallow-compare two activity-bars state objects.
 * Returns true when both contain the same bars with the same icons and selection.
 */
function areActivityBarsEqual(
    a: { bars: Record<string, { id: string; icons: Array<{ id: string }>; selectedIconId: string | null }> },
    b: { bars: Record<string, { id: string; icons: Array<{ id: string }>; selectedIconId: string | null }> },
): boolean {
    const aKeys = Object.keys(a.bars);
    const bKeys = Object.keys(b.bars);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        const aBar = a.bars[key];
        const bBar = b.bars[key];
        if (!aBar || !bBar) return false;
        if (aBar.selectedIconId !== bBar.selectedIconId) return false;
        if (aBar.icons.length !== bBar.icons.length) return false;
        for (let i = 0; i < aBar.icons.length; i++) {
            if (aBar.icons[i].id !== bBar.icons[i].id) return false;
        }
    }
    return true;
}

function collectSectionRatios<T>(node: SectionNode<T>): Record<string, number> {
    const ratios: Record<string, number> = {};
    function walk(section: SectionNode<T>): void {
        if (section.split) {
            ratios[section.id] = section.split.ratio;
            walk(section.split.children[0]);
            walk(section.split.children[1]);
        }
    }
    walk(node);
    return ratios;
}

export function closeWorkbenchTabState(
    currentState: VSCodeLayoutState<WorkbenchSectionData>,
    tabId: string,
): {
    nextState: VSCodeLayoutState<WorkbenchSectionData>;
    didClose: boolean;
} {
    const sourceSectionId = findTabSectionIdByTabId(currentState.tabSections, tabId);
    if (!sourceSectionId) {
        return { nextState: currentState, didClose: false };
    }

    const section = currentState.tabSections.sections[sourceSectionId];
    if (!section) {
        return { nextState: currentState, didClose: false };
    }

    const nextTabs = section.tabs.filter((tab) => tab.id !== tabId);
    if (nextTabs.length === section.tabs.length) {
        return { nextState: currentState, didClose: false };
    }

    const nextFocusedTabId = section.focusedTabId === tabId
        ? (nextTabs[nextTabs.length - 1]?.id ?? null)
        : section.focusedTabId;
    const nextSection = { ...section, tabs: nextTabs, focusedTabId: nextFocusedTabId };
    const hasOtherTabSections = Object.keys(currentState.tabSections.sections)
        .some((sectionId) => sectionId !== sourceSectionId);

    if (nextTabs.length === 0 && !hasOtherTabSections) {
        return {
            didClose: true,
            nextState: {
                ...currentState,
                tabSections: {
                    sections: {
                        ...currentState.tabSections.sections,
                        [sourceSectionId]: nextSection,
                    },
                },
                workbench: {
                    ...(currentState.workbench ?? {}),
                    activeGroupId: sourceSectionId,
                },
            },
        };
    }

    const cleaned = cleanupEmptyTabWorkbenchSections(currentState.root, {
        sections: {
            ...currentState.tabSections.sections,
            [sourceSectionId]: nextSection,
        },
    }, workbenchTabAdapter);

    return {
        didClose: true,
        nextState: {
            ...currentState,
            root: cleaned.root,
            tabSections: cleaned.state,
            workbench: {
                ...(currentState.workbench ?? {}),
                activeGroupId: cleaned.state.sections[sourceSectionId]
                    ? sourceSectionId
                    : (Object.keys(cleaned.state.sections)[0] ?? null),
            },
        },
    };
}

const workbenchTabAdapter: TabWorkbenchAdapter<WorkbenchSectionData> = {
    createTabSectionDraft: (args) => ({
        id: args.nextSectionId,
        title: args.title,
        data: {
            role: args.sourceLeaf.data.role,
            component: createSectionComponentBinding("tab-section", {
                tabSectionId: args.nextTabSectionId,
            }),
        },
        resizableEdges: args.sourceLeaf.resizableEdges,
    }),
    getTabSectionId: (section) => {
        if (section.data.component.type !== "tab-section") {
            return null;
        }
        return (section.data.component.props as { tabSectionId?: string }).tabSectionId ?? null;
    },
};

const workbenchPanelAdapter: PanelWorkbenchAdapter<WorkbenchSectionData> = {
    createPanelSectionDraft: (args) => ({
        id: args.nextSectionId,
        title: args.title,
        data: {
            role: args.sourceLeaf.data.role,
            component: createSectionComponentBinding("panel-section", {
                panelSectionId: args.nextPanelSectionId,
            }),
        },
        resizableEdges: args.sourceLeaf.resizableEdges,
    }),
    getPanelSectionId: (section) => {
        if (section.data.component.type !== "panel-section") {
            return null;
        }
        return (section.data.component.props as { panelSectionId?: string }).panelSectionId ?? null;
    },
};

function getComparablePanelLeafSectionId(target: PanelSectionHoverTarget | null | undefined): string | null {
    if (!target) {
        return null;
    }

    if (target.area === "content") {
        return target.anchorLeafSectionId ?? target.leafSectionId;
    }

    return target.leafSectionId;
}

function areEquivalentPanelHoverTargets(
    left: PanelSectionHoverTarget | null | undefined,
    right: PanelSectionHoverTarget | null | undefined,
): boolean {
    return (
        left?.area === right?.area &&
        left?.panelSectionId === right?.panelSectionId &&
        getComparablePanelLeafSectionId(left) === getComparablePanelLeafSectionId(right) &&
        left?.anchorLeafSectionId === right?.anchorLeafSectionId &&
        left?.targetIndex === right?.targetIndex &&
        left?.splitSide === right?.splitSide
    );
}

function areEquivalentPanelDragSessions(
    left: PanelSectionDragSession | null,
    right: PanelSectionDragSession | null,
): boolean {
    return (
        left?.sessionId === right?.sessionId &&
        left?.phase === right?.phase &&
        left?.panelId === right?.panelId &&
        left?.currentPanelSectionId === right?.currentPanelSectionId &&
        left?.sourcePanelSectionId === right?.sourcePanelSectionId &&
        left?.pointerX === right?.pointerX &&
        left?.pointerY === right?.pointerY &&
        left?.activityTarget?.barId === right?.activityTarget?.barId &&
        left?.activityTarget?.targetIndex === right?.activityTarget?.targetIndex &&
        areEquivalentPanelHoverTargets(left?.hoverTarget, right?.hoverTarget)
    );
}

export function VSCodeWorkbench(props: VSCodeWorkbenchProps): ReactNode {
    const {
        activities = [],
        panels = [],
        tabComponents = {},
        initialTabs,
        hasRightSidebar = false,
        initialSidebarState,
        initialSectionRatios,
        hideEmptyPanelBar = false,
        renderInactiveTabContent = true,
        renderTabDragPreviewLayout = true,
        tabDragPreviewRenderMode = "inline",
        preserveActiveTabContentDuringDrag = false,
        renderTabContentInDragPreviewLayout = true,
        renderActivityIcon,
        renderPanelContent,
        renderTabTitle,
        onActivateActivity,
        onSelectActivity,
        onSidebarStateChange,
        onActiveTabChange,
        onCloseTab,
        onActivityIconContextMenu,
        onActivityIconDrop,
        onActivityBarBackgroundContextMenu,
        onSectionRatioChange,
        apiRef,
        className,
    } = props;

    // --- Sidebar state ---
    const [leftSidebarVisible, setLeftSidebarVisible] = useState(initialSidebarState?.left.visible ?? true);
    const [rightSidebarVisible, setRightSidebarVisible] = useState(initialSidebarState?.right.visible ?? true);
    const [activeLeftActivityId, setActiveLeftActivityId] = useState<string | null>(initialSidebarState?.left.activeActivityId ?? null);
    // Right sidebar has no dedicated activity bar; the value is kept for state
    // reporting only and never mutated after mount.
    const [activeRightActivityId] = useState<string | null>(initialSidebarState?.right.activeActivityId ?? null);
    const [activeLeftPanelId, setActiveLeftPanelId] = useState<string | null>(initialSidebarState?.left.activePanelId ?? null);
    const [activeRightPanelId, setActiveRightPanelId] = useState<string | null>(initialSidebarState?.right.activePanelId ?? null);

    // --- DnD sessions ---
    const [activityBarDragSession, setActivityBarDragSession] = useState<ActivityBarDragSession | null>(null);
    const [panelDragSession, setPanelDragSession] = useState<PanelSectionDragSession | null>(null);
    const [tabDragSession, setTabDragSession] = useState<TabSectionDragSession | null>(null);
    const livePanelDragSession = panelDragSession && !isEndedPanelSectionDragSession(panelDragSession)
        ? panelDragSession
        : null;

    const handlePanelDragSessionChange = useCallback((session: PanelSectionDragSession | null): void => {
        if (isEndedPanelSectionDragSession(session)) {
            return;
        }

        setPanelDragSession((currentSession) => {
            if (areEquivalentPanelDragSessions(currentSession, session)) {
                return currentSession;
            }

            return session;
        });
    }, []);

    useEffect(() => {
        if (panelDragSession && !livePanelDragSession) {
            setPanelDragSession(null);
        }
    }, [livePanelDragSession, panelDragSession]);

    // --- Derived data ---
    const activitiesById = useMemo(
        () => new Map(activities.map((a) => [a.id, a])),
        [activities],
    );

    // --- Store ---
    const storeRef = useRef<VSCodeLayoutStore<WorkbenchSectionData> | null>(null);
    if (!storeRef.current) {
        storeRef.current = createVSCodeLayoutStore({
            initialState: createWorkbenchLayoutState({
                activities,
                panels,
                initialTabs,
                hasRightSidebar,
                initialSidebarState: initialSidebarState ? {
                    left: {
                        visible: initialSidebarState.left.visible,
                        activeActivityId: initialSidebarState.left.activeActivityId,
                        activePanelId: initialSidebarState.left.activePanelId,
                    },
                    right: {
                        visible: initialSidebarState.right.visible,
                        activeActivityId: initialSidebarState.right.activeActivityId,
                        activePanelId: initialSidebarState.right.activePanelId,
                    },
                } : undefined,
            }),
        });
        // Apply persisted section ratios (fire-and-forget, must run before first render)
        if (initialSectionRatios) {
            for (const [sectionId, ratio] of Object.entries(initialSectionRatios)) {
                storeRef.current.resizeSection(sectionId, ratio);
            }
        }
    }
    const store = storeRef.current;
    const state = useVSCodeLayoutStoreState(store);
    const layoutRoot = useMemo(() => {
        let nextRoot = setSectionHidden(state.root, "left-sidebar", !leftSidebarVisible);
        if (hasRightSidebar) {
            nextRoot = setSectionHidden(nextRoot, "right-sidebar", !rightSidebarVisible);
        }
        return nextRoot;
    }, [state.root, hasRightSidebar, leftSidebarVisible, rightSidebarVisible]);

    // --- Late-arriving section ratio restoration ---
    // backendConfig loads async, so initialSectionRatios may be undefined on
    // the first render that creates the store. Apply them once they arrive.
    const initialRatiosAppliedRef = useRef(!!initialSectionRatios);
    useEffect(() => {
        if (!initialRatiosAppliedRef.current && initialSectionRatios) {
            initialRatiosAppliedRef.current = true;
            for (const [sectionId, ratio] of Object.entries(initialSectionRatios)) {
                store.resizeSection(sectionId, ratio);
            }
        }
    }, [initialSectionRatios, store]);

    // --- Section ratio change notification ---
    const onSectionRatioChangeRef = useRef(onSectionRatioChange);
    onSectionRatioChangeRef.current = onSectionRatioChange;
    useEffect(() => {
        return store.addLifecycleHook((event) => {
            if (event.command === "resize-section" && event.phase === "after" && event.changed) {
                onSectionRatioChangeRef.current?.(collectSectionRatios(event.nextState.root));
            }
        });
    }, [store]);

    // --- Tab operations ---
    const openTab = useCallback((tab: WorkbenchTabDefinition): void => {
        store.updateState((currentState) => {
            const nextTab: TabSectionTabDefinition = {
                id: tab.id,
                title: tab.title,
                type: "workbench-tab",
                payload: { component: tab.component, params: tab.params ?? {} } satisfies WorkbenchTabPayload,
                content: `Component: ${tab.component}`,
                tone: "neutral",
            };

            // Check all sections — if the tab already exists somewhere, focus it there.
            const existingSectionId = findTabSectionIdByTabId(currentState.tabSections, tab.id);
            if (existingSectionId) {
                const section = currentState.tabSections.sections[existingSectionId];
                // Update the tab definition in-place (title / params may have changed).
                const nextTabs = section.tabs.map((t) => (t.id === tab.id ? nextTab : t));
                return {
                    ...currentState,
                    tabSections: {
                        sections: {
                            ...currentState.tabSections.sections,
                            [existingSectionId]: { ...section, tabs: nextTabs, focusedTabId: tab.id },
                        },
                    },
                    workbench: { activeGroupId: existingSectionId },
                };
            }

            const targetSectionId = resolveActiveTabSectionId(currentState) ?? WORKBENCH_MAIN_TAB_SECTION_ID;
            const currentSection = currentState.tabSections.sections[targetSectionId] ?? {
                id: targetSectionId,
                tabs: [] as TabSectionTabDefinition[],
                focusedTabId: null,
                isRoot: targetSectionId === WORKBENCH_MAIN_TAB_SECTION_ID,
            };

            return {
                ...currentState,
                tabSections: {
                    sections: {
                        ...currentState.tabSections.sections,
                        [targetSectionId]: { ...currentSection, tabs: [...currentSection.tabs, nextTab], focusedTabId: nextTab.id },
                    },
                },
                workbench: { activeGroupId: targetSectionId },
            };
        });
    }, [store]);

    const updateTab = useCallback((tabId: string, updates: Partial<WorkbenchTabDefinition>): void => {
        store.updateState((currentState) => {
            const sectionId = findTabSectionIdByTabId(currentState.tabSections, tabId);
            if (!sectionId) {
                return currentState;
            }

            const section = currentState.tabSections.sections[sectionId];
            let changed = false;
            const nextTabs = section.tabs.map((tab) => {
                if (tab.id !== tabId) {
                    return tab;
                }

                const payload = readWorkbenchTabPayload(tab);
                const nextComponent = updates.component ?? payload.component;
                const nextParams = updates.params ?? payload.params;
                const nextTitle = updates.title ?? tab.title;

                if (
                    nextComponent === payload.component &&
                    nextParams === payload.params &&
                    nextTitle === tab.title
                ) {
                    return tab;
                }

                changed = true;
                return {
                    ...tab,
                    title: nextTitle,
                    payload: {
                        component: nextComponent,
                        params: nextParams,
                    } satisfies WorkbenchTabPayload,
                    content: `Component: ${nextComponent}`,
                };
            });

            if (!changed) {
                return currentState;
            }

            return {
                ...currentState,
                tabSections: {
                    sections: {
                        ...currentState.tabSections.sections,
                        [sectionId]: { ...section, tabs: nextTabs },
                    },
                },
            };
        });
    }, [store]);

    const closeTab = useCallback((tabId: string): void => {
        let didClose = false;

        store.updateState((currentState) => {
            const result = closeWorkbenchTabState(currentState, tabId);
            didClose = result.didClose;
            return result.nextState;
        });

        if (didClose) {
            onCloseTab?.(tabId);
        }
    }, [onCloseTab, store]);

    const setActiveTab = useCallback((tabId: string): void => {
        store.updateState((currentState) => {
            const targetSectionId = findTabSectionIdByTabId(currentState.tabSections, tabId);
            if (!targetSectionId) return currentState;
            const section = currentState.tabSections.sections[targetSectionId];
            if (!section) return currentState;

            return {
                ...currentState,
                tabSections: {
                    sections: {
                        ...currentState.tabSections.sections,
                        [targetSectionId]: { ...section, focusedTabId: tabId },
                    },
                },
                workbench: { activeGroupId: targetSectionId },
            };
        });
    }, [store]);

    const moveWorkbenchTab = useCallback((move: TabSectionTabMove): void => {
        store.updateState((currentState) => {
            const sourceSection = currentState.tabSections.sections[move.sourceSectionId];
            if (!sourceSection) {
                return currentState;
            }

            const shouldPreserveLoneSource = (
                move.sourceSectionId !== move.targetSectionId &&
                sourceSection.tabs.length === 1
            );
            if (shouldPreserveLoneSource) {
                return currentState;
            }

            const moved = applyTabWorkbenchTabMove(
                currentState.root,
                currentState.tabSections,
                move,
                workbenchTabAdapter,
            );

            return {
                ...currentState,
                root: moved.root,
                tabSections: moved.state,
                workbench: {
                    activeGroupId: moved.state.sections[move.targetSectionId]
                        ? move.targetSectionId
                        : (Object.keys(moved.state.sections)[0] ?? null),
                },
            };
        });
    }, [store]);

    const setPanelSectionCollapsedWithLayout = useCallback((
        leafSectionId: string,
        panelSectionId: string,
        isCollapsed: boolean,
    ): void => {
        store.updateState((currentState) => {
            const next = applyPanelSectionCollapsedLayout(currentState.root, currentState.panelSections, {
                leafSectionId,
                panelSectionId,
                isCollapsed,
            });
            return {
                ...currentState,
                root: next.root,
                panelSections: next.state,
            };
        });
    }, [store]);

    const focusPanelWithLayout = useCallback((
        leafSectionId: string,
        panelSectionId: string,
        panelId: string,
    ): void => {
        store.updateState((currentState) => {
            const next = focusPanelSectionWithLayout(currentState.root, currentState.panelSections, {
                leafSectionId,
                panelSectionId,
                panelId,
            });
            return {
                ...currentState,
                root: next.root,
                panelSections: next.state,
            };
        });
    }, [store]);

    const activatePanelById = useCallback((panelId: string): void => {
        const panelDef = panels.find((p) => p.id === panelId);
        if (!panelDef) return;

        if (panelDef.position === "right") {
            setRightSidebarVisible(true);
            // Don't set activeRightActivityId — the right sidebar shows all
            // right-side panels as icons in a single rail (no separate activity bar).
            setActiveRightPanelId(panelId);
            focusPanelWithLayout("right-sidebar", WORKBENCH_RIGHT_PANEL_SECTION_ID, panelId);
        } else {
            setLeftSidebarVisible(true);
            setActiveLeftActivityId(panelDef.activityId);
            setActiveLeftPanelId(panelId);
            focusPanelWithLayout("left-sidebar", WORKBENCH_LEFT_PANEL_SECTION_ID, panelId);
        }
    }, [focusPanelWithLayout, panels]);

    // --- Sync activity bars to store ---
    useEffect(() => {
        const nextBars = buildWorkbenchActivityBars(activities, activeLeftActivityId, activeRightActivityId);
        // Skip update when bars content is identical to avoid unnecessary re-renders.
        const currentBars = store.getState().activityBars;
        if (areActivityBarsEqual(currentBars, nextBars)) return;
        store.resetActivityBars(nextBars);
    }, [activities, activeLeftActivityId, activeRightActivityId, store]);

    // --- Sync panel sections to store ---
    // Panels that have been moved to satellite (non-root) sections via drag-split
    // must be excluded from the declarative rebuild of root sections. Otherwise
    // they would be re-added and appear in both root and satellite sections.
    useEffect(() => {
        const currentState = store.getState();
        const panelsInSatelliteSections = new Set<string>();
        const rootSectionIds: ReadonlySet<string> = new Set([
            WORKBENCH_LEFT_PANEL_SECTION_ID,
            WORKBENCH_RIGHT_PANEL_SECTION_ID,
        ]);
        for (const [sectionId, section] of Object.entries(currentState.panelSections.sections)) {
            if (!rootSectionIds.has(sectionId)) {
                for (const panel of section.panels) {
                    panelsInSatelliteSections.add(panel.id);
                }
            }
        }

        const panelSections = buildWorkbenchPanelSections(
            panels, activities,
            activeLeftActivityId, activeRightActivityId,
            activeLeftPanelId, activeRightPanelId,
        );
        for (const section of panelSections) {
            let target = section;
            if (panelsInSatelliteSections.size > 0) {
                const filteredPanels = section.panels.filter(
                    (p) => !panelsInSatelliteSections.has(p.id),
                );
                if (filteredPanels.length !== section.panels.length) {
                    target = {
                        ...section,
                        panels: filteredPanels,
                        focusedPanelId: filteredPanels.some((p) => p.id === section.focusedPanelId)
                            ? section.focusedPanelId
                            : (filteredPanels[0]?.id ?? null),
                    };
                }
            }

            target = reconcileDeclarativePanelSection(
                currentState.panelSections.sections[target.id],
                target,
            );

            // Skip upsert when the section content is identical to avoid
            // unnecessary store updates (which always produce new objects).
            const existing = currentState.panelSections.sections[target.id];
            if (existing && arePanelSectionsEqual(existing, target)) {
                continue;
            }
            store.upsertPanelSection(target);
        }
    }, [activities, panels, activeLeftActivityId, activeRightActivityId, activeLeftPanelId, activeRightPanelId, store]);

    // --- Sync sidebar visibility ---
    useEffect(() => {
        store.updateState((currentState) => {
            const leftSidebar = findSectionNode(currentState.root, "left-sidebar");
            if (leftSidebar && isSectionHidden(leftSidebar) === !leftSidebarVisible) {
                return currentState;
            }

            return {
                ...currentState,
                root: setSectionHidden(currentState.root, "left-sidebar", !leftSidebarVisible),
            };
        });
    }, [leftSidebarVisible, store]);

    useEffect(() => {
        if (!hasRightSidebar) return;
        store.updateState((currentState) => {
            const rightSidebar = findSectionNode(currentState.root, "right-sidebar");
            if (rightSidebar && isSectionHidden(rightSidebar) === !rightSidebarVisible) {
                return currentState;
            }

            return {
                ...currentState,
                root: setSectionHidden(currentState.root, "right-sidebar", !rightSidebarVisible),
            };
        });
    }, [hasRightSidebar, rightSidebarVisible, store]);

    // --- Sync root layout when sidebar config changes ---
    useEffect(() => {
        store.resetLayout(createWorkbenchRootLayout(hasRightSidebar));
    }, [hasRightSidebar, store]);

    // --- Notify sidebar state changes ---
    const onSidebarStateChangeRef = useRef(onSidebarStateChange);
    onSidebarStateChangeRef.current = onSidebarStateChange;
    useEffect(() => {
        onSidebarStateChangeRef.current?.({
            left: { visible: leftSidebarVisible, activeActivityId: activeLeftActivityId, activePanelId: activeLeftPanelId },
            right: { visible: rightSidebarVisible, activeActivityId: activeRightActivityId, activePanelId: activeRightPanelId },
        });
    }, [leftSidebarVisible, rightSidebarVisible, activeLeftActivityId, activeRightActivityId, activeLeftPanelId, activeRightPanelId]);

    // --- Notify active tab changes ---
    const activeTabSectionId = resolveActiveTabSectionId(state);
    const activeTabSection = activeTabSectionId ? state.tabSections.sections[activeTabSectionId] ?? null : null;
    const activeTabId = activeTabSection?.focusedTabId ?? null;
    const prevActiveTabIdRef = useRef(activeTabId);
    useEffect(() => {
        if (prevActiveTabIdRef.current !== activeTabId) {
            prevActiveTabIdRef.current = activeTabId;
            onActiveTabChange?.(activeTabId);
        }
    }, [activeTabId, onActiveTabChange]);

    useEffect(() => {
        const handleWindowKeyDown = (event: KeyboardEvent) => {
            if (!activeTabId || !isCloseActiveTabShortcut(event)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            closeTab(activeTabId);
        };

        window.addEventListener("keydown", handleWindowKeyDown, true);
        return () => window.removeEventListener("keydown", handleWindowKeyDown, true);
    }, [activeTabId, closeTab]);

    // --- Build panel context ---
    const buildPanelContext = useCallback((hostPanelId: string | null): WorkbenchPanelContext => ({
        activeTabId,
        hostPanelId,
        openTab,
        updateTab,
        closeTab,
        setActiveTab,
        activatePanel: activatePanelById,
    }), [activeTabId, openTab, updateTab, closeTab, setActiveTab, activatePanelById]);

    // --- Tab DnD preview ---
    const tabPreview = useMemo(
        () => renderTabDragPreviewLayout
            ? buildTabWorkbenchPreviewState(layoutRoot, state.tabSections, tabDragSession, workbenchTabAdapter)
            : null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when phase/hoverTarget changes, not on every pointer move
        [renderTabDragPreviewLayout, layoutRoot, state.tabSections, tabDragSession?.phase, tabDragSession?.hoverTarget],
    );
    const shouldRenderTabPreviewOverlay = Boolean(tabPreview && tabDragPreviewRenderMode === "overlay");
    const shouldRenderInlineTabPreview = !shouldRenderTabPreviewOverlay;
    const tabPreviewedRoot = shouldRenderInlineTabPreview ? tabPreview?.root ?? state.root : state.root;
    const renderedTabSections = shouldRenderInlineTabPreview ? tabPreview?.state ?? state.tabSections : state.tabSections;

    // --- Panel DnD preview ---
    const panelPreview = useMemo(
        () => buildPanelWorkbenchPreviewState(tabPreviewedRoot, state.panelSections, livePanelDragSession, workbenchPanelAdapter),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when phase/hoverTarget changes, not on every pointer move
        [tabPreviewedRoot, state.panelSections, livePanelDragSession?.phase, livePanelDragSession?.hoverTarget],
    );
    const panelPreviewedRoot = panelPreview?.root ?? tabPreviewedRoot;
    const panelPreviewedSections = panelPreview?.state ?? state.panelSections;

    // --- Activity bar icon → content area DnD preview ---
    const activityContentTarget = activityBarDragSession?.phase === "dragging" ? activityBarDragSession.contentTarget : null;
    const activityPreviewTitle = activityContentTarget
        ? (state.activityBars.bars[WORKBENCH_LEFT_ACTIVITY_BAR_ID]?.icons.find((icon) => icon.id === activityBarDragSession?.iconId)?.label ?? "")
        : "";
    const activityPreview = useMemo(
        () => buildActivityBarContentPreviewState(panelPreviewedRoot, panelPreviewedSections, activityContentTarget, workbenchPanelAdapter, activityPreviewTitle),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when contentTarget changes
        [panelPreviewedRoot, panelPreviewedSections, activityContentTarget, activityPreviewTitle],
    );
    const renderedRoot = activityPreview?.root ?? panelPreviewedRoot;
    const renderedPanelSections = activityPreview?.state ?? panelPreviewedSections;

    // --- Imperative API ---
    useImperativeHandle(apiRef, () => ({
        openTab,
        updateTab,
        closeTab,
        setActiveTab,
        activatePanel: activatePanelById,
        getTab: (tabId) => {
            for (const section of Object.values(store.getState().tabSections.sections)) {
                const tab = section.tabs.find((t) => t.id === tabId);
                if (tab) {
                    return { id: tab.id, params: readWorkbenchTabPayload(tab).params };
                }
            }
            return null;
        },
        getTabs: () => {
            const result: Array<{ id: string; params: Record<string, unknown> }> = [];
            for (const section of Object.values(store.getState().tabSections.sections)) {
                for (const tab of section.tabs) {
                    result.push({ id: tab.id, params: readWorkbenchTabPayload(tab).params });
                }
            }
            return result;
        },
        setLeftSidebarVisible,
        setRightSidebarVisible,
    }), [openTab, updateTab, closeTab, setActiveTab, activatePanelById, store]);

    // --- Component registry ---
    const leftActivityBarState = state.activityBars.bars[WORKBENCH_LEFT_ACTIVITY_BAR_ID] ?? null;

    const leftActivityFocusBridge = useMemo((): ActivityBarFocusBridge<ActivityBarStateItem, ActivityBarStateItem["icons"][number]> => ({
        getIconAttributes: (_bar, icon) => ({
            "data-testid": `activity-bar-item-${icon.id}`,
        }),
    }), []);

    const leftPanelFocusBridge = useMemo((): PanelSectionFocusBridge<PanelSectionStateItem, PanelSectionPanelDefinition> => ({
        getSectionAttributes: () => ({
            "data-testid": "sidebar-left",
            "aria-label": "Left Extension Panel",
        }),
        getEmptyAttributes: () => ({
            "data-testid": "left-sidebar-empty",
        }),
        getHeaderAttributes: () => ({
            "data-testid": "left-sidebar-header",
        }),
    }), []);

    const rightPanelFocusBridge = useMemo((): PanelSectionFocusBridge<PanelSectionStateItem, PanelSectionPanelDefinition> => ({
        getSectionAttributes: () => ({
            "data-testid": "sidebar-right",
            "aria-label": "Right Extension Panel",
        }),
        getPanelAttributes: (_section, panel) => ({
            "data-testid": `right-activity-icon-${(panel.meta as Record<string, unknown> | undefined)?.activityId ?? panel.id}`,
        }),
        getEmptyAttributes: () => ({
            "data-testid": "right-sidebar-empty",
        }),
        getHeaderAttributes: () => ({
            "data-testid": "right-sidebar-header",
        }),
    }), []);

    const registry = useMemo(() => createSectionComponentRegistry<WorkbenchSectionData>({
        empty: ({ binding }) => {
            const p = binding.props as { label: string; description: string };
            return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", opacity: 0.5, fontSize: 12 }}>
                    <span>{p.label}</span>
                </div>
            );
        },
        "activity-rail": () => {
            if (!leftActivityBarState || leftActivityBarState.icons.length === 0) {
                return null;
            }

            return (
                <ActivityBar
                    bar={leftActivityBarState}
                    dragSession={activityBarDragSession}
                    panelDragSession={livePanelDragSession}
                    focusBridge={leftActivityFocusBridge}
                    renderIcon={(icon) => {
                        const activity = activitiesById.get(icon.id);
                        if (renderActivityIcon && activity) {
                            return renderActivityIcon(activity);
                        }
                        return (icon.meta?.icon as ReactNode | undefined) ?? (
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{icon.symbol}</span>
                        );
                    }}
                    onDragSessionChange={setActivityBarDragSession}
                    onDragSessionEnd={(session) => {
                        setActivityBarDragSession(null);

                        if (session.contentTarget?.splitSide) {
                            const committed = commitActivityBarContentDrop(
                                store.getState().root,
                                store.getState().panelSections,
                                session.contentTarget,
                                workbenchPanelAdapter,
                            );
                            if (!committed) return;

                            store.replaceState({
                                ...store.getState(),
                                root: committed.root,
                                panelSections: committed.state,
                            });
                            onActivityIconDrop?.(session.iconId, committed.newPanelSectionId);

                            // Cleanup any panel sections left empty after the drop.
                            // The host may have populated the new section via onActivityIconDrop;
                            // if not, the empty section is destroyed and its split merged.
                            const afterDrop = store.getState();
                            const cleaned = cleanupEmptyPanelWorkbenchSections(
                                afterDrop.root,
                                afterDrop.panelSections,
                                workbenchPanelAdapter,
                            );
                            if (cleaned.root !== afterDrop.root || cleaned.state !== afterDrop.panelSections) {
                                store.replaceState({
                                    ...afterDrop,
                                    root: cleaned.root,
                                    panelSections: cleaned.state,
                                });
                            }
                        }
                    }}
                    onPanelDragSessionChange={handlePanelDragSessionChange}
                    onActivateIcon={(iconId) => {
                        const activity = activitiesById.get(iconId);
                        if (activity?.activationMode === "action") {
                            onActivateActivity?.(iconId, buildPanelContext(null));
                        }
                    }}
                    onSelectIcon={(iconId) => {
                        const activity = activitiesById.get(iconId);
                        if (activity?.activationMode === "action") return;

                        setLeftSidebarVisible(true);
                        setActiveLeftActivityId(iconId);
                        setPanelSectionCollapsedWithLayout("left-sidebar", WORKBENCH_LEFT_PANEL_SECTION_ID, false);
                        onSelectActivity?.(iconId, "left");
                    }}
                    onMoveIcon={(move: ActivityBarIconMove) => store.moveActivityIcon(move)}
                    onIconContextMenu={onActivityIconContextMenu}
                    onBackgroundContextMenu={onActivityBarBackgroundContextMenu}
                />
            );
        },
        "panel-section": ({ section, binding }) => {
            const panelSectionProps = binding.props as { panelSectionId: string };
            const panelSection = renderedPanelSections.sections[panelSectionProps.panelSectionId] ?? null;
            const isRight = panelSectionProps.panelSectionId === WORKBENCH_RIGHT_PANEL_SECTION_ID;
            const isDragging = Boolean(livePanelDragSession || activityBarDragSession);
            const isPreviewLeaf = isPanelWorkbenchPreviewLeaf(section.id, isDragging);
            const committedLeafId = resolvePanelWorkbenchCommittedLeafSectionId(
                section.id,
                livePanelDragSession?.hoverTarget?.anchorLeafSectionId
                    ?? activityBarDragSession?.contentTarget?.anchorLeafSectionId,
            );

            return (
                <PanelSection
                    leafSectionId={section.id}
                    committedLeafSectionId={committedLeafId}
                    interactive={!isPreviewLeaf}
                    allowContentPreview={isPreviewLeaf}
                    panelSectionId={panelSectionProps.panelSectionId}
                    panelSection={panelSection}
                    hideBarWhenEmpty={hideEmptyPanelBar}
                    dragSession={livePanelDragSession}
                    activityDragSession={activityBarDragSession}
                    focusBridge={isRight ? rightPanelFocusBridge : leftPanelFocusBridge}
                    renderPanelTab={(panel) => (
                        (panel.meta?.icon as ReactNode | undefined) ?? (
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{panel.symbol}</span>
                        )
                    )}
                    renderPanelContent={(panel) => {
                        if (renderPanelContent) {
                            return renderPanelContent(panel.id, buildPanelContext(panel.id));
                        }
                        return <div style={{ padding: 12 }}>{panel.label}</div>;
                    }}
                    onDragSessionChange={handlePanelDragSessionChange}
                    onDragSessionEnd={(session) => {
                        setPanelDragSession(null);
                        const currentState = store.getState();
                        const committed = finalizePanelWorkbenchDrop(
                            currentState.root,
                            currentState.panelSections,
                            session,
                            workbenchPanelAdapter,
                        );
                        if (!committed) return;

                        store.replaceState({
                            ...currentState,
                            root: committed.root,
                            panelSections: committed.state,
                        });
                    }}
                    onActivityDragSessionChange={setActivityBarDragSession}
                    onActivatePanel={(panelId) => activatePanelById(panelId)}
                    onFocusPanel={(panelId) => {
                        focusPanelWithLayout(section.id, panelSectionProps.panelSectionId, panelId);
                        if (isRight) {
                            setRightSidebarVisible(true);
                            setActiveRightPanelId(panelId);
                        } else {
                            setLeftSidebarVisible(true);
                            setActiveLeftPanelId(panelId);
                        }
                    }}
                    onToggleCollapsed={() => {
                        const current = store.getPanelSection(panelSectionProps.panelSectionId);
                        setPanelSectionCollapsedWithLayout(
                            section.id,
                            panelSectionProps.panelSectionId,
                            !(current?.isCollapsed ?? false),
                        );
                    }}
                    onMovePanel={(move) => store.movePanel(move)}
                />
            );
        },
        "tab-section": ({ section, binding }) => {
            const tsProps = binding.props as { tabSectionId: string };
            const tabSection = renderedTabSections.sections[tsProps.tabSectionId] ?? null;
            const shouldRenderRealTabContent = Boolean(
                renderTabContentInDragPreviewLayout ||
                !tabSection?.id.startsWith(PREVIEW_TAB_SECTION_ID_PREFIX),
            );

            if (!tabSection || tabSection.tabs.length === 0) {
                return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", opacity: 0.5, fontSize: 12 }}>
                        No open tabs
                    </div>
                );
            }

            return (
                <TabSection
                    leafSectionId={section.id}
                    tabSectionId={tsProps.tabSectionId}
                    tabSection={tabSection}
                    trackPointerLifecycle={false}
                    renderTabTitle={(tab) => {
                        if (renderTabTitle) return renderTabTitle(tab);
                        return <span>{tab.title}</span>;
                    }}
                    renderTabContent={(tab) => {
                        if (!shouldRenderRealTabContent) {
                            return (
                                <div style={{ padding: 16, opacity: 0.72, fontSize: 12 }}>
                                    Preview: {tab.title}
                                </div>
                            );
                        }

                        const payload = readWorkbenchTabPayload(tab);
                        const Component = tabComponents[payload.component];

                        if (!Component) {
                            return (
                                <div style={{ padding: 16 }}>
                                    <strong>Unregistered: {payload.component}</strong>
                                    <pre style={{ fontSize: 11, opacity: 0.6 }}>{JSON.stringify(payload.params, null, 2)}</pre>
                                </div>
                            );
                        }

                        return (
                            <Component
                                params={payload.params}
                                api={{
                                    id: tab.id,
                                    close: () => closeTab(tab.id),
                                    setActive: () => setActiveTab(tab.id),
                                    setTitle: (title) => updateTab(tab.id, { title }),
                                }}
                            />
                        );
                    }}
                    renderInactiveTabContent={renderInactiveTabContent}
                    preserveActiveTabContentDuringDrag={preserveActiveTabContentDuringDrag}
                    onDragSessionChange={setTabDragSession}
                    onDragSessionEnd={(session) => {
                        setTabDragSession(null);
                        const committed = commitTabWorkbenchDrop(
                            store.getState().root,
                            store.getState().tabSections,
                            session,
                            workbenchTabAdapter,
                        );
                        if (!committed) return;

                        store.replaceState({
                            ...store.getState(),
                            root: committed.root,
                            tabSections: committed.state,
                            workbench: { activeGroupId: committed.activeTabSectionId },
                        });
                    }}
                    onFocusTab={setActiveTab}
                    onCloseTab={closeTab}
                    onMoveTab={moveWorkbenchTab}
                />
            );
        },
    }), [
        leftActivityBarState,
        activityBarDragSession,
        livePanelDragSession,
        activitiesById,
        renderActivityIcon,
        renderPanelContent,
        renderTabTitle,
        renderInactiveTabContent,
        renderTabDragPreviewLayout,
        tabDragPreviewRenderMode,
        preserveActiveTabContentDuringDrag,
        renderTabContentInDragPreviewLayout,
        tabComponents,
        renderedPanelSections,
        renderedTabSections,
        buildPanelContext,
        onActivateActivity,
        onSelectActivity,
        activatePanelById,
        openTab,
        closeTab,
        moveWorkbenchTab,
        setActiveTab,
        store,
        leftActivityFocusBridge,
        leftPanelFocusBridge,
        rightPanelFocusBridge,
    ]);

    const renderTabPreviewOverlaySection = useCallback((section: SectionNode<WorkbenchSectionData>): ReactNode => {
        if (!tabPreview) {
            return null;
        }

        const binding = getSectionComponentBinding(section);
        if (binding.type !== "tab-section") {
            return <div style={{ width: "100%", height: "100%" }} />;
        }

        const tsProps = binding.props as { tabSectionId: string };
        const tabSection = tabPreview.state.sections[tsProps.tabSectionId] ?? null;
        if (!tabSection || tabSection.tabs.length === 0) {
            return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", opacity: 0.5, fontSize: 12 }}>
                    Preview empty section
                </div>
            );
        }

        return (
            <TabSection
                leafSectionId={section.id}
                tabSectionId={tsProps.tabSectionId}
                tabSection={tabSection}
                trackPointerLifecycle={false}
                interactive={false}
                allowContentPreview={false}
                renderInactiveTabContent={false}
                renderTabTitle={(tab) => {
                    if (renderTabTitle) return renderTabTitle(tab);
                    return <span>{tab.title}</span>;
                }}
                renderTabContent={(tab) => (
                    <div style={{ padding: 16, opacity: 0.72, fontSize: 12 }}>
                        Preview: {tab.title}
                    </div>
                )}
                onDragSessionChange={() => { }}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />
        );
    }, [renderTabTitle, tabPreview]);

    return (
        <TabDragSessionContext.Provider value={tabDragSession}>
        <div className={className} style={{ width: "100%", height: "100%", position: "relative" }} role="main" aria-label="Dockview Main Area" data-testid="main-dockview-host">
            <SectionLayoutView
                root={renderedRoot}
                renderSection={(section: SectionNode<WorkbenchSectionData>) => (
                    <SectionComponentHost section={section} registry={registry} />
                )}
                onResizeSection={(sectionId, ratio) => store.resizeSection(sectionId, ratio)}
            />
            {shouldRenderTabPreviewOverlay && tabPreview ? (
                <div
                    aria-hidden="true"
                    data-layout-tab-preview-overlay="true"
                    style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}
                >
                    <SectionLayoutView
                        root={tabPreview.root}
                        renderSection={renderTabPreviewOverlaySection}
                        onResizeSection={() => { }}
                    />
                </div>
            ) : null}
            <TabSectionDragPreview
                session={tabDragSession}
                onSessionChange={setTabDragSession}
                onSessionEnd={(session) => {
                    setTabDragSession(null);
                    const committed = commitTabWorkbenchDrop(
                        store.getState().root,
                        store.getState().tabSections,
                        session,
                        workbenchTabAdapter,
                    );
                    if (!committed) return;

                    store.replaceState({
                        ...store.getState(),
                        root: committed.root,
                        tabSections: committed.state,
                        workbench: { activeGroupId: committed.activeTabSectionId },
                    });
                }}
            />
            <ActivityBarDragPreview
                session={activityBarDragSession}
                bar={leftActivityBarState}
                renderIcon={(icon) => {
                    const activity = activitiesById.get(icon.id);
                    if (renderActivityIcon && activity) {
                        return renderActivityIcon(activity);
                    }
                    return (icon.meta?.icon as ReactNode | undefined) ?? (
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{icon.symbol}</span>
                    );
                }}
            />
            <PanelSectionDragPreview
                session={livePanelDragSession}
                onSessionChange={handlePanelDragSessionChange}
                onSessionEnd={(session) => {
                    setPanelDragSession(null);
                    const currentState = store.getState();
                    const committed = finalizePanelWorkbenchDrop(
                        currentState.root,
                        currentState.panelSections,
                        session,
                        workbenchPanelAdapter,
                    );
                    if (!committed) return;

                    store.replaceState({
                        ...currentState,
                        root: committed.root,
                        panelSections: committed.state,
                    });
                }}
                renderTab={(session) => {
                    const activity = activitiesById.get(session.panelId);
                    if (renderActivityIcon && activity) {
                        return renderActivityIcon(activity);
                    }
                    return session.symbol;
                }}
            />
        </div>
        </TabDragSessionContext.Provider>
    );
}
