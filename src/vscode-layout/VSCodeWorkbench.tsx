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
    type DragEvent as ReactDragEvent,
    type ReactNode,
    type Ref,
} from "react";
import { findSectionNode, isSectionHidden, setSectionHidden, type SectionNode } from "../section/layoutModel";
import { createSectionComponentBinding, createSectionComponentRegistry, getSectionComponentBinding, SectionComponentHost } from "../section/sectionComponent";
import { SectionLayoutView, type SectionResizeStrategy } from "../section/SectionLayoutView";
import {
    arePreviewHoverTargetsEqual,
    isPointerInsidePreviewBounds,
    resolvePreviewAnchorLeafSectionId,
    resolvePreviewSplitSide,
    toPreviewStableBounds,
} from "../section/previewSession";
import { ActivityBar } from "../activity-bar/ActivityBar";
import { ActivityBarDragPreview } from "../activity-bar/ActivityBarDragPreview";
import { type ActivityBarDragSession } from "../activity-bar/activityBarDrag";
import {
    reconcileActivityBarsState,
    type ActivityBarIconMove,
    type ActivityBarsState,
} from "../activity-bar/activityBarModel";
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
import type { TabSectionInactiveContentPolicy } from "../tab-section/TabSection";
import { TabSectionDragPreview } from "../tab-section/TabSectionDragPreview";
import { type TabSectionDragSession, type TabSectionHoverTarget } from "../tab-section/tabSectionDrag";
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
    applyWorkbenchLayoutSnapshot,
    applyWorkbenchPanelLayoutSnapshot,
    exportWorkbenchLayoutSnapshot,
    exportWorkbenchPanelLayoutSnapshot,
    readWorkbenchTabPayload,
    WORKBENCH_MAIN_TAB_SECTION_ID,
    WORKBENCH_LEFT_ACTIVITY_BAR_ID,
    WORKBENCH_LEFT_PANEL_SECTION_ID,
    WORKBENCH_RIGHT_PANEL_SECTION_ID,
    type WorkbenchLayoutSnapshot,
    type WorkbenchPanelLayoutSnapshot,
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
    WorkbenchTabDragPayload,
    WorkbenchTabDragPointer,
    WorkbenchTabDefinition,
} from "./workbenchTypes";

/**
 * @interface TabDragPreviewContentRenderContext
 * @description tab 拖拽预览内容渲染上下文，供宿主判断当前预览来自 inline 还是 overlay。
 * @field leafSectionId 当前 preview section tree 中的叶子 section id。
 * @field tabSectionId 当前 preview tab section id。
 * @field renderMode 当前预览渲染模式，inline 表示替换主布局，overlay 表示覆盖在主布局上。
 * @field isPreviewTabSection 当前 tab section 是否为新建的 split preview section。
 */
export interface TabDragPreviewContentRenderContext {
    /** 当前 preview section tree 中的叶子 section id。 */
    leafSectionId: string;
    /** 当前 preview tab section id。 */
    tabSectionId: string;
    /** 当前预览渲染模式，inline 表示替换主布局，overlay 表示覆盖在主布局上。 */
    renderMode: "inline" | "overlay";
    /** 当前 tab section 是否为新建的 split preview section。 */
    isPreviewTabSection: boolean;
}

/**
 * @interface WorkbenchExternalTabDragResolver
 * @description 让宿主把外部 HTML5 拖拽解析为 workbench tab，用于文件树等非 tab 来源触发 tab split preview。
 */
export interface WorkbenchExternalTabDragResolver {
    /** 快速判断当前 drag event 是否属于可打开为 tab 的外部来源。 */
    canAccept: (event: DragEvent) => boolean;
    /** 将当前 drag/drop 解析为 tab 定义；可异步读取宿主数据。 */
    resolveTab: (event: DragEvent) => WorkbenchTabDefinition | null | Promise<WorkbenchTabDefinition | null>;
}

/**
 * @function renderDefaultTabDragPreviewContent
 * @description 渲染默认的轻量 tab 拖拽预览占位内容。
 * @param tab 当前预览 tab 定义。
 * @returns React 预览节点。
 */
function renderDefaultTabDragPreviewContent(tab: TabSectionTabDefinition): ReactNode {
    return (
        <div style={{ padding: 16, opacity: 0.72, fontSize: 12 }}>
            Preview: {tab.title}
        </div>
    );
}

const EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID = "__layout-v2-external-tab-drag-source";
const EXTERNAL_TAB_DRAG_POINTER_ID = -1001;

function createWorkbenchTabSectionTabDefinition(tab: WorkbenchTabDefinition): TabSectionTabDefinition {
    return {
        id: tab.id,
        title: tab.title,
        type: "workbench-tab",
        payload: { component: tab.component, params: tab.params ?? {} } satisfies WorkbenchTabPayload,
        content: `Component: ${tab.component}`,
        tone: "neutral",
    };
}

function createWorkbenchTabDragPayload(params: {
    tab: TabSectionTabDefinition;
    session: TabSectionDragSession;
    workbenchId?: string;
    windowLabel?: string | null;
}): WorkbenchTabDragPayload {
    const payload = readWorkbenchTabPayload(params.tab);
    return {
        id: params.tab.id,
        title: params.tab.title,
        component: payload.component,
        params: payload.params,
        sourceWorkbenchId: params.workbenchId,
        sourceWindowLabel: params.windowLabel ?? null,
        sourceTabSectionId: params.session.sourceTabSectionId,
        sourceLeafSectionId: params.session.sourceLeafSectionId,
    };
}

function isExternalTabDragSession(session: TabSectionDragSession | null | undefined): boolean {
    return session?.sourceTabSectionId === EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID;
}

function withExternalTabDragSource(
    state: TabSectionsState,
    tab: TabSectionTabDefinition | null,
    session: TabSectionDragSession | null | undefined,
): TabSectionsState {
    if (!tab || !isExternalTabDragSession(session)) {
        return state;
    }

    return {
        sections: {
            ...state.sections,
            [EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID]: {
                id: EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID,
                tabs: [tab],
                focusedTabId: tab.id,
                isRoot: false,
            },
        },
    };
}

function withoutExternalTabDragSource(state: TabSectionsState): TabSectionsState {
    if (!state.sections[EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID]) {
        return state;
    }

    const nextSections = { ...state.sections };
    delete nextSections[EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID];
    return { sections: nextSections };
}

function getTabHoverTargetContainerId(target: TabSectionHoverTarget): string {
    return target.tabSectionId;
}

function areEquivalentTabHoverTargets(
    left: TabSectionHoverTarget | null,
    right: TabSectionHoverTarget | null,
): boolean {
    return arePreviewHoverTargetsEqual(left, right, getTabHoverTargetContainerId);
}

function readElementTranslateX(element: HTMLElement): number {
    const transform = window.getComputedStyle(element).transform;
    if (!transform || transform === "none") {
        return 0;
    }

    try {
        return new DOMMatrixReadOnly(transform).m41;
    } catch {
        return 0;
    }
}

function getSlotMidpointX(slotElement: HTMLElement): number {
    const rect = slotElement.getBoundingClientRect();
    const logicalLeft = rect.left - readElementTranslateX(slotElement);
    return logicalLeft + rect.width / 2;
}

function resolveExternalTabTargetIndex(
    tabSectionElement: HTMLElement,
    pointerX: number,
): number {
    const slots = Array.from(
        tabSectionElement.querySelectorAll<HTMLElement>(".layout-v2-tab-section__tab-slot"),
    );

    for (let index = 0; index < slots.length; index += 1) {
        const slot = slots[index];
        if (slot && pointerX < getSlotMidpointX(slot)) {
            return index;
        }
    }

    return slots.length;
}

