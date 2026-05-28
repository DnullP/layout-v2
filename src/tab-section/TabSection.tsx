/**
 * @module host/layout-v2/tab-section/TabSection
 * @description tab section 组件。
 *   该组件将 section 渲染为 tab strip + content 两段结构，
 *   支持 tab focus、关闭、strip 内实时重排，以及 content 区域的分区预览。
 * @dependencies
 *   - react
 *   - ../layoutModel
 *   - ./tabSectionModel
 *   - ./tabSection.css
 *
 * @example
 *   <TabSection
 *     sectionId="main"
 *     tabSectionId="main-tabs"
 *     tabSection={tabs.getSection("main-tabs")}
 *     dragSession={dragSession}
 *     onDragSessionChange={setDragSession}
 *     onFocusTab={(tabId) => tabs.focusTab("main-tabs", tabId)}
 *     onCloseTab={(tabId) => closeTab("main-tabs", tabId)}
 *     onMoveTab={(move) => tabs.moveTab(move)}
 *   />
 *
 * @exports
 *   - TabSectionContentRenderer   tab 内容渲染函数签名
 *   - TabSectionContentRendererRegistry tab 内容渲染注册表
 *   - TabSectionSplitSide         content 分区预览方位
 *   - TabSectionHoverTarget       当前 hover 目标
 *   - TabSectionPointerPressPayload pointer 按下载荷
 *   - TabSectionDragSession       全局拖拽会话
 *   - TabSection                  组件本体
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  arePreviewHoverTargetsEqual,
  resolvePreviewAnchorLeafSectionId,
  resolvePreviewContentSession,
  resolvePreviewSplitSide,
  isPointerInsidePreviewBounds,
  type PreviewHoverTargetBase,
} from "../section/previewSession";
import {
  TAB_SECTION_DRAG_START_DISTANCE_PX,
  type TabSectionDragSession,
  type TabSectionHoverTarget,
  type TabSectionPointerPressPayload,
  type TabSectionSplitSide,
} from "./tabSectionDrag";
import { type TabSectionStateItem, type TabSectionTabDefinition, type TabSectionTabMove } from "./tabSectionModel";
import {
  mergeLayoutFocusAttributes,
  type TabSectionFocusBridge,
} from "../vscode-layout/focusBridge";
import "./tabSection.css";

export type {
  TabSectionDragSession,
  TabSectionHoverTarget,
  TabSectionPointerPressPayload,
  TabSectionSplitSide,
} from "./tabSectionDrag";

export type { TabSectionTabDefinition } from "./tabSectionModel";

export const TabDragSessionContext = createContext<TabSectionDragSession | null>(null);
/**
 * @type TabSectionContentRenderer
 * @description 单个 tab 内容渲染函数。
 */
export type TabSectionContentRenderer = (tab: TabSectionTabDefinition) => ReactNode;

export type TabSectionTitleRenderer = (tab: TabSectionTabDefinition) => ReactNode;

/**
 * @type TabSectionContentRendererRegistry
 * @description 基于 tab.type 分发的内容渲染注册表。
 */
export type TabSectionContentRendererRegistry = Record<string, TabSectionContentRenderer>;

/**
 * @type TabSectionInactiveContentPolicy
 * @description 控制非激活 tab 内容是否保留挂载；boolean 表示全局策略，函数表示按 tab 细分。
 */
export type TabSectionInactiveContentPolicy = boolean | ((tab: TabSectionTabDefinition) => boolean);

/**
 * @type TabSectionPresentationPolicy
 * @description 判断 tab 内容是否需要等待内部组件提交 ready 后再展示。
 */
export type TabSectionPresentationPolicy = (tab: TabSectionTabDefinition) => boolean;

/**
 * @type TabSectionContentReadyResolver
 * @description 查询 tab 内容是否已经完成首开初始化，可提交到可见层。
 */
export type TabSectionContentReadyResolver = (tab: TabSectionTabDefinition) => boolean;

/**
 * @constant TAB_STRIP_HYSTERESIS_PX
 * @description 相邻 tab 落点切换时的滞回范围。
 */
const TAB_STRIP_HYSTERESIS_PX = 8;

/**
 * @function buildTabSectionDragSession
 * @description 基于 pointer 按下载荷创建拖拽会话。
 * @param payload pointer 按下载荷。
 * @returns 初始拖拽会话。
 */
