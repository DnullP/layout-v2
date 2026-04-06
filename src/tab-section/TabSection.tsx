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
 *   - TabSectionSplitSide         content 分区预览方位
 *   - TabSectionHoverTarget       当前 hover 目标
 *   - TabSectionPointerPressPayload pointer 按下载荷
 *   - TabSectionDragSession       全局拖拽会话
 *   - TabSection                  组件本体
 */

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { type TabSectionStateItem, type TabSectionTabDefinition, type TabSectionTabMove } from "./tabSectionModel";
import "./tabSection.css";

/**
 * @type TabSectionSplitSide
 * @description content 分区预览方位。
 */
export type TabSectionSplitSide = "left" | "right" | "top" | "bottom";

/**
 * @interface TabSectionHoverTarget
 * @description 当前拖拽 hover 到的 tab section 目标。
 * @field area          - hover 区域：strip 或 content。
 * @field leafSectionId - 实际 leaf section 标识。
 * @field tabSectionId  - 逻辑 tab section 标识。
 * @field targetIndex   - strip 区域内的目标插入索引。
 * @field splitSide     - content 区域内的预览分区方位。
 */
export interface TabSectionHoverTarget {
  /** hover 区域。 */
  area: "strip" | "content";
  /** 当前渲染树中的 leaf section 标识。 */
  leafSectionId: string;
  /** 在 committed 布局中作为命中基准的 leaf section 标识。 */
  anchorLeafSectionId?: string;
  /** 逻辑 tab section 标识。 */
  tabSectionId: string;
  /** strip 区域内的目标插入索引。 */
  targetIndex?: number;
  /** content 区域内的预览分区方位。 */
  splitSide?: TabSectionSplitSide | null;
  /** content 区域命中判断使用的稳定边界。 */
  contentBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}

/**
 * @interface TabSectionStableBounds
 * @description 用于维持 split hover 稳定性的边界信息。
 * @field left   - 左边界。
 * @field top    - 上边界。
 * @field right  - 右边界。
 * @field bottom - 下边界。
 * @field width  - 宽度。
 * @field height - 高度。
 */
interface TabSectionStableBounds {
  /** 左边界。 */
  left: number;
  /** 上边界。 */
  top: number;
  /** 右边界。 */
  right: number;
  /** 下边界。 */
  bottom: number;
  /** 宽度。 */
  width: number;
  /** 高度。 */
  height: number;
}

/**
 * @interface TabSectionPointerPressPayload
 * @description tab pointer 按下时的载荷。
 * @field leafSectionId - 当前 leaf section 标识。
 * @field tabSectionId  - 当前逻辑 tab section 标识。
 * @field tabId         - 当前 tab 标识。
 * @field index         - tab 当前索引。
 * @field pointerId     - pointer 标识。
 * @field clientX       - 按下横坐标。
 * @field clientY       - 按下纵坐标。
 * @field title         - tab 标题快照。
 * @field content       - card 内容快照。
 * @field tone          - card 语义色快照。
 */
export interface TabSectionPointerPressPayload {
  /** 当前 leaf section 标识。 */
  leafSectionId: string;
  /** 当前逻辑 tab section 标识。 */
  tabSectionId: string;
  /** 当前 tab 标识。 */
  tabId: string;
  /** tab 当前索引。 */
  index: number;
  /** pointer 标识。 */
  pointerId: number;
  /** 按下横坐标。 */
  clientX: number;
  /** 按下纵坐标。 */
  clientY: number;
  /** tab 标题快照。 */
  title: string;
  /** card 内容快照。 */
  content: string;
  /** card 语义色快照。 */
  tone?: TabSectionTabDefinition["tone"];
}

/**
 * @interface TabSectionDragSession
 * @description tab section 的全局拖拽会话。
 * @field sourceTabSectionId  - 拖拽起始 tab section。
 * @field currentTabSectionId - tab 当前所在 tab section。
 * @field sourceLeafSectionId - 拖拽起始 leaf section。
 * @field currentLeafSectionId - tab 当前所在 leaf section。
 * @field tabId               - 被拖拽 tab。
 * @field title               - tab 标题快照。
 * @field content             - card 内容快照。
 * @field tone                - card 语义色快照。
 * @field pointerId           - pointer 标识。
 * @field originX             - 初始横坐标。
 * @field originY             - 初始纵坐标。
 * @field pointerX            - 当前横坐标。
 * @field pointerY            - 当前纵坐标。
 * @field phase               - 拖拽阶段。
 * @field hoverTarget         - 当前 hover 目标。
 */