function resolveExternalTabHoverTarget(params: {
    event: DragEvent;
    rootElement: HTMLElement | null;
    tabSections: TabSectionsState;
    currentTarget: TabSectionHoverTarget | null;
}): TabSectionHoverTarget | null {
    const eventTarget = params.event.target as HTMLElement | null;
    const tabSectionElement = eventTarget?.closest<HTMLElement>(".layout-v2-tab-section") ?? null;
    if (!params.rootElement || !tabSectionElement || !params.rootElement.contains(tabSectionElement)) {
        return null;
    }

    const tabSectionId = tabSectionElement.getAttribute("data-tab-section-id")
        ?? tabSectionElement.getAttribute("data-layout-tab-section-id");
    if (!tabSectionId || !params.tabSections.sections[tabSectionId]) {
        return null;
    }

    const leafElement = tabSectionElement.closest<HTMLElement>(".layout-v2__leaf-shell");
    const leafSectionId = leafElement?.getAttribute("data-section-id");
    if (!leafSectionId) {
        return null;
    }

    const stripElement = tabSectionElement.querySelector<HTMLElement>(".layout-v2-tab-section__strip");
    const stripRect = stripElement?.getBoundingClientRect() ?? null;
    if (
        stripRect &&
        params.event.clientX >= stripRect.left &&
        params.event.clientX <= stripRect.right &&
        params.event.clientY >= stripRect.top &&
        params.event.clientY <= stripRect.bottom
    ) {
        return {
            area: "strip",
            leafSectionId,
            anchorLeafSectionId: leafSectionId,
            tabSectionId,
            targetIndex: resolveExternalTabTargetIndex(tabSectionElement, params.event.clientX),
        };
    }

    const contentElement = tabSectionElement.querySelector<HTMLElement>(".layout-v2-tab-section__content");
    const contentBounds = toPreviewStableBounds(contentElement?.getBoundingClientRect() ?? null);
    if (!isPointerInsidePreviewBounds(contentBounds, params.event.clientX, params.event.clientY)) {
        return null;
    }

    const isCurrentSectionContentTarget = Boolean(
        params.currentTarget?.area === "content" &&
        params.currentTarget.tabSectionId === tabSectionId,
    );
    return {
        area: "content",
        leafSectionId,
        anchorLeafSectionId: resolvePreviewAnchorLeafSectionId({
            currentTarget: params.currentTarget,
            isCurrentSectionContentTarget,
            committedLeafSectionId: leafSectionId,
        }),
        tabSectionId,
        splitSide: contentBounds
            ? resolvePreviewSplitSide(
                contentBounds,
                params.event.clientX,
                params.event.clientY,
                {
                    left: "left",
                    right: "right",
                    top: "top",
                    bottom: "bottom",
                } as const,
                {
                    currentSplitSide: isCurrentSectionContentTarget
                        ? params.currentTarget?.splitSide ?? null
                        : null,
                },
            )
            : null,
        contentBounds: contentBounds ?? undefined,
    };
}

function resolvePointerTabHoverTarget(params: {
    clientX: number;
    clientY: number;
    rootElement: HTMLElement | null;
    tabSections: TabSectionsState;
    currentTarget: TabSectionHoverTarget | null;
}): TabSectionHoverTarget | null {
    const rootRect = params.rootElement?.getBoundingClientRect() ?? null;
    if (
        !params.rootElement ||
        !rootRect ||
        params.clientX < rootRect.left ||
        params.clientX > rootRect.right ||
        params.clientY < rootRect.top ||
        params.clientY > rootRect.bottom
    ) {
        return null;
    }

    const eventTarget = document.elementFromPoint(params.clientX, params.clientY) as HTMLElement | null;
    const tabSectionElement = eventTarget?.closest<HTMLElement>(".layout-v2-tab-section") ?? null;
    if (!tabSectionElement || !params.rootElement.contains(tabSectionElement)) {
        return null;
    }

    const tabSectionId = tabSectionElement.getAttribute("data-tab-section-id")
        ?? tabSectionElement.getAttribute("data-layout-tab-section-id");
    if (!tabSectionId || !params.tabSections.sections[tabSectionId]) {
        return null;
    }

    const leafElement = tabSectionElement.closest<HTMLElement>(".layout-v2__leaf-shell");
    const leafSectionId = leafElement?.getAttribute("data-section-id");
    if (!leafSectionId) {
        return null;
    }

    const stripElement = tabSectionElement.querySelector<HTMLElement>(".layout-v2-tab-section__strip");
    const stripRect = stripElement?.getBoundingClientRect() ?? null;
    if (
        stripRect &&
        params.clientX >= stripRect.left &&
        params.clientX <= stripRect.right &&
        params.clientY >= stripRect.top &&
        params.clientY <= stripRect.bottom
    ) {
        return {
            area: "strip",
            leafSectionId,
            anchorLeafSectionId: leafSectionId,
            tabSectionId,
            targetIndex: resolveExternalTabTargetIndex(tabSectionElement, params.clientX),
        };
    }

    const contentElement = tabSectionElement.querySelector<HTMLElement>(".layout-v2-tab-section__content");
    const contentBounds = toPreviewStableBounds(contentElement?.getBoundingClientRect() ?? null);
    if (!isPointerInsidePreviewBounds(contentBounds, params.clientX, params.clientY)) {
        return null;
    }

    const isCurrentSectionContentTarget = Boolean(
        params.currentTarget?.area === "content" &&
        params.currentTarget.tabSectionId === tabSectionId,
    );
    return {
        area: "content",
        leafSectionId,
        anchorLeafSectionId: resolvePreviewAnchorLeafSectionId({
            currentTarget: params.currentTarget,
            isCurrentSectionContentTarget,
            committedLeafSectionId: leafSectionId,
        }),
        tabSectionId,
        splitSide: contentBounds
            ? resolvePreviewSplitSide(
                contentBounds,
                params.clientX,
                params.clientY,
                {
                    left: "left",
                    right: "right",
                    top: "top",
                    bottom: "bottom",
                } as const,
                {
                    currentSplitSide: isCurrentSectionContentTarget
                        ? params.currentTarget?.splitSide ?? null
                        : null,
                },
            )
            : null,
        contentBounds: contentBounds ?? undefined,
    };
}

function resolveWorkbenchTabDragClientPointer(
    pointer: WorkbenchTabDragPointer,
): { clientX: number; clientY: number; screenX: number; screenY: number } | null {
    const hasClientPointer = typeof pointer.clientX === "number" && typeof pointer.clientY === "number";
    const hasScreenPointer = typeof pointer.screenX === "number" && typeof pointer.screenY === "number";
    if (!hasClientPointer && !hasScreenPointer) {
        return null;
    }

    const screenLeft = typeof window.screenX === "number"
        ? window.screenX
        : (window.screenLeft ?? 0);
    const screenTop = typeof window.screenY === "number"
        ? window.screenY
        : (window.screenTop ?? 0);

    const clientX = hasClientPointer
        ? pointer.clientX!
        : pointer.screenX! - screenLeft + window.scrollX;
    const clientY = hasClientPointer
        ? pointer.clientY!
        : pointer.screenY! - screenTop + window.scrollY;
    const screenX = hasScreenPointer
        ? pointer.screenX!
        : clientX + (screenLeft - window.scrollX);
    const screenY = hasScreenPointer
        ? pointer.screenY!
        : clientY + (screenTop - window.scrollY);

    return { clientX, clientY, screenX, screenY };
}