function buildTabSectionDragSession(
  payload: TabSectionPointerPressPayload,
): TabSectionDragSession {
  return {
    sourceTabSectionId: payload.tabSectionId,
    currentTabSectionId: payload.tabSectionId,
    sourceLeafSectionId: payload.leafSectionId,
    currentLeafSectionId: payload.leafSectionId,
    tabId: payload.tabId,
    title: payload.title,
    content: payload.content,
    tone: payload.tone,
    pointerId: payload.pointerId,
    originX: payload.clientX,
    originY: payload.clientY,
    pointerX: payload.clientX,
    pointerY: payload.clientY,
    phase: "pending",
    hoverTarget: {
      area: "strip",
      leafSectionId: payload.leafSectionId,
      anchorLeafSectionId: payload.leafSectionId,
      tabSectionId: payload.tabSectionId,
      targetIndex: payload.index,
    },
  };
}

/**
 * @function readElementTranslateX
 * @description 读取元素 transform 中的 translateX。
 * @param element 目标元素。
 * @returns translateX 位移，未命中时返回 0。
 */
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

/**
 * @function getSlotMidpointX
 * @description 获取 tab slot 的逻辑中线位置。
 * @param slotElement slot 元素。
 * @returns 逻辑中线横坐标。
 */
function getSlotMidpointX(slotElement: HTMLDivElement): number {
  const rect = slotElement.getBoundingClientRect();
  const logicalLeft = rect.left - readElementTranslateX(slotElement);
  return logicalLeft + rect.width / 2;
}

/**
 * @function getTabTargetIndexFromPointer
 * @description 根据 pointer 横坐标计算 strip 内目标插入索引。
 * @param pointerX 当前横坐标。
 * @param slotRefs tab slot 引用表。
 * @param tabIds 当前 tab 顺序。
 * @param currentTargetIndex 当前已记录的目标索引。
 * @returns 目标插入索引。
 */
function getTabTargetIndexFromPointer(
  pointerX: number,
  slotRefs: Record<string, HTMLDivElement | null>,
  tabIds: string[],
  currentTargetIndex?: number,
): number {
  let candidateIndex = tabIds.length;

  for (let index = 0; index < tabIds.length; index += 1) {
    const tabId = tabIds[index];
    const slotElement = slotRefs[tabId];
    if (!slotElement) {
      continue;
    }

    if (pointerX < getSlotMidpointX(slotElement)) {
      candidateIndex = index;
      break;
    }
  }

  if (
    currentTargetIndex === undefined ||
    currentTargetIndex < 0 ||
    Math.abs(candidateIndex - currentTargetIndex) !== 1
  ) {
    return candidateIndex;
  }

  const boundarySlotIndex = Math.min(candidateIndex, currentTargetIndex);
  const boundarySlotId = tabIds[boundarySlotIndex];
  const boundarySlot = boundarySlotId ? slotRefs[boundarySlotId] : null;
  if (!boundarySlot) {
    return candidateIndex;
  }

  const boundaryX = getSlotMidpointX(boundarySlot);
  if (Math.abs(pointerX - boundaryX) <= TAB_STRIP_HYSTERESIS_PX) {
    return currentTargetIndex;
  }

  return candidateIndex;
}

/**
 * @function resolveContentSplitSide
 * @description 根据 pointer 在 content 内的位置解析预览分区方位。
 * @param rect content 区域矩形。
 * @param pointerX 当前横坐标。
 * @param pointerY 当前纵坐标。
 * @returns 命中的预览分区；位于中央区域时返回 null。
 */

function getTabSectionHoverTargetId(target: PreviewHoverTargetBase<"strip" | "content", TabSectionSplitSide> & { tabSectionId?: string }): string {
  return target.tabSectionId ?? "";
}

/**
 * @function getCardToneClassName
 * @description 根据 card tone 生成对应类名。
 * @param tone card 语义色。
 * @returns 对应类名。
 */
function getCardToneClassName(tone: TabSectionTabDefinition["tone"]): string {
  if (!tone || tone === "neutral") {
    return "layout-v2-tab-section__card--neutral";
  }

  return `layout-v2-tab-section__card--${tone}`;
}

function getTabSectionPreviewContentRect(tabSectionId: string): DOMRect | null {
  if (typeof document === "undefined" || typeof CSS === "undefined" || typeof CSS.escape !== "function") {
    return null;
  }

  const previewContent = document.querySelector<HTMLElement>(
    `[data-layout-tab-preview-overlay='true'] .layout-v2-tab-section[data-tab-section-id='${CSS.escape(tabSectionId)}'] .layout-v2-tab-section__content`,
  );

  return previewContent?.getBoundingClientRect() ?? null;
}