export interface TabSectionDragSession {
  /** 拖拽起始 tab section。 */
  sourceTabSectionId: string;
  /** tab 当前所在 tab section。 */
  currentTabSectionId: string;
  /** 拖拽起始 leaf section。 */
  sourceLeafSectionId: string;
  /** tab 当前所在 leaf section。 */
  currentLeafSectionId: string;
  /** 被拖拽 tab。 */
  tabId: string;
  /** tab 标题快照。 */
  title: string;
  /** card 内容快照。 */
  content: string;
  /** card 语义色快照。 */
  tone?: TabSectionTabDefinition["tone"];
  /** pointer 标识。 */
  pointerId: number;
  /** 初始横坐标。 */
  originX: number;
  /** 初始纵坐标。 */
  originY: number;
  /** 当前横坐标。 */
  pointerX: number;
  /** 当前纵坐标。 */
  pointerY: number;
  /** 拖拽阶段。 */
  phase: "pending" | "dragging";
  /** 当前 hover 目标。 */
  hoverTarget: TabSectionHoverTarget | null;
}

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
    hoverTarget: null,
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
function resolveContentSplitSide(
  rect: DOMRect,
  pointerX: number,
  pointerY: number,
): TabSectionSplitSide | null {
  const leftThreshold = rect.left + rect.width / 3;
  const rightThreshold = rect.right - rect.width / 3;
  const topThreshold = rect.top + rect.height / 3;
  const bottomThreshold = rect.bottom - rect.height / 3;

  if (pointerX <= leftThreshold) {
    return "left";
  }

  if (pointerX >= rightThreshold) {
    return "right";
  }

  if (pointerY <= topThreshold) {
    return "top";
  }

  if (pointerY >= bottomThreshold) {
    return "bottom";
  }

  return null;
}

/**
 * @function isPointerInsideBounds
 * @description 判断 pointer 是否仍位于给定稳定边界内。
 * @param bounds 稳定边界。
 * @param pointerX 当前横坐标。
 * @param pointerY 当前纵坐标。
 * @returns 位于边界内时返回 true。
 */
function isPointerInsideBounds(
  bounds: TabSectionStableBounds | null,
  pointerX: number,
  pointerY: number,
): boolean {
  return Boolean(
    bounds &&
    pointerX >= bounds.left &&
    pointerX <= bounds.right &&
    pointerY >= bounds.top &&
    pointerY <= bounds.bottom,
  );
}

/**
 * @function toStableBounds
 * @description 将 DOMRect 转为可持久化的稳定边界对象。
 * @param rect DOMRect 或 null。
 * @returns 稳定边界对象；未命中时返回 null。
 */