function buildExternalTabDragSession(
    tab: TabSectionTabDefinition,
    hoverTarget: TabSectionHoverTarget,
    pointerX: number,
    pointerY: number,
): TabSectionDragSession {
    return {
        sourceTabSectionId: EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID,
        currentTabSectionId: EXTERNAL_TAB_DRAG_SOURCE_SECTION_ID,
        sourceLeafSectionId: hoverTarget.anchorLeafSectionId ?? hoverTarget.leafSectionId,
        currentLeafSectionId: hoverTarget.leafSectionId,
        tabId: tab.id,
        title: tab.title,
        content: tab.content,
        tone: tab.tone,
        pointerId: EXTERNAL_TAB_DRAG_POINTER_ID,
        originX: pointerX,
        originY: pointerY,
        pointerX,
        pointerY,
        phase: "dragging",
        hoverTarget,
    };
}

function buildImportedTabDragSession(
    tab: TabSectionTabDefinition,
    payload: WorkbenchTabDragPayload,
    hoverTarget: TabSectionHoverTarget,
    pointerX: number,
    pointerY: number,
): TabSectionDragSession {
    return {
        ...buildExternalTabDragSession(tab, hoverTarget, pointerX, pointerY),
        payload,
    };
}

function buildFallbackImportHoverTarget(
    state: VSCodeLayoutState<WorkbenchSectionData>,
): TabSectionHoverTarget | null {
    const targetSectionId = resolveActiveTabSectionId(state) ?? WORKBENCH_MAIN_TAB_SECTION_ID;
    const targetSection = state.tabSections.sections[targetSectionId];
    if (!targetSection) {
        return null;
    }

    return {
        area: "strip",
        leafSectionId: "main-tabs",
        anchorLeafSectionId: "main-tabs",
        tabSectionId: targetSection.id,
        targetIndex: targetSection.tabs.length,
    };
}

function isPointerOutsideElement(element: HTMLElement | null, clientX: number, clientY: number): boolean {
    const rect = element?.getBoundingClientRect() ?? null;
    if (!rect) {
        return true;
    }

    return (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
    );
}