/**
 * @function resolveTabCardBody
 * @description 解析当前 tab 的主体内容。
 *   优先使用 renderTabContent，其次使用按 type 分发的 registry，最后回退到字符串 content。
 * @param tab 当前 tab。
 * @param renderTabContent 显式内容渲染函数。
 * @param contentRegistry 基于 tab.type 的注册表。
 * @returns 渲染结果。
 */
function resolveTabCardBody(
  tab: TabSectionTabDefinition,
  renderTabContent?: TabSectionContentRenderer,
  contentRegistry?: TabSectionContentRendererRegistry,
): ReactNode {
  if (renderTabContent) {
    return renderTabContent(tab);
  }

  if (tab.type && contentRegistry?.[tab.type]) {
    return contentRegistry[tab.type](tab);
  }

  return tab.content;
}

/**
 * @function TabSection
 * @description 渲染单个 tab section。
 * @param props 组件属性。
 * @returns tab section React 节点。
 */
export function TabSection(props: {
  leafSectionId: string;
  committedLeafSectionId?: string;
  tabSectionId: string;
  tabSection: TabSectionStateItem | null;
  dragSession?: TabSectionDragSession | null;
  focusBridge?: TabSectionFocusBridge<TabSectionStateItem, TabSectionTabDefinition>;
  interactive?: boolean;
  allowContentPreview?: boolean;
  trackPointerLifecycle?: boolean;
  contentRegistry?: TabSectionContentRendererRegistry;
  renderTabContent?: TabSectionContentRenderer;
  renderTabTitle?: TabSectionTitleRenderer;
  renderInactiveTabContent?: TabSectionInactiveContentPolicy;
  deferTabContentPresentation?: TabSectionPresentationPolicy;
  isTabContentReady?: TabSectionContentReadyResolver;
  preserveActiveTabContentDuringDrag?: boolean;
  renderDraggedTabPlaceholder?: boolean;
  onDragSessionChange?: (session: TabSectionDragSession | null) => void;
  onDragSessionEnd?: (session: TabSectionDragSession) => void;
  onFocusTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onMoveTab: (move: TabSectionTabMove) => void;
}): ReactNode {
  const {
    leafSectionId,
    committedLeafSectionId: committedLeafSectionIdProp,
    tabSectionId,
    tabSection,
    dragSession: controlledDragSession,
    focusBridge,
    interactive: interactiveProp,
    allowContentPreview: allowContentPreviewProp,
    trackPointerLifecycle = true,
    contentRegistry,
    renderTabContent,
    renderTabTitle,
    renderInactiveTabContent = true,
    deferTabContentPresentation,
    isTabContentReady,
    preserveActiveTabContentDuringDrag = false,
    renderDraggedTabPlaceholder = true,
    onDragSessionChange,
    onDragSessionEnd,
    onFocusTab,
    onCloseTab,
    onMoveTab,
  } = props;
  const contextDragSession = useContext(TabDragSessionContext);
  const [internalDragSession, setInternalDragSession] = useState<TabSectionDragSession | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousSlotLeftsRef = useRef<Record<string, number>>({});
  const hoverTargetClearFrameRef = useRef<number>(0);
  const dragSession = controlledDragSession ?? contextDragSession ?? internalDragSession;
  const dragSessionRef = useRef<TabSectionDragSession | null>(dragSession);
  const updateDragSession = onDragSessionChange ?? setInternalDragSession;

  // Derive committedLeafSectionId, interactive, allowContentPreview from drag session
  // when NOT explicitly provided (context-driven mode).
  const isDragging = Boolean(dragSession);
  const isPreviewLeaf = isDragging && leafSectionId.startsWith("preview-section");
  const committedLeafSectionId = committedLeafSectionIdProp ??
    (isPreviewLeaf && dragSession?.hoverTarget?.anchorLeafSectionId
      ? dragSession.hoverTarget.anchorLeafSectionId
      : leafSectionId);
  const interactive = interactiveProp ?? !isPreviewLeaf;
  const allowContentPreview = allowContentPreviewProp ?? isPreviewLeaf;

  dragSessionRef.current = dragSession;

  if (!tabSection) {
    console.warn("[layout-v2] tab section state is missing", {
      leafSectionId,
      tabSectionId,
    });
    return null;
  }

  const activeCard = tabSection.tabs.find((tab) => tab.id === tabSection.focusedTabId) ?? null;
  const isTabReadyForPresentation = (tab: TabSectionTabDefinition): boolean => {
    if (!(deferTabContentPresentation?.(tab) ?? false)) {
      return true;
    }

    return isTabContentReady?.(tab) ?? false;
  };
  const initialCommittedCardId = activeCard && isTabReadyForPresentation(activeCard)
    ? activeCard.id
    : null;
  const [committedCardId, setCommittedCardId] = useState<string | null>(initialCommittedCardId);
  const committedCard = committedCardId
    ? tabSection.tabs.find((tab) => tab.id === committedCardId) ?? null
    : null;
  const isActiveCardReadyForPresentation = activeCard
    ? isTabReadyForPresentation(activeCard)
    : false;
  const draggingTabId = renderDraggedTabPlaceholder && dragSession?.currentTabSectionId === tabSection.id
    ? dragSession.tabId
    : null;
  const isDraggingLoneSourceTab = Boolean(
    dragSession?.phase === "dragging" &&
    dragSession.sourceTabSectionId === tabSection.id &&
    tabSection.tabs.length === 1 &&
    tabSection.tabs[0]?.id === dragSession.tabId,
  );
  const canPreviewRetargetContent = Boolean(
    allowContentPreview &&
    dragSession &&
    !tabSection.tabs.some((tab) => tab.id === dragSession.tabId),
  );
  const shouldHideActiveCard = Boolean(
    dragSession?.phase === "dragging" &&
    activeCard &&
    activeCard.id === dragSession.tabId,
  );
  const visibleCardId = shouldHideActiveCard
    ? null
    : isActiveCardReadyForPresentation
      ? activeCard?.id ?? null
      : committedCard?.id ?? null;
  const pendingCardId = !shouldHideActiveCard && activeCard && !isActiveCardReadyForPresentation
    ? activeCard.id
    : null;
  const preservedDraggingCardId = shouldHideActiveCard && preserveActiveTabContentDuringDrag
    ? activeCard?.id ?? null
    : null;
  const renderedCardId = visibleCardId ?? preservedDraggingCardId;
  const shouldRenderInactiveTab = (tab: TabSectionTabDefinition): boolean => {
    if (renderInactiveTabContent === true) {
      return true;
    }

    if (typeof renderInactiveTabContent === "function") {
      return renderInactiveTabContent(tab);
    }

    return false;
  };
  const renderedContentTabs = tabSection.tabs.filter((tab) => {
    if (renderedCardId && tab.id === renderedCardId) {
      return true;
    }

    if (pendingCardId && tab.id === pendingCardId) {
      return true;
    }

    return shouldRenderInactiveTab(tab);
  });

  useLayoutEffect(() => {
    if (activeCard && isTabReadyForPresentation(activeCard)) {
      if (committedCardId !== activeCard.id) {
        setCommittedCardId(activeCard.id);
      }
      return;
    }

    if (committedCardId && !tabSection.tabs.some((tab) => tab.id === committedCardId)) {
      setCommittedCardId(null);
    }
  }, [activeCard?.id, committedCardId, deferTabContentPresentation, isTabContentReady, tabSection.tabs]);

  useEffect(() => {
    if (!trackPointerLifecycle || !dragSession || !tabSection.tabs.some((tab) => tab.id === dragSession.tabId)) {
      return;
    }
    const currentDragSession: TabSectionDragSession = dragSession;
    let pendingEvent: PointerEvent | null = null;
    let frameId = 0;

    function flushPointerMove(): TabSectionDragSession | null {
      frameId = 0;
      const event = pendingEvent;
      pendingEvent = null;
      if (!event) {
        return dragSessionRef.current;
      }

      const baseSession = dragSessionRef.current ?? currentDragSession;

      const distance = Math.hypot(
        event.clientX - baseSession.originX,
        event.clientY - baseSession.originY,
      );
      const nextPhase = baseSession.phase === "pending" && distance >= TAB_SECTION_DRAG_START_DISTANCE_PX
        ? "dragging"
        : baseSession.phase;

      if (
        nextPhase === baseSession.phase &&
        baseSession.pointerX === event.clientX &&
        baseSession.pointerY === event.clientY
      ) {
        return baseSession;
      }

      const nextSession: TabSectionDragSession = {
        ...baseSession,
        phase: nextPhase,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
      dragSessionRef.current = nextSession;
      updateDragSession(nextSession);
      return nextSession;
    }

    function handlePointerMove(event: PointerEvent): void {
      const baseSession = dragSessionRef.current ?? currentDragSession;
      if (event.pointerId !== baseSession.pointerId) {
        return;
      }

      pendingEvent = event;
      if (!frameId) {
        frameId = window.requestAnimationFrame(flushPointerMove);
      }
    }

    function handlePointerEnd(event: PointerEvent): void {
      const baseSession = dragSessionRef.current ?? currentDragSession;
      if (event.pointerId !== baseSession.pointerId) {
        return;
      }

      let finalSession = dragSessionRef.current ?? currentDragSession;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        finalSession = flushPointerMove() ?? finalSession;
      }

      dragSessionRef.current = null;
      updateDragSession(null);

      if (finalSession?.phase === "dragging") {
        onDragSessionEnd?.(finalSession);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragSession, onDragSessionEnd, tabSection.tabs, trackPointerLifecycle, updateDragSession]);

  useEffect(() => {
    document.body.classList.toggle("layout-v2--dragging", dragSession?.phase === "dragging");

    return () => {
      if (dragSession?.phase === "dragging") {
        document.body.classList.remove("layout-v2--dragging");
      }
    };
  }, [dragSession?.phase]);

  useLayoutEffect(() => {
    const nextSlotLefts: Record<string, number> = {};
    const disableFlipAnimation = dragSession?.phase === "dragging";

    tabSection.tabs.forEach((tab) => {
      const slotElement = slotRefs.current[tab.id];
      if (!slotElement) {
        return;
      }

      const nextLeft = slotElement.getBoundingClientRect().left;
      const previousLeft = previousSlotLeftsRef.current[tab.id];
      nextSlotLefts[tab.id] = nextLeft;

      if (disableFlipAnimation) {
        slotElement.style.transition = "none";
        slotElement.style.transform = "none";
        return;
      }

      if (previousLeft === undefined || previousLeft === nextLeft) {
        return;
      }

      const deltaX = previousLeft - nextLeft;
      slotElement.style.transition = "none";
      slotElement.style.transform = `translateX(${deltaX}px)`;
      void slotElement.getBoundingClientRect();
      requestAnimationFrame(() => {
        slotElement.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
        slotElement.style.transform = "translateX(0)";
      });
    });

    previousSlotLeftsRef.current = nextSlotLefts;
  }, [dragSession?.phase, tabSection.tabs]);

  useEffect(() => {
    // A lone source tab is pre-destroyed in preview; after that, the survivor
    // section owns hit-testing even while the committed source DOM still exists.
    if (isDraggingLoneSourceTab || (!interactive && !canPreviewRetargetContent) || !dragSession || dragSession.phase !== "dragging") {
      if (hoverTargetClearFrameRef.current) {
        window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
        hoverTargetClearFrameRef.current = 0;
      }
      return;
    }

    const stripRect = stripRef.current?.getBoundingClientRect() ?? null;
    const committedContentRect = contentRef.current?.getBoundingClientRect() ?? null;
    // Overlay preview reflects the pre-destroyed layout, so use it as the
    // content hit-test bounds when retargeting into a non-source section.
    const contentRect = dragSession.currentTabSectionId !== tabSection.id
      ? getTabSectionPreviewContentRect(tabSection.id) ?? committedContentRect
      : committedContentRect;
    const isCurrentSectionContentTarget = Boolean(
      dragSession.hoverTarget?.area === "content" &&
      dragSession.hoverTarget.tabSectionId === tabSection.id,
    );
    const { contentBounds, shouldPreferStableContentTarget } = resolvePreviewContentSession({
      currentTarget: dragSession.hoverTarget,
      isCurrentSectionContentTarget,
      contentRect,
      pointerX: dragSession.pointerX,
      pointerY: dragSession.pointerY,
    });
    const insideStrip = Boolean(
      interactive &&
      !shouldPreferStableContentTarget &&
      stripRect &&
      dragSession.pointerX >= stripRect.left &&
      dragSession.pointerX <= stripRect.right &&
      dragSession.pointerY >= stripRect.top &&
      dragSession.pointerY <= stripRect.bottom,
    );
    const insideContent = isPointerInsidePreviewBounds(
      contentBounds,
      dragSession.pointerX,
      dragSession.pointerY,
    );

    if (insideStrip) {
      if (hoverTargetClearFrameRef.current) {
        window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
        hoverTargetClearFrameRef.current = 0;
      }
      const targetIndex = getTabTargetIndexFromPointer(
        dragSession.pointerX,
        slotRefs.current,
        tabSection.tabs.map((tab) => tab.id),
        dragSession.hoverTarget?.area === "strip" && dragSession.hoverTarget.tabSectionId === tabSection.id
          ? dragSession.hoverTarget.targetIndex
          : undefined,
      );

      const nextTarget: TabSectionHoverTarget = {
        area: "strip",
        leafSectionId,
        anchorLeafSectionId: committedLeafSectionId,
        tabSectionId: tabSection.id,
        targetIndex,
      };

      if (
        dragSession.currentTabSectionId !== tabSection.id ||
        dragSession.hoverTarget?.targetIndex !== targetIndex ||
        dragSession.hoverTarget?.tabSectionId !== tabSection.id ||
        dragSession.hoverTarget?.area !== "strip"
      ) {
        onMoveTab({
          sourceSectionId: dragSession.currentTabSectionId,
          targetSectionId: tabSection.id,
          tabId: dragSession.tabId,
          targetIndex,
        });
        updateDragSession({
          ...dragSession,
          currentTabSectionId: tabSection.id,
          currentLeafSectionId: leafSectionId,
          hoverTarget: nextTarget,
        });
      }
      return;
    }

    if (insideContent && contentBounds) {
      if (hoverTargetClearFrameRef.current) {
        window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
        hoverTargetClearFrameRef.current = 0;
      }
      const nextTarget: TabSectionHoverTarget = {
        area: "content",
        leafSectionId,
        anchorLeafSectionId: resolvePreviewAnchorLeafSectionId({
          currentTarget: dragSession.hoverTarget,
          isCurrentSectionContentTarget,
          committedLeafSectionId,
        }),
        tabSectionId: tabSection.id,
        splitSide: resolvePreviewSplitSide(
          contentBounds,
          dragSession.pointerX,
          dragSession.pointerY,
          {
            left: "left",
            right: "right",
            top: "top",
            bottom: "bottom",
          } as const,
          {
            currentSplitSide: isCurrentSectionContentTarget ? dragSession.hoverTarget?.splitSide ?? null : null,
          },
        ),
        contentBounds,
      };

      if (!arePreviewHoverTargetsEqual(dragSession.hoverTarget, nextTarget, getTabSectionHoverTargetId)) {
        updateDragSession({
          ...dragSession,
          hoverTarget: nextTarget,
        });
      }
      return;
    }

    if (dragSession.hoverTarget?.leafSectionId === leafSectionId) {
      if (!hoverTargetClearFrameRef.current) {
        hoverTargetClearFrameRef.current = window.requestAnimationFrame(() => {
          hoverTargetClearFrameRef.current = 0;
          const latestSession = dragSessionRef.current;
          if (!latestSession || latestSession.hoverTarget?.leafSectionId !== leafSectionId) {
            return;
          }

          updateDragSession({
            ...latestSession,
            hoverTarget: null,
          });
        });
      }
    }

    return () => {
      if (hoverTargetClearFrameRef.current) {
        window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
        hoverTargetClearFrameRef.current = 0;
      }
    };
  }, [
    dragSession,
    isDraggingLoneSourceTab,
    interactive,
    canPreviewRetargetContent,
    committedLeafSectionId,
    leafSectionId,
    updateDragSession,
    onMoveTab,
    tabSection.id,
    tabSection.tabs,
  ]);

  const pointerInsideStrip = Boolean(
    interactive &&
    dragSession?.phase === "dragging" &&
    dragSession.hoverTarget?.area === "strip" &&
    dragSession.hoverTarget.tabSectionId === tabSection.id,
  );
  const pointerInsideContent = Boolean(
    (interactive || canPreviewRetargetContent) &&
    dragSession?.phase === "dragging" &&
    dragSession.hoverTarget?.area === "content" &&
    dragSession.hoverTarget.tabSectionId === tabSection.id &&
    dragSession.hoverTarget.splitSide,
  );

  return (
    <div
      ref={sectionRef}
      className="layout-v2-tab-section"
      data-tab-section-id={tabSection.id}
      {...mergeLayoutFocusAttributes(
        {
          "data-layout-role": "tab-section",
          "data-layout-tab-section-id": tabSection.id,
        },
        focusBridge?.getSectionAttributes?.(tabSection),
      )}
    >
      <div
        ref={stripRef}
        data-tauri-drag-region
        className={[
          "layout-v2-tab-section__strip",
          pointerInsideStrip ? "layout-v2-tab-section__strip--drag-over" : "",
        ].filter(Boolean).join(" ")}
      >
        {tabSection.tabs.map((tab, index) => (
          <div
            key={tab.id}
            ref={(element) => {
              slotRefs.current[tab.id] = element;
            }}
            className="layout-v2-tab-section__tab-slot"
          >
            {draggingTabId === tab.id ? (
              <div className="layout-v2-tab-section__tab-placeholder" aria-hidden="true" />
            ) : (
              <div
                className={[
                  "layout-v2-tab-section__tab",
                  "window-no-drag",
                  tabSection.focusedTabId === tab.id ? "layout-v2-tab-section__tab--focused" : "",
                ].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  {...mergeLayoutFocusAttributes(
                    {
                      "data-layout-role": "tab",
                      "data-layout-tab-section-id": tabSection.id,
                      "data-layout-tab-id": tab.id,
                    },
                    focusBridge?.getTabAttributes?.(tabSection, tab),
                  )}
                  className="layout-v2-tab-section__tab-main"
                  onClick={() => onFocusTab(tab.id)}
                  onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                    if (!interactive || event.button !== 0) {
                      return;
                    }

                    onFocusTab(tab.id);
                    event.preventDefault();
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      /* pointer capture is best-effort across embedded webviews */
                    }
                    updateDragSession(buildTabSectionDragSession({
                      leafSectionId,
                      tabSectionId: tabSection.id,
                      tabId: tab.id,
                      index,
                      pointerId: event.pointerId,
                      clientX: event.clientX,
                      clientY: event.clientY,
                      title: tab.title,
                      content: tab.content,
                      tone: tab.tone,
                    }));
                  }}
                >
                  <span className="layout-v2-tab-section__tab-title">
                    {renderTabTitle ? renderTabTitle(tab) : tab.title}
                  </span>
                </button>
                <button
                  type="button"
                  className="layout-v2-tab-section__tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        ref={contentRef}
        {...mergeLayoutFocusAttributes(
          {
            "data-layout-role": "tab-content",
            "data-layout-tab-section-id": tabSection.id,
            "data-layout-tab-id": activeCard?.id,
            "data-layout-presented-tab-id": visibleCardId ?? undefined,
            "data-layout-pending-tab-id": pendingCardId ?? undefined,
          },
          focusBridge?.getContentAttributes?.(tabSection, activeCard),
        )}
        className={[
          "layout-v2-tab-section__content",
          pointerInsideContent ? "layout-v2-tab-section__content--drag-over" : "",
        ].filter(Boolean).join(" ")}
        onPointerDown={() => {
          if (activeCard) {
            onFocusTab(activeCard.id);
          }
        }}
      >
        {renderedContentTabs.length > 0 ? (
          renderedContentTabs.map((tab) => {
            const isVisible = tab.id === visibleCardId;
            const isPending = tab.id === pendingCardId;

            return (
              <div
                key={tab.id}
                aria-hidden={!isVisible}
                data-layout-presentation-state={isVisible ? "committed" : isPending ? "pending" : "inactive"}
                className={[
                  "layout-v2-tab-section__card",
                  getCardToneClassName(tab.tone),
                  isVisible
                    ? "layout-v2-tab-section__card--active"
                    : "layout-v2-tab-section__card--inactive",
                  isPending ? "layout-v2-tab-section__card--pending" : "",
                ].join(" ")}
              >
                <div className="layout-v2-tab-section__card-title">
                  {renderTabTitle ? renderTabTitle(tab) : tab.title}
                </div>
                <div className="layout-v2-tab-section__card-body">{resolveTabCardBody(tab, renderTabContent, contentRegistry)}</div>
              </div>
            );
          })
        ) : null}
        {!visibleCardId && pendingCardId ? (
          <div className="layout-v2-tab-section__presentation-pending" aria-live="polite">Preparing content</div>
        ) : null}
        {renderedContentTabs.length === 0 && !pendingCardId ? (
          <div className="layout-v2-tab-section__empty-card">No open tabs</div>
        ) : null}
      </div>
    </div>
  );
}