function toStableBounds(rect: DOMRect | null): TabSectionStableBounds | null {
  if (!rect) {
    return null;
  }

  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * @function areHoverTargetsEqual
 * @description 判断两个 hover 目标是否等价。
 * @param left 左侧目标。
 * @param right 右侧目标。
 * @returns 等价时返回 true。
 */
function areHoverTargetsEqual(
  left: TabSectionHoverTarget | null,
  right: TabSectionHoverTarget | null,
): boolean {
  return (
    left?.area === right?.area &&
    left?.leafSectionId === right?.leafSectionId &&
    left?.anchorLeafSectionId === right?.anchorLeafSectionId &&
    left?.tabSectionId === right?.tabSectionId &&
    left?.targetIndex === right?.targetIndex &&
    left?.splitSide === right?.splitSide &&
    left?.contentBounds?.left === right?.contentBounds?.left &&
    left?.contentBounds?.top === right?.contentBounds?.top &&
    left?.contentBounds?.right === right?.contentBounds?.right &&
    left?.contentBounds?.bottom === right?.contentBounds?.bottom
  );
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

/**
 * @function TabSection
 * @description 渲染单个 tab section。
 * @param props 组件属性。
 * @returns tab section React 节点。
 */
export function TabSection(props: {
  leafSectionId: string;
  committedLeafSectionId: string;
  tabSectionId: string;
  tabSection: TabSectionStateItem | null;
  dragSession: TabSectionDragSession | null;
  interactive?: boolean;
  onDragSessionChange: (session: TabSectionDragSession | null) => void;
  onFocusTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onMoveTab: (move: TabSectionTabMove) => void;
}): ReactNode {
  const {
    leafSectionId,
    committedLeafSectionId,
    tabSectionId,
    tabSection,
    dragSession,
    interactive = true,
    onDragSessionChange,
    onFocusTab,
    onCloseTab,
    onMoveTab,
  } = props;
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousSlotLeftsRef = useRef<Record<string, number>>({});

  if (!tabSection) {
    console.warn("[layout-v2] tab section state is missing", {
      leafSectionId,
      tabSectionId,
    });
    return null;
  }

  const activeCard = tabSection.tabs.find((tab) => tab.id === tabSection.focusedTabId) ?? null;
  const draggingTabId = dragSession?.currentTabSectionId === tabSection.id
    ? dragSession.tabId
    : null;
  const shouldHideActiveCard = Boolean(
    dragSession?.phase === "dragging" &&
    activeCard &&
    activeCard.id === dragSession.tabId,
  );

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
    if (!interactive || !dragSession || dragSession.phase !== "dragging") {
      return;
    }

    const stripRect = stripRef.current?.getBoundingClientRect() ?? null;
    const contentRect = contentRef.current?.getBoundingClientRect() ?? null;
    const existingContentBounds = (
      dragSession.hoverTarget?.area === "content" &&
      dragSession.hoverTarget.tabSectionId === tabSection.id &&
      dragSession.hoverTarget.contentBounds
    )
      ? dragSession.hoverTarget.contentBounds
      : null;
    const contentBounds = existingContentBounds ?? toStableBounds(contentRect);
    const shouldPreferStableContentTarget = Boolean(
      dragSession.hoverTarget?.area === "content" &&
      dragSession.hoverTarget.tabSectionId === tabSection.id &&
      dragSession.hoverTarget.splitSide &&
      isPointerInsideBounds(
        dragSession.hoverTarget.contentBounds ?? contentBounds,
        dragSession.pointerX,
        dragSession.pointerY,
      ),
    );
    const insideStrip = Boolean(
      !shouldPreferStableContentTarget &&
      stripRect &&
      dragSession.pointerX >= stripRect.left &&
      dragSession.pointerX <= stripRect.right &&
      dragSession.pointerY >= stripRect.top &&
      dragSession.pointerY <= stripRect.bottom,
    );
    const insideContent = isPointerInsideBounds(
      contentBounds,
      dragSession.pointerX,
      dragSession.pointerY,
    );

    if (insideStrip) {
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
        onDragSessionChange({
          ...dragSession,
          currentTabSectionId: tabSection.id,
          currentLeafSectionId: leafSectionId,
          hoverTarget: nextTarget,
        });
      }
      return;
    }

    if (insideContent && contentBounds) {
      const nextTarget: TabSectionHoverTarget = {
        area: "content",
        leafSectionId,
        anchorLeafSectionId:
          dragSession.hoverTarget?.area === "content" &&
          dragSession.hoverTarget.tabSectionId === tabSection.id
            ? dragSession.hoverTarget.anchorLeafSectionId ?? dragSession.hoverTarget.leafSectionId
            : committedLeafSectionId,
        tabSectionId: tabSection.id,
        splitSide: resolveContentSplitSide(
          contentBounds as DOMRect,
          dragSession.pointerX,
          dragSession.pointerY,
        ),
        contentBounds,
      };

      if (!areHoverTargetsEqual(dragSession.hoverTarget, nextTarget)) {
        onDragSessionChange({
          ...dragSession,
          hoverTarget: nextTarget,
        });
      }
      return;
    }

    if (dragSession.hoverTarget?.leafSectionId === leafSectionId) {
      onDragSessionChange({
        ...dragSession,
        hoverTarget: null,
      });
    }
  }, [
    dragSession,
    interactive,
    committedLeafSectionId,
    leafSectionId,
    onDragSessionChange,
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
    interactive &&
    dragSession?.phase === "dragging" &&
    dragSession.hoverTarget?.area === "content" &&
    dragSession.hoverTarget.tabSectionId === tabSection.id &&
    dragSession.hoverTarget.splitSide,
  );

  return (
    <div ref={sectionRef} className="layout-v2-tab-section" data-tab-section-id={tabSection.id}>
      <div
        ref={stripRef}
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
                  tabSection.focusedTabId === tab.id ? "layout-v2-tab-section__tab--focused" : "",
                ].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  className="layout-v2-tab-section__tab-main"
                  onClick={() => onFocusTab(tab.id)}
                  onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                    if (!interactive || event.button !== 0) {
                      return;
                    }

                    onDragSessionChange(buildTabSectionDragSession({
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
                  <span className="layout-v2-tab-section__tab-title">{tab.title}</span>
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
        className={[
          "layout-v2-tab-section__content",
          pointerInsideContent ? "layout-v2-tab-section__content--drag-over" : "",
        ].filter(Boolean).join(" ")}
      >
        {activeCard && !shouldHideActiveCard ? (
          <div className={["layout-v2-tab-section__card", getCardToneClassName(activeCard.tone)].join(" ")}>
            <div className="layout-v2-tab-section__card-title">{activeCard.title}</div>
            <div className="layout-v2-tab-section__card-body">{activeCard.content}</div>
          </div>
        ) : (
          <div className="layout-v2-tab-section__empty-card">Drop tab or focus another tab</div>
        )}
      </div>
    </div>
  );
}