export interface VSCodeWorkbenchProps {
    /** 当前 workbench 实例 ID，用于跨窗口 tab drag 的来源识别。 */
    workbenchId?: string;
    /** 当前宿主窗口 label，用于跨窗口 tab drag 的来源识别。 */
    windowLabel?: string | null;
    /** 是否只渲染 main tab section，不创建 activity/sidebar。 */
    mainOnly?: boolean;
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
    /** 初始 panel split 布局快照，用于恢复 panel icon split 拓扑。 */
    initialPanelLayoutSnapshot?: WorkbenchPanelLayoutSnapshot | null;
    /** 初始工作区主布局快照，用于恢复主编辑区 tab split 与打开的 tab。 */
    initialLayoutSnapshot?: WorkbenchLayoutSnapshot | null;
    /** 空 panel section 是否隐藏 panel bar。 */
    hideEmptyPanelBar?: boolean;
    /** 是否渲染非激活 tab 内容。默认开启以保留通用宿主的缓存行为；函数形式可按 tab 细分。 */
    renderInactiveTabContent?: TabSectionInactiveContentPolicy;
    /** 指定哪些 tab 内容需要等待组件通过 api.markContentReady 提交后再展示。 */
    deferTabContentPresentation?: (tab: TabSectionTabDefinition) => boolean;
    /** 指定哪些 panel 内容需要等待 context.markContentReady 提交后再展示。 */
    deferPanelContentPresentation?: (panel: PanelSectionPanelDefinition) => boolean;
    /** 是否在拖拽 tab 时实时渲染 split/merge 预览布局。默认开启；重型 editor 宿主可关闭以避免预览期反复 remount。 */
    renderTabDragPreviewLayout?: boolean;
    /** tab 拖拽预览布局渲染模式。inline 会替换主布局；overlay 会覆盖显示预览但保留已提交布局挂载。 */
    tabDragPreviewRenderMode?: "inline" | "overlay";
    /** 拖拽当前 active tab 时是否保留其内容挂载但隐藏。默认关闭；重型 editor 宿主可开启以避免 drag-start teardown。 */
    preserveActiveTabContentDuringDrag?: boolean;
    /** 是否在新建的 tab split preview section 中渲染真实 tab 内容。默认开启；重型 editor 宿主可关闭，仅保留预览结构和标题。 */
    renderTabContentInDragPreviewLayout?: boolean;
    /** 是否在新建的 panel split preview section 中渲染真实 panel 内容。默认开启；重型 panel 宿主可关闭，仅保留预览结构和标题。 */
    renderPanelContentInDragPreviewLayout?: boolean;
    /** 渲染轻量 tab 拖拽预览内容；用于重型宿主提供 DOM 镜像等无副作用预览。 */
    renderTabDragPreviewContent?: (
        tab: TabSectionTabDefinition,
        context: TabDragPreviewContentRenderContext,
    ) => ReactNode;
    /** 将外部 HTML5 拖拽解析为 tab，并复用 workbench tab 预览/分屏落点逻辑。 */
    externalTabDragResolver?: WorkbenchExternalTabDragResolver;

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
    /** activity bar 运行时顺序变化回调（用于宿主持久化拖拽排序）。 */
    onActivityBarsChange?: (state: ActivityBarsState) => void;
    /** activity bar 空白区域右键菜单回调。 */
    onActivityBarBackgroundContextMenu?: (event: { clientX: number; clientY: number }) => void;
    /** section 分割比例变化回调（用于持久化）。 */
    onSectionRatioChange?: (ratios: Record<string, number>) => void;
    /** panel split 布局变化回调（用于持久化）。 */
    onPanelLayoutChange?: (snapshot: WorkbenchPanelLayoutSnapshot) => void;
    /** resize-section 是否触发完整 snapshot 回调。默认开启以保留兼容行为。 */
    emitSnapshotsOnSectionResize?: boolean;
    /** section 拖拽 resize 的热路径策略。state 每帧提交 store；dom-flex 每帧只更新相邻 DOM slot，松手后提交 store。 */
    sectionResizeStrategy?: SectionResizeStrategy;
    /** 工作区主布局变化回调（用于持久化）。 */
    onLayoutSnapshotChange?: (snapshot: WorkbenchLayoutSnapshot) => void;
    /** tab 拖出当前 workbench 根容器时回调。 */
    onTabDragOutside?: (payload: WorkbenchTabDragPayload, event: { clientX: number; clientY: number; screenX: number; screenY: number }) => void;
    /** tab 拖拽回到当前 workbench 根容器时回调。 */
    onTabDragInside?: (payload: WorkbenchTabDragPayload, event: { clientX: number; clientY: number; screenX: number; screenY: number }) => void;
    /** tab 拖拽结束时回调；droppedInside 为 true 表示本 workbench 已提交落点。 */
    onTabDragEnd?: (payload: WorkbenchTabDragPayload, event: { clientX: number; clientY: number; screenX: number; screenY: number; droppedInside: boolean }) => void;

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
    a: { bars: Record<string, { id: string; icons: Array<{ id: string; label?: string; symbol?: string; activationMode?: string; meta?: Record<string, unknown> }>; selectedIconId: string | null }> },
    b: { bars: Record<string, { id: string; icons: Array<{ id: string; label?: string; symbol?: string; activationMode?: string; meta?: Record<string, unknown> }>; selectedIconId: string | null }> },
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
            const aIcon = aBar.icons[i];
            const bIcon = bBar.icons[i];
            if (aIcon.id !== bIcon.id) return false;
            if (aIcon.label !== bIcon.label) return false;
            if (aIcon.symbol !== bIcon.symbol) return false;
            if (aIcon.activationMode !== bIcon.activationMode) return false;
            const aSection = (aIcon.meta as Record<string, unknown> | undefined)?.section === "bottom" ? "bottom" : "top";
            const bSection = (bIcon.meta as Record<string, unknown> | undefined)?.section === "bottom" ? "bottom" : "top";
            if (aSection !== bSection) return false;
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

export function applyPersistedSectionRatios(
    store: Pick<VSCodeLayoutStore<WorkbenchSectionData>, "getSection" | "resizeSection">,
    ratios: Record<string, number> | null | undefined,
): boolean {
    if (!ratios) {
        return false;
    }

    let didApply = false;
    for (const [sectionId, ratio] of Object.entries(ratios)) {
        const section = store.getSection(sectionId);
        if (!section?.split) {
            continue;
        }

        store.resizeSection(sectionId, ratio, { reason: "restore-section-ratio" });
        didApply = true;
    }
    return didApply;
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
        workbenchId,
        windowLabel,
        mainOnly = false,
        initialTabs,
        hasRightSidebar = false,
        initialSidebarState,
        initialSectionRatios,
        initialPanelLayoutSnapshot,
        initialLayoutSnapshot,
        hideEmptyPanelBar = false,
        renderInactiveTabContent = true,
        deferTabContentPresentation,
        deferPanelContentPresentation,
        renderTabDragPreviewLayout = true,
        tabDragPreviewRenderMode = "inline",
        preserveActiveTabContentDuringDrag = false,
        renderTabContentInDragPreviewLayout = true,
        renderPanelContentInDragPreviewLayout = true,
        renderTabDragPreviewContent,
        externalTabDragResolver,
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
        onActivityBarsChange,
        onActivityBarBackgroundContextMenu,
        onSectionRatioChange,
        onPanelLayoutChange,
        emitSnapshotsOnSectionResize = true,
        sectionResizeStrategy = "state",
        onLayoutSnapshotChange,
        onTabDragOutside,
        onTabDragInside,
        onTabDragEnd,
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
    const toggleLeftSidebarVisible = useCallback(() => {
        setLeftSidebarVisible((visible) => !visible);
    }, []);
    const toggleRightSidebarVisible = useCallback(() => {
        setRightSidebarVisible((visible) => !visible);
    }, []);

    // --- DnD sessions ---
    const [activityBarDragSession, setActivityBarDragSession] = useState<ActivityBarDragSession | null>(null);
    const [panelDragSession, setPanelDragSession] = useState<PanelSectionDragSession | null>(null);
    const [tabDragSession, setTabDragSession] = useState<TabSectionDragSession | null>(null);
    const [externalTabDragTab, setExternalTabDragTab] = useState<TabSectionTabDefinition | null>(null);
    const committedTabDragSessionKeyRef = useRef<string | null>(null);
    const isCommittingTabDropRef = useRef(false);
    const layoutRootRef = useRef<HTMLDivElement | null>(null);
    const externalTabDragTabRef = useRef<TabSectionTabDefinition | null>(null);
    const externalTabDragResolveTokenRef = useRef(0);
    const externalTabDragResolvePendingRef = useRef(false);
    const externalTabDragHoverTargetRef = useRef<TabSectionHoverTarget | null>(null);
    const externalTabDragLastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const tabDragOutsideRef = useRef(false);
    const tabDragLastPointerRef = useRef<{ clientX: number; clientY: number; screenX: number; screenY: number } | null>(null);
    const tabDragEndHandledRef = useRef(false);
    const [readyTabContentIds, setReadyTabContentIds] = useState<ReadonlySet<string>>(() => new Set());
    const [readyPanelContentIds, setReadyPanelContentIds] = useState<ReadonlySet<string>>(() => new Set());
    const livePanelDragSession = panelDragSession && !isEndedPanelSectionDragSession(panelDragSession)
        ? panelDragSession
        : null;

    const markTabContentReady = useCallback((tabId: string): void => {
        setReadyTabContentIds((previous) => {
            if (previous.has(tabId)) {
                return previous;
            }

            const next = new Set(previous);
            next.add(tabId);
            return next;
        });
    }, []);

    const markPanelContentReady = useCallback((panelId: string): void => {
        setReadyPanelContentIds((previous) => {
            if (previous.has(panelId)) {
                return previous;
            }

            const next = new Set(previous);
            next.add(panelId);
            return next;
        });
    }, []);

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
        let initialState = createWorkbenchLayoutState({
            activities,
            panels,
            initialTabs,
            hasRightSidebar,
            mainOnly,
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
        });
        initialState = applyWorkbenchLayoutSnapshot(initialState, initialLayoutSnapshot);
        initialState = applyWorkbenchPanelLayoutSnapshot(initialState, initialPanelLayoutSnapshot);

        storeRef.current = createVSCodeLayoutStore({
            initialState,
        });
        applyPersistedSectionRatios(storeRef.current, initialSectionRatios);
    }
    const store = storeRef.current;
    const emitTabDragEnd = useCallback((session: TabSectionDragSession, droppedInside: boolean): void => {
        const payload = session.payload as WorkbenchTabDragPayload | undefined;
        if (!payload) {
            return;
        }

        const pointer = tabDragLastPointerRef.current ?? {
            clientX: session.pointerX,
            clientY: session.pointerY,
            screenX: session.pointerX,
            screenY: session.pointerY,
        };
        onTabDragEnd?.(payload, { ...pointer, droppedInside });
    }, [onTabDragEnd]);

    const commitTabDragSession = useCallback((session: TabSectionDragSession): void => {
        tabDragEndHandledRef.current = true;
        const sessionKey = [
            session.sourceTabSectionId,
            session.tabId,
            session.pointerId,
            session.originX,
            session.originY,
        ].join(":");

        if (committedTabDragSessionKeyRef.current === sessionKey) {
            setTabDragSession(null);
            emitTabDragEnd(session, false);
            return;
        }

        committedTabDragSessionKeyRef.current = sessionKey;
        const committed = commitTabWorkbenchDrop(
            store.getState().root,
            store.getState().tabSections,
            session,
            workbenchTabAdapter,
        );
        if (!committed) {
            setTabDragSession(null);
            emitTabDragEnd(session, false);
            return;
        }

        setReadyTabContentIds((previous) => {
            if (!previous.has(session.tabId)) {
                return previous;
            }

            const next = new Set(previous);
            next.delete(session.tabId);
            return next;
        });
        isCommittingTabDropRef.current = true;
        store.replaceState({
            ...store.getState(),
            root: committed.root,
            tabSections: committed.state,
            workbench: { activeGroupId: committed.activeTabSectionId },
        });
        emitTabDragEnd(session, true);
        setTabDragSession(null);
    }, [emitTabDragEnd, store]);

    useEffect(() => {
        if (!tabDragSession) {
            isCommittingTabDropRef.current = false;
            tabDragOutsideRef.current = false;
            tabDragLastPointerRef.current = null;
            tabDragEndHandledRef.current = false;
        }
    }, [tabDragSession]);

    const state = useVSCodeLayoutStoreState(store);
    const layoutRoot = useMemo(() => {
        if (mainOnly) {
            return state.root;
        }

        let nextRoot = setSectionHidden(state.root, "left-sidebar", !leftSidebarVisible);
        if (hasRightSidebar) {
            nextRoot = setSectionHidden(nextRoot, "right-sidebar", !rightSidebarVisible);
        }
        return nextRoot;
    }, [state.root, hasRightSidebar, leftSidebarVisible, mainOnly, rightSidebarVisible]);

    useEffect(() => {
        const liveTabIds = new Set<string>();
        for (const section of Object.values(state.tabSections.sections)) {
            for (const tab of section.tabs) {
                liveTabIds.add(tab.id);
            }
        }

        setReadyTabContentIds((previous) => {
            let changed = false;
            const next = new Set<string>();
            for (const tabId of previous) {
                if (liveTabIds.has(tabId)) {
                    next.add(tabId);
                } else {
                    changed = true;
                }
            }

            return changed ? next : previous;
        });
    }, [state.tabSections]);

    useEffect(() => {
        const livePanelIds = new Set<string>();
        for (const section of Object.values(state.panelSections.sections)) {
            for (const panel of section.panels) {
                livePanelIds.add(panel.id);
            }
        }

        setReadyPanelContentIds((previous) => {
            let changed = false;
            const next = new Set<string>();
            for (const panelId of previous) {
                if (livePanelIds.has(panelId)) {
                    next.add(panelId);
                } else {
                    changed = true;
                }
            }

            return changed ? next : previous;
        });
    }, [state.panelSections]);

    // --- Late-arriving section ratio restoration ---
    // backendConfig loads async, so initialSectionRatios may be undefined on
    // the first render that creates the store. Apply them once they arrive.
    const initialRatiosAppliedRef = useRef(!!initialSectionRatios);
    useEffect(() => {
        if (!initialRatiosAppliedRef.current && initialSectionRatios) {
            initialRatiosAppliedRef.current = true;
            applyPersistedSectionRatios(store, initialSectionRatios);
        }
    }, [initialSectionRatios, store]);

    const initialLayoutSnapshotAppliedRef = useRef(!!initialLayoutSnapshot);
    useEffect(() => {
        if (!initialLayoutSnapshotAppliedRef.current && initialLayoutSnapshot) {
            initialLayoutSnapshotAppliedRef.current = true;
            store.updateState((currentState) => {
                const withLayout = applyWorkbenchLayoutSnapshot(currentState, initialLayoutSnapshot);
                return applyWorkbenchPanelLayoutSnapshot(withLayout, initialPanelLayoutSnapshot);
            });
        }
    }, [initialLayoutSnapshot, initialPanelLayoutSnapshot, store]);

    const initialPanelLayoutAppliedRef = useRef(!!initialPanelLayoutSnapshot);
    useEffect(() => {
        if (!initialPanelLayoutAppliedRef.current && initialPanelLayoutSnapshot) {
            initialPanelLayoutAppliedRef.current = true;
            store.updateState((currentState) => {
                return applyWorkbenchPanelLayoutSnapshot(currentState, initialPanelLayoutSnapshot);
            });
        }
    }, [initialPanelLayoutSnapshot, store]);

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

    const onLayoutSnapshotChangeRef = useRef(onLayoutSnapshotChange);
    onLayoutSnapshotChangeRef.current = onLayoutSnapshotChange;
    useEffect(() => {
        return store.addLifecycleHook((event) => {
            if (event.phase !== "after" || !event.changed) {
                return;
            }

            if (!emitSnapshotsOnSectionResize && event.command === "resize-section") {
                return;
            }

            if (
                event.state.root === event.nextState.root &&
                event.state.tabSections === event.nextState.tabSections &&
                event.state.workbench === event.nextState.workbench
            ) {
                return;
            }

            onLayoutSnapshotChangeRef.current?.(exportWorkbenchLayoutSnapshot(event.nextState));
        });
    }, [emitSnapshotsOnSectionResize, store]);

    const onPanelLayoutChangeRef = useRef(onPanelLayoutChange);
    onPanelLayoutChangeRef.current = onPanelLayoutChange;
    useEffect(() => {
        return store.addLifecycleHook((event) => {
            if (event.phase !== "after" || !event.changed) {
                return;
            }

            if (!emitSnapshotsOnSectionResize && event.command === "resize-section") {
                return;
            }

            if (
                event.state.root === event.nextState.root &&
                event.state.panelSections === event.nextState.panelSections
            ) {
                return;
            }

            onPanelLayoutChangeRef.current?.(exportWorkbenchPanelLayoutSnapshot(event.nextState));
        });
    }, [emitSnapshotsOnSectionResize, store]);

    // --- Tab operations ---
    const openTab = useCallback((tab: WorkbenchTabDefinition): void => {
        store.updateState((currentState) => {
            const nextTab = createWorkbenchTabSectionTabDefinition(tab);

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
        let replacedTabId: string | null = null;
        let shouldTransferReadyState = false;
        store.updateState((currentState) => {
            const sectionId = findTabSectionIdByTabId(currentState.tabSections, tabId);
            if (!sectionId) {
                return currentState;
            }

            if (updates.id && updates.id !== tabId && findTabSectionIdByTabId(currentState.tabSections, updates.id)) {
                console.warn("[layout-v2] updateTab skipped: target id already exists", {
                    tabId,
                    nextTabId: updates.id,
                });
                return currentState;
            }

            const section = currentState.tabSections.sections[sectionId];
            let changed = false;
            const nextTabs = section.tabs.map((tab) => {
                if (tab.id !== tabId) {
                    return tab;
                }

                const payload = readWorkbenchTabPayload(tab);
                const nextId = updates.id ?? tab.id;
                const nextComponent = updates.component ?? payload.component;
                const nextParams = updates.params ?? payload.params;
                const nextTitle = updates.title ?? tab.title;

                if (
                    nextId === tab.id &&
                    nextComponent === payload.component &&
                    nextParams === payload.params &&
                    nextTitle === tab.title
                ) {
                    return tab;
                }

                changed = true;
                if (nextId !== tab.id) {
                    replacedTabId = nextId;
                    shouldTransferReadyState = true;
                }
                return {
                    ...tab,
                    id: nextId,
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
                        [sectionId]: {
                            ...section,
                            tabs: nextTabs,
                            focusedTabId: section.focusedTabId === tabId ? updates.id ?? tabId : section.focusedTabId,
                        },
                    },
                },
            };
        });

        if (replacedTabId) {
            const nextTabId = replacedTabId;
            const transferReadyState = shouldTransferReadyState;
            setReadyTabContentIds((previous) => {
                if (transferReadyState && previous.has(tabId)) {
                    const next = new Set(previous);
                    next.delete(tabId);
                    next.add(nextTabId);
                    return next;
                }

                if (!previous.has(tabId) && !previous.has(nextTabId)) {
                    return previous;
                }

                const next = new Set(previous);
                next.delete(tabId);
                next.delete(nextTabId);
                return next;
            });
        }
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
            if (section.focusedTabId === tabId && currentState.workbench?.activeGroupId === targetSectionId) {
                return currentState;
            }

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

    const importDraggedTab = useCallback((
        payload: WorkbenchTabDragPayload,
        options?: { closeExisting?: boolean },
    ): void => {
        const currentState = store.getState();
        const tab = createWorkbenchTabSectionTabDefinition(payload);
        const hoverTarget = buildFallbackImportHoverTarget(currentState);
        if (!hoverTarget) {
            openTab(payload);
            return;
        }

        let tabSections = currentState.tabSections;
        let root = currentState.root;
        if (options?.closeExisting && findTabSectionIdByTabId(tabSections, payload.id)) {
            const closed = closeWorkbenchTabState(currentState, payload.id);
            tabSections = closed.nextState.tabSections;
            root = closed.nextState.root;
        }

        const session = buildImportedTabDragSession(tab, payload, hoverTarget, 0, 0);
        const committed = commitTabWorkbenchDrop(
            root,
            withExternalTabDragSource(tabSections, tab, session),
            session,
            workbenchTabAdapter,
        );

        if (!committed) {
            openTab(payload);
            return;
        }

        isCommittingTabDropRef.current = true;
        store.replaceState({
            ...currentState,
            root: committed.root,
            tabSections: withoutExternalTabDragSource(committed.state),
            workbench: { activeGroupId: committed.activeTabSectionId },
        });
    }, [openTab, store]);

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
        const currentBars = store.getState().activityBars;
        const reconciledBars = reconcileActivityBarsState(currentBars, nextBars);
        // Skip update when bars content is identical to avoid unnecessary re-renders.
        if (areActivityBarsEqual(currentBars, reconciledBars)) return;
        store.resetActivityBars(reconciledBars);
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
        if (mainOnly) return;
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
    }, [leftSidebarVisible, mainOnly, store]);

    useEffect(() => {
        if (mainOnly || !hasRightSidebar) return;
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
    }, [hasRightSidebar, mainOnly, rightSidebarVisible, store]);

    // --- Sync root layout when sidebar config changes ---
    const rootLayoutSyncInitializedRef = useRef(false);
    useEffect(() => {
        if (!rootLayoutSyncInitializedRef.current) {
            rootLayoutSyncInitializedRef.current = true;
            return;
        }

        store.resetLayout(createWorkbenchRootLayout({ hasRightSidebar, mainOnly }));
    }, [hasRightSidebar, mainOnly, store]);

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

    const updateExternalTabDragTab = useCallback((tab: TabSectionTabDefinition | null): void => {
        externalTabDragTabRef.current = tab;
        setExternalTabDragTab(tab);
    }, []);

    const clearExternalTabDrag = useCallback((): void => {
        externalTabDragResolveTokenRef.current += 1;
        externalTabDragResolvePendingRef.current = false;
        externalTabDragHoverTargetRef.current = null;
        updateExternalTabDragTab(null);
        setTabDragSession((currentSession) => (
            isExternalTabDragSession(currentSession) ? null : currentSession
        ));
    }, [updateExternalTabDragTab]);

    const updateExternalTabDragSession = useCallback((
        tab: TabSectionTabDefinition,
        hoverTarget: TabSectionHoverTarget,
        pointerX: number,
        pointerY: number,
    ): void => {
        const nextSession = buildExternalTabDragSession(tab, hoverTarget, pointerX, pointerY);
        setTabDragSession((currentSession) => {
            if (
                isExternalTabDragSession(currentSession) &&
                currentSession?.tabId === nextSession.tabId &&
                currentSession.pointerX === nextSession.pointerX &&
                currentSession.pointerY === nextSession.pointerY &&
                areEquivalentTabHoverTargets(currentSession.hoverTarget, nextSession.hoverTarget)
            ) {
                return currentSession;
            }

            return nextSession;
        });
    }, []);

    const requestExternalTabDragTab = useCallback((event: DragEvent): void => {
        if (!externalTabDragResolver || externalTabDragTabRef.current || externalTabDragResolvePendingRef.current) {
            return;
        }

        const requestToken = externalTabDragResolveTokenRef.current + 1;
        externalTabDragResolveTokenRef.current = requestToken;
        externalTabDragResolvePendingRef.current = true;

        Promise.resolve(externalTabDragResolver.resolveTab(event))
            .then((resolvedTab) => {
                if (externalTabDragResolveTokenRef.current !== requestToken) {
                    return;
                }

                externalTabDragResolvePendingRef.current = false;
                if (!resolvedTab) {
                    return;
                }

                const tab = createWorkbenchTabSectionTabDefinition(resolvedTab);
                updateExternalTabDragTab(tab);
                const hoverTarget = externalTabDragHoverTargetRef.current;
                if (!hoverTarget) {
                    return;
                }

                updateExternalTabDragSession(
                    tab,
                    hoverTarget,
                    externalTabDragLastPointerRef.current.x,
                    externalTabDragLastPointerRef.current.y,
                );
            })
            .catch((error) => {
                if (externalTabDragResolveTokenRef.current !== requestToken) {
                    return;
                }

                externalTabDragResolvePendingRef.current = false;
                console.warn("[layout-v2] external tab drag resolve failed", {
                    message: error instanceof Error ? error.message : String(error),
                });
            });
    }, [externalTabDragResolver, updateExternalTabDragSession, updateExternalTabDragTab]);

    const commitExternalTabDragSession = useCallback((
        tab: TabSectionTabDefinition,
        session: TabSectionDragSession,
        options?: { closeExisting?: boolean },
    ): boolean => {
        const currentState = store.getState();
        const baseState = options?.closeExisting
            ? closeWorkbenchTabState(currentState, tab.id).nextState
            : currentState;
        const tabSectionsWithExternalSource = withExternalTabDragSource(
            baseState.tabSections,
            tab,
            session,
        );
        const committed = commitTabWorkbenchDrop(
            baseState.root,
            tabSectionsWithExternalSource,
            session,
            workbenchTabAdapter,
        );
        if (!committed) {
            return false;
        }

        isCommittingTabDropRef.current = true;
        store.replaceState({
            ...baseState,
            root: committed.root,
            tabSections: withoutExternalTabDragSource(committed.state),
            workbench: { activeGroupId: committed.activeTabSectionId },
        });
        return true;
    }, [store]);

    const handleExternalTabDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>): void => {
        if (!externalTabDragResolver?.canAccept(event.nativeEvent)) {
            return;
        }

        const hoverTarget = resolveExternalTabHoverTarget({
            event: event.nativeEvent,
            rootElement: layoutRootRef.current,
            tabSections: state.tabSections,
            currentTarget: externalTabDragHoverTargetRef.current,
        });
        if (!hoverTarget) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";

        externalTabDragHoverTargetRef.current = hoverTarget;
        externalTabDragLastPointerRef.current = {
            x: event.clientX,
            y: event.clientY,
        };

        const tab = externalTabDragTabRef.current;
        if (tab) {
            updateExternalTabDragSession(tab, hoverTarget, event.clientX, event.clientY);
            return;
        }

        requestExternalTabDragTab(event.nativeEvent);
    }, [externalTabDragResolver, requestExternalTabDragTab, state.tabSections, updateExternalTabDragSession]);

    const handleExternalTabDrop = useCallback((event: ReactDragEvent<HTMLDivElement>): void => {
        if (!externalTabDragResolver?.canAccept(event.nativeEvent)) {
            return;
        }

        const hoverTarget = resolveExternalTabHoverTarget({
            event: event.nativeEvent,
            rootElement: layoutRootRef.current,
            tabSections: state.tabSections,
            currentTarget: externalTabDragHoverTargetRef.current,
        });
        if (!hoverTarget) {
            clearExternalTabDrag();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";

        const nativeEvent = event.nativeEvent;
        const pointerX = event.clientX;
        const pointerY = event.clientY;
        const existingTab = externalTabDragTabRef.current;

        const tabPromise = existingTab
            ? Promise.resolve(existingTab)
            : Promise.resolve(externalTabDragResolver.resolveTab(nativeEvent)).then((resolvedTab) =>
                resolvedTab ? createWorkbenchTabSectionTabDefinition(resolvedTab) : null,
            );

        void tabPromise.then((tab) => {
            if (!tab) {
                return;
            }

            commitExternalTabDragSession(
                tab,
                buildExternalTabDragSession(tab, hoverTarget, pointerX, pointerY),
            );
        }).catch((error) => {
            console.warn("[layout-v2] external tab drop failed", {
                message: error instanceof Error ? error.message : String(error),
            });
        }).finally(() => {
            clearExternalTabDrag();
        });
    }, [
        clearExternalTabDrag,
        commitExternalTabDragSession,
        externalTabDragResolver,
        state.tabSections,
    ]);

    const handleExternalTabDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>): void => {
        const relatedTarget = event.relatedTarget as Node | null;
        if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
            return;
        }

        clearExternalTabDrag();
    }, [clearExternalTabDrag]);

    const cancelDraggedTab = useCallback((payload?: Pick<WorkbenchTabDragPayload, "id">): void => {
        if (payload?.id && externalTabDragTabRef.current?.id !== payload.id) {
            return;
        }

        clearExternalTabDrag();
    }, [clearExternalTabDrag]);

    const previewDraggedTab = useCallback((
        payload: WorkbenchTabDragPayload,
        pointer: WorkbenchTabDragPointer,
    ): boolean => {
        const resolvedPointer = resolveWorkbenchTabDragClientPointer(pointer);
        if (!resolvedPointer) {
            cancelDraggedTab({ id: payload.id });
            return false;
        }

        const hoverTarget = resolvePointerTabHoverTarget({
            clientX: resolvedPointer.clientX,
            clientY: resolvedPointer.clientY,
            rootElement: layoutRootRef.current,
            tabSections: store.getState().tabSections,
            currentTarget: externalTabDragHoverTargetRef.current,
        });
        if (!hoverTarget) {
            cancelDraggedTab({ id: payload.id });
            return false;
        }

        const tab = createWorkbenchTabSectionTabDefinition(payload);
        const nextSession = buildImportedTabDragSession(
            tab,
            payload,
            hoverTarget,
            resolvedPointer.clientX,
            resolvedPointer.clientY,
        );

        externalTabDragHoverTargetRef.current = hoverTarget;
        externalTabDragLastPointerRef.current = {
            x: resolvedPointer.clientX,
            y: resolvedPointer.clientY,
        };
        updateExternalTabDragTab(tab);
        setTabDragSession((currentSession) => {
            if (
                isExternalTabDragSession(currentSession) &&
                currentSession?.tabId === nextSession.tabId &&
                currentSession.pointerX === nextSession.pointerX &&
                currentSession.pointerY === nextSession.pointerY &&
                areEquivalentTabHoverTargets(currentSession.hoverTarget, nextSession.hoverTarget)
            ) {
                return currentSession;
            }

            return nextSession;
        });
        return true;
    }, [cancelDraggedTab, store, updateExternalTabDragTab]);

    const dropDraggedTab = useCallback((
        payload: WorkbenchTabDragPayload,
        pointer: WorkbenchTabDragPointer,
    ): boolean => {
        const resolvedPointer = resolveWorkbenchTabDragClientPointer(pointer);
        if (!resolvedPointer) {
            cancelDraggedTab({ id: payload.id });
            return false;
        }

        const hoverTarget = resolvePointerTabHoverTarget({
            clientX: resolvedPointer.clientX,
            clientY: resolvedPointer.clientY,
            rootElement: layoutRootRef.current,
            tabSections: store.getState().tabSections,
            currentTarget: externalTabDragHoverTargetRef.current,
        }) ?? (
            tabDragSession?.payload &&
            (tabDragSession.payload as WorkbenchTabDragPayload).id === payload.id
                ? tabDragSession.hoverTarget
                : null
        );
        if (!hoverTarget) {
            cancelDraggedTab({ id: payload.id });
            return false;
        }

        const tab = externalTabDragTabRef.current?.id === payload.id
            ? externalTabDragTabRef.current
            : createWorkbenchTabSectionTabDefinition(payload);
        const session = buildImportedTabDragSession(
            tab,
            payload,
            hoverTarget,
            resolvedPointer.clientX,
            resolvedPointer.clientY,
        );
        const didCommit = commitExternalTabDragSession(tab, session, { closeExisting: true });
        clearExternalTabDrag();
        return didCommit;
    }, [cancelDraggedTab, clearExternalTabDrag, commitExternalTabDragSession, store, tabDragSession]);

    // --- Build panel context ---
    const buildPanelContext = useCallback((hostPanelId: string | null): WorkbenchPanelContext => ({
        activeTabId,
        hostPanelId,
        openTab,
        updateTab,
        closeTab,
        setActiveTab,
        activatePanel: activatePanelById,
        markContentReady: () => {
            if (hostPanelId) {
                markPanelContentReady(hostPanelId);
            }
        },
    }), [activeTabId, openTab, updateTab, closeTab, setActiveTab, activatePanelById, markPanelContentReady]);

    // --- Tab DnD preview ---
    const effectiveTabDragSession = isCommittingTabDropRef.current ? null : tabDragSession;
    const tabSectionsForTabPreview = useMemo(
        () => withExternalTabDragSource(state.tabSections, externalTabDragTab, effectiveTabDragSession),
        [state.tabSections, externalTabDragTab, effectiveTabDragSession?.sourceTabSectionId, effectiveTabDragSession?.tabId],
    );
    const tabPreview = useMemo(
        () => renderTabDragPreviewLayout
            ? buildTabWorkbenchPreviewState(layoutRoot, tabSectionsForTabPreview, effectiveTabDragSession, workbenchTabAdapter)
            : null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when phase/hoverTarget changes, not on every pointer move
        [renderTabDragPreviewLayout, layoutRoot, tabSectionsForTabPreview, effectiveTabDragSession?.phase, effectiveTabDragSession?.hoverTarget],
    );
    const shouldRenderTabPreviewOverlay = Boolean(tabPreview && tabDragPreviewRenderMode === "overlay");
    const shouldRenderInlineTabPreview = !shouldRenderTabPreviewOverlay;
    const tabPreviewedRoot = shouldRenderInlineTabPreview ? tabPreview?.root ?? layoutRoot : layoutRoot;
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
                    const payload = readWorkbenchTabPayload(tab);
                    return { id: tab.id, title: tab.title, component: payload.component, params: payload.params };
                }
            }
            return null;
        },
        getTabs: () => {
            const result: Array<{ id: string; title: string; component: string; params: Record<string, unknown> }> = [];
            for (const section of Object.values(store.getState().tabSections.sections)) {
                for (const tab of section.tabs) {
                    const payload = readWorkbenchTabPayload(tab);
                    result.push({ id: tab.id, title: tab.title, component: payload.component, params: payload.params });
                }
            }
            return result;
        },
        exportLayoutSnapshot: () => exportWorkbenchLayoutSnapshot(store.getState()),
        importDraggedTab,
        previewDraggedTab,
        dropDraggedTab,
        cancelDraggedTab,
        setLeftSidebarVisible,
        toggleLeftSidebarVisible,
        setRightSidebarVisible,
        toggleRightSidebarVisible,
    }), [
        openTab,
        updateTab,
        closeTab,
        importDraggedTab,
        previewDraggedTab,
        dropDraggedTab,
        cancelDraggedTab,
        setActiveTab,
        activatePanelById,
        store,
        toggleLeftSidebarVisible,
        toggleRightSidebarVisible,
    ]);

    const updateWorkbenchTabDragSession = useCallback((session: TabSectionDragSession | null): void => {
        tabDragEndHandledRef.current = false;
        if (!session) {
            setTabDragSession(null);
            return;
        }

        const sourceTab = store.getState().tabSections.sections[session.sourceTabSectionId]?.tabs.find((tab) => tab.id === session.tabId) ?? null;
        const payload = (session.payload as WorkbenchTabDragPayload | undefined) ?? (sourceTab
            ? createWorkbenchTabDragPayload({
                tab: sourceTab,
                session,
                workbenchId,
                windowLabel,
            })
            : undefined);
        const inside = !isPointerOutsideElement(layoutRootRef.current, session.pointerX, session.pointerY);
        const pointer = {
            clientX: session.pointerX,
            clientY: session.pointerY,
            screenX: session.pointerX + (window.screenX - window.scrollX),
            screenY: session.pointerY + (window.screenY - window.scrollY),
        };
        tabDragLastPointerRef.current = pointer;

        if (payload) {
            if (!inside && !tabDragOutsideRef.current) {
                tabDragOutsideRef.current = true;
                onTabDragOutside?.(payload, pointer);
            } else if (inside && tabDragOutsideRef.current) {
                tabDragOutsideRef.current = false;
                onTabDragInside?.(payload, pointer);
            } else if (!inside && tabDragOutsideRef.current) {
                onTabDragOutside?.(payload, pointer);
            }
        }

        setTabDragSession(payload ? { ...session, payload } : session);
    }, [onTabDragInside, onTabDragOutside, store, windowLabel, workbenchId]);

    const handleWorkbenchTabDragPreviewEnd = useCallback((session: TabSectionDragSession): void => {
        if (tabDragOutsideRef.current && !session.hoverTarget) {
            tabDragEndHandledRef.current = true;
            emitTabDragEnd(session, false);
            tabDragOutsideRef.current = false;
            setTabDragSession(null);
            return;
        }

        commitTabDragSession(session);
        tabDragOutsideRef.current = false;
    }, [commitTabDragSession, emitTabDragEnd]);

    // --- Component registry ---
    const leftActivityBarState = mainOnly ? null : state.activityBars.bars[WORKBENCH_LEFT_ACTIVITY_BAR_ID] ?? null;

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
                        const notifyActivityBarsChanged = (): void => {
                            onActivityBarsChange?.(store.getState().activityBars);
                        };

                        if (session.contentTarget?.splitSide) {
                            const committed = commitActivityBarContentDrop(
                                store.getState().root,
                                store.getState().panelSections,
                                session.contentTarget,
                                workbenchPanelAdapter,
                            );
                            if (!committed) {
                                notifyActivityBarsChanged();
                                return;
                            }

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

                        notifyActivityBarsChanged();
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
            const shouldRenderPanelContent = !isPreviewLeaf || renderPanelContentInDragPreviewLayout;
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
                    deferPanelContentPresentation={deferPanelContentPresentation}
                    isPanelContentReady={(panel) => readyPanelContentIds.has(panel.id)}
                    renderPanelTab={(panel) => (
                        (panel.meta?.icon as ReactNode | undefined) ?? (
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{panel.symbol}</span>
                        )
                    )}
                    renderPanelContent={(panel) => {
                        if (!shouldRenderPanelContent) {
                            return <div style={{ padding: 12, opacity: 0.72, fontSize: 12 }}>{panel.label}</div>;
                        }

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

                        setReadyPanelContentIds((previous) => {
                            if (!previous.has(session.panelId)) {
                                return previous;
                            }

                            const next = new Set(previous);
                            next.delete(session.panelId);
                            return next;
                        });
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

            if (!tabSection) {
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
                            return renderTabDragPreviewContent?.(tab, {
                                leafSectionId: section.id,
                                tabSectionId: tabSection.id,
                                renderMode: "inline",
                                isPreviewTabSection: tabSection.id.startsWith(PREVIEW_TAB_SECTION_ID_PREFIX),
                            }) ?? renderDefaultTabDragPreviewContent(tab);
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
                                    markContentReady: () => markTabContentReady(tab.id),
                                }}
                            />
                        );
                    }}
                    renderInactiveTabContent={renderInactiveTabContent}
                    deferTabContentPresentation={deferTabContentPresentation}
                    isTabContentReady={(tab) => readyTabContentIds.has(tab.id)}
                    preserveActiveTabContentDuringDrag={preserveActiveTabContentDuringDrag}
                    renderDraggedTabPlaceholder={!shouldRenderTabPreviewOverlay}
                    onDragSessionChange={updateWorkbenchTabDragSession}
                    onDragSessionEnd={commitTabDragSession}
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
        deferPanelContentPresentation,
        deferTabContentPresentation,
        readyPanelContentIds,
        readyTabContentIds,
        markTabContentReady,
        renderTabDragPreviewLayout,
        shouldRenderTabPreviewOverlay,
        tabDragPreviewRenderMode,
        preserveActiveTabContentDuringDrag,
        renderTabContentInDragPreviewLayout,
        renderTabDragPreviewContent,
        tabComponents,
        renderedPanelSections,
        renderedTabSections,
        buildPanelContext,
        onActivateActivity,
        onSelectActivity,
        onActivityBarsChange,
        activatePanelById,
        openTab,
        closeTab,
        moveWorkbenchTab,
        commitTabDragSession,
        updateWorkbenchTabDragSession,
        setActiveTab,
        store,
        workbenchId,
        windowLabel,
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
                    renderTabDragPreviewContent?.(tab, {
                        leafSectionId: section.id,
                        tabSectionId: tabSection.id,
                        renderMode: "overlay",
                        isPreviewTabSection: tabSection.id.startsWith(PREVIEW_TAB_SECTION_ID_PREFIX),
                    }) ?? renderDefaultTabDragPreviewContent(tab)
                )}
                onDragSessionChange={() => { }}
                onFocusTab={() => { }}
                onCloseTab={() => { }}
                onMoveTab={() => { }}
            />
        );
    }, [renderTabDragPreviewContent, renderTabTitle, tabPreview]);

    return (
        <TabDragSessionContext.Provider value={effectiveTabDragSession}>
        <div
            ref={layoutRootRef}
            className={className}
            style={{ width: "100%", height: "100%", position: "relative" }}
            role="main"
            aria-label="Dockview Main Area"
            data-testid="main-dockview-host"
            data-layout-tab-preview-render-mode={shouldRenderTabPreviewOverlay ? "overlay" : "inline"}
            onDragEnterCapture={handleExternalTabDragOver}
            onDragEnter={handleExternalTabDragOver}
            onDragOverCapture={handleExternalTabDragOver}
            onDragOver={handleExternalTabDragOver}
            onDropCapture={handleExternalTabDrop}
            onDrop={handleExternalTabDrop}
            onDragLeave={handleExternalTabDragLeave}
        >
            <SectionLayoutView
                root={renderedRoot}
                renderSection={(section: SectionNode<WorkbenchSectionData>) => (
                    <SectionComponentHost section={section} registry={registry} />
                )}
                onResizeSection={(sectionId, ratio) => store.resizeSection(sectionId, ratio)}
                resizeStrategy={sectionResizeStrategy}
            />
            {shouldRenderTabPreviewOverlay && tabPreview ? (
                <div
                    className="layout-v2-tab-preview-overlay"
                    aria-hidden="true"
                    data-layout-tab-preview-overlay="true"
                    style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}
                >
                    <TabDragSessionContext.Provider value={null}>
                        <SectionLayoutView
                            root={tabPreview.root}
                            renderSection={renderTabPreviewOverlaySection}
                            onResizeSection={() => { }}
                        />
                    </TabDragSessionContext.Provider>
                </div>
            ) : null}
            <TabSectionDragPreview
                session={effectiveTabDragSession}
                onSessionChange={updateWorkbenchTabDragSession}
                onSessionEnd={handleWorkbenchTabDragPreviewEnd}
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
