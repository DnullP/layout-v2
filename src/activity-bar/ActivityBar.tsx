/**
 * @module host/layout-v2/activity-bar/ActivityBar
 * @description activity bar section component。
 *   图标默认从上至下排列，支持点击选中、拖拽排序与跨 activity bar 移动。
 * @dependencies
 *   - react
 *   - ./ActivityBarIcon
 *   - ./activityBarModel
 *   - ./activityBar.css
 *
 * @example
 *   <ActivityBar
 *     bar={controller.getBar("primary")}
 *     onSelectIcon={(iconId) => controller.selectIcon("primary", iconId)}
 *     onMoveIcon={(move) => controller.moveIcon(move)}
 *   />
 *
 * @exports
 *   - ActivityBar               activity bar 组件
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityBarIcon,
  type ActivityBarIconRenderer,
  type ActivityBarPointerPressPayload,
} from "./ActivityBarIcon";
import { type PanelSectionDragSession } from "../panel-section/panelSectionDrag";
import { type ActivityBarDragSession } from "./activityBarDrag";
import {
  type ActivityBarIconMove,
  type ActivityBarStateItem,
} from "./activityBarModel";
import {
  mergeLayoutFocusAttributes,
  type ActivityBarFocusBridge,
} from "../vscode-layout/focusBridge";
import "./activityBar.css";

export type { ActivityBarDragSession } from "./activityBarDrag";
export type { ActivityBarIconRenderer } from "./ActivityBarIcon";

/**
 * @constant POINTER_TARGET_HYSTERESIS_PX
 * @description 相邻落点切换时的滞回范围。
 *   只有 pointer 明确越过分界线一小段距离后，
 *   才允许目标索引在相邻位置之间切换，避免边界来回抖动。
 */
const POINTER_TARGET_HYSTERESIS_PX = 6;

/**
 * @constant DRAG_START_DISTANCE_PX
 * @description 从按下进入真正拖拽前需要越过的最小位移。
 */
const DRAG_START_DISTANCE_PX = 4;

/**
 * @function readElementTranslateY
 * @description 读取元素当前 transform 中的 translateY 位移。
 *   用于补偿 FLIP 动画造成的视觉偏移，避免碰撞检测跟着动画抖动。
 * @param element 目标元素。
 * @returns 当前 translateY 位移，未命中时返回 0。
 */
function readElementTranslateY(element: HTMLElement): number {
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === "none") {
    return 0;
  }

  try {
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    return 0;
  }
}

/**
 * @function getSlotMidpoint
 * @description 读取 slot 的逻辑中线位置。
 *   当 slot 正在执行 FLIP transform 动画时，
 *   需要扣除视觉位移，回到未偏移的逻辑位置。
 * @param slotElement slot 元素。
 * @returns slot 的逻辑中线纵坐标。
 */
function getSlotMidpoint(slotElement: HTMLDivElement): number {
  const rect = slotElement.getBoundingClientRect();
  const visualShiftY = readElementTranslateY(slotElement);
  const logicalTop = rect.top - visualShiftY;
  return logicalTop + rect.height / 2;
}

/**
 * @function buildDragSessionFromPress
 * @description 基于 pointer 按下信息创建拖拽会话。
 * @param payload pointer 按下载荷。
 * @returns 初始拖拽会话。
 */
function buildDragSessionFromPress(
  payload: ActivityBarPointerPressPayload,
): ActivityBarDragSession {
  return {
    sourceBarId: payload.sourceBarId,
    iconId: payload.iconId,
    currentBarId: payload.sourceBarId,
    panelTarget: null,
    pointerId: payload.pointerId,
    originX: payload.clientX,
    originY: payload.clientY,
    pointerX: payload.clientX,
    pointerY: payload.clientY,
    targetIndex: payload.index,
    phase: "pending",
  };
}

/**
 * @function getTargetIndexFromPointer
 * @description 根据当前 pointer 位置计算 icon 在 bar 内的目标插入索引。
 * @param pointerY pointer 当前纵坐标。
 * @param slotRefs 当前 bar 内 slot 节点引用表。
 * @param iconIds 当前 bar 内 icon 顺序。
 * @returns 目标插入索引。
 */
function getTargetIndexFromPointer(
  pointerY: number,
  slotRefs: Record<string, HTMLDivElement | null>,
  iconIds: string[],
  currentTargetIndex?: number,
): number {
  let candidateIndex = iconIds.length;

  for (let index = 0; index < iconIds.length; index += 1) {
    const iconId = iconIds[index];
    const slotElement = slotRefs[iconId];
    if (!slotElement) {
      continue;
    }

    const midpoint = getSlotMidpoint(slotElement);
    if (pointerY < midpoint) {
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
  const boundarySlotId = iconIds[boundarySlotIndex];
  const boundarySlot = boundarySlotId ? slotRefs[boundarySlotId] : null;

  if (!boundarySlot) {
    return candidateIndex;
  }

  const boundaryMidpoint = getSlotMidpoint(boundarySlot);
  if (Math.abs(pointerY - boundaryMidpoint) <= POINTER_TARGET_HYSTERESIS_PX) {
    return currentTargetIndex;
  }

  return candidateIndex;
}

/**
 * @function ActivityBar
 * @description 渲染单个 activity bar。
 * @param props 组件属性。
 * @returns activity bar React 节点。
 */
export function ActivityBar(props: {
  bar: ActivityBarStateItem | null;
  dragSession?: ActivityBarDragSession | null;
  panelDragSession?: PanelSectionDragSession | null;
  focusBridge?: ActivityBarFocusBridge<ActivityBarStateItem, ActivityBarStateItem["icons"][number]>;
  renderIcon?: ActivityBarIconRenderer;
  onDragSessionChange?: (session: ActivityBarDragSession | null) => void;
  onDragSessionEnd?: (session: ActivityBarDragSession) => void;
  onPanelDragSessionChange?: (session: PanelSectionDragSession | null) => void;
  onActivateIcon?: (iconId: string) => void;
  onSelectIcon: (iconId: string) => void;
  onMoveIcon: (move: ActivityBarIconMove) => void;
}): ReactNode {
  const {
    bar,
    dragSession: controlledDragSession,
    panelDragSession,
    focusBridge,
    renderIcon,
    onDragSessionChange,
    onDragSessionEnd,
    onPanelDragSessionChange,
    onActivateIcon,
    onSelectIcon,
    onMoveIcon,
  } = props;
  const [internalDragSession, setInternalDragSession] = useState<ActivityBarDragSession | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousSlotTopsRef = useRef<Record<string, number>>({});
  const processedPointerKeyRef = useRef<string | null>(null);
  const dragSession = controlledDragSession ?? internalDragSession;
  const updateDragSession = onDragSessionChange ?? setInternalDragSession;
  const updatePanelDragSession = onPanelDragSessionChange ?? (() => { });

  if (!bar) {
    console.warn("[layout-v2] activity bar state is missing");
    return null;
  }

  const activityBar = bar;
  const draggingIconId = dragSession?.phase === "dragging" && dragSession.currentBarId === activityBar.id
    ? dragSession.iconId
    : null;
  const draggingPanelId = panelDragSession?.phase === "dragging" && panelDragSession.activityTarget?.barId === activityBar.id
    ? panelDragSession.panelId
    : null;

  useEffect(() => {
    const isDragging = dragSession?.phase === "dragging" || panelDragSession?.phase === "dragging";
    document.body.classList.toggle("layout-v2--dragging", isDragging);

    return () => {
      if (isDragging) {
        document.body.classList.remove("layout-v2--dragging");
      }
    };
  }, [dragSession?.phase, panelDragSession?.phase]);

  useEffect(() => {
    if (!dragSession || dragSession.sourceBarId !== activityBar.id) {
      return;
    }
    const currentDragSession: ActivityBarDragSession = dragSession;

    function handlePointerMove(event: PointerEvent): void {
      if (event.pointerId !== currentDragSession.pointerId) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - currentDragSession.originX,
        event.clientY - currentDragSession.originY,
      );
      const nextPhase = currentDragSession.phase === "pending" && distance >= DRAG_START_DISTANCE_PX
        ? "dragging"
        : currentDragSession.phase;

      if (
        nextPhase === currentDragSession.phase &&
        currentDragSession.pointerX === event.clientX &&
        currentDragSession.pointerY === event.clientY
      ) {
        return;
      }

      updateDragSession({
        ...currentDragSession,
        phase: nextPhase,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    }

    function handlePointerEnd(event: PointerEvent): void {
      if (event.pointerId !== currentDragSession.pointerId) {
        return;
      }

      if (currentDragSession.phase === "dragging") {
        onDragSessionEnd?.(currentDragSession);
      }

      updateDragSession(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [activityBar.id, dragSession, onDragSessionEnd, updateDragSession]);

  useLayoutEffect(() => {
    const nextSlotTops: Record<string, number> = {};

    activityBar.icons.forEach((icon) => {
      const slotElement = slotRefs.current[icon.id];
      if (!slotElement) {
        return;
      }

      const nextTop = slotElement.getBoundingClientRect().top;
      const previousTop = previousSlotTopsRef.current[icon.id];
      nextSlotTops[icon.id] = nextTop;

      if (previousTop === undefined || previousTop === nextTop) {
        return;
      }

      const deltaY = previousTop - nextTop;
      slotElement.style.transition = "none";
      slotElement.style.transform = `translateY(${deltaY}px)`;
      void slotElement.getBoundingClientRect();

      requestAnimationFrame(() => {
        slotElement.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
        slotElement.style.transform = "translateY(0)";
      });
    });

    previousSlotTopsRef.current = nextSlotTops;
  }, [activityBar.icons, draggingIconId]);

  useEffect(() => {
    if (!dragSession || dragSession.phase !== "dragging") {
      processedPointerKeyRef.current = null;
      return;
    }

    const rootElement = rootRef.current;
    if (!rootElement) {
      return;
    }

    const barRect = rootElement.getBoundingClientRect();
    const isInside = (
      dragSession.pointerX >= barRect.left &&
      dragSession.pointerX <= barRect.right &&
      dragSession.pointerY >= barRect.top &&
      dragSession.pointerY <= barRect.bottom
    );

    if (!isInside) {
      return;
    }

    const processedPointerKey = [
      dragSession.pointerId,
      dragSession.pointerX,
      dragSession.pointerY,
      activityBar.id,
    ].join(":");
    if (processedPointerKeyRef.current === processedPointerKey) {
      return;
    }

    const targetIndex = getTargetIndexFromPointer(
      dragSession.pointerY,
      slotRefs.current,
      activityBar.icons.map((icon) => icon.id),
      dragSession.currentBarId === activityBar.id ? dragSession.targetIndex : undefined,
    );

    processedPointerKeyRef.current = processedPointerKey;

    if (
      dragSession.currentBarId === activityBar.id &&
      dragSession.targetIndex === targetIndex
    ) {
      return;
    }

    onMoveIcon({
      sourceBarId: dragSession.currentBarId,
      targetBarId: activityBar.id,
      iconId: dragSession.iconId,
      targetIndex,
    });
    updateDragSession({
      ...dragSession,
      currentBarId: activityBar.id,
      panelTarget: null,
      targetIndex,
    });
  }, [activityBar.icons, activityBar.id, dragSession, onMoveIcon, updateDragSession]);

  useEffect(() => {
    if (!panelDragSession || panelDragSession.phase !== "dragging") {
      return;
    }

    const rootElement = rootRef.current;
    if (!rootElement) {
      return;
    }

    const barRect = rootElement.getBoundingClientRect();
    const isInside = (
      panelDragSession.pointerX >= barRect.left &&
      panelDragSession.pointerX <= barRect.right &&
      panelDragSession.pointerY >= barRect.top &&
      panelDragSession.pointerY <= barRect.bottom
    );

    if (!isInside) {
      if (panelDragSession.activityTarget?.barId === activityBar.id) {
        updatePanelDragSession({
          ...panelDragSession,
          activityTarget: null,
        });
      }
      return;
    }

    const targetIndex = getTargetIndexFromPointer(
      panelDragSession.pointerY,
      slotRefs.current,
      activityBar.icons.map((icon) => icon.id),
      panelDragSession.activityTarget?.barId === activityBar.id
        ? panelDragSession.activityTarget.targetIndex
        : undefined,
    );

    if (
      panelDragSession.activityTarget?.barId === activityBar.id &&
      panelDragSession.activityTarget.targetIndex === targetIndex
    ) {
      return;
    }

    updatePanelDragSession({
      ...panelDragSession,
      activityTarget: {
        barId: activityBar.id,
        targetIndex,
      },
    });
  }, [activityBar.icons, activityBar.id, panelDragSession, updatePanelDragSession]);

  const isPointerInside = Boolean(
    dragSession?.phase === "dragging" &&
    dragSession.currentBarId === activityBar.id,
  );
  const isPanelPointerInside = Boolean(
    panelDragSession?.phase === "dragging" &&
    panelDragSession.activityTarget?.barId === activityBar.id,
  );

  /**
   * @function handlePointerPress
   * @description 接收 icon 的 pointer 按下，交给上层建立拖拽会话。
   * @param payload pointer 按下载荷。
   */
  function handlePointerPress(payload: ActivityBarPointerPressPayload): void {
    updateDragSession(buildDragSessionFromPress(payload));
  }

  return (
    <div
      ref={rootRef}
      {...mergeLayoutFocusAttributes(
        {
          "data-layout-role": "activity-bar",
          "data-layout-bar-id": activityBar.id,
        },
        focusBridge?.getBarAttributes?.(activityBar),
      )}
      className={[
        "layout-v2-activity-bar",
        dragSession?.phase === "dragging" || panelDragSession?.phase === "dragging"
          ? "layout-v2-activity-bar--dragging"
          : "",
        isPointerInside || isPanelPointerInside ? "layout-v2-activity-bar--drag-over" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* icon 列表：默认从上至下排列，并通过拖拽在同栏或跨栏移动。 */}
      <div className="layout-v2-activity-bar__icon-list">
        {activityBar.icons.map((icon, index) => (
          <div
            key={icon.id}
            className="layout-v2-activity-bar__icon-slot"
            ref={(element) => {
              slotRefs.current[icon.id] = element;
            }}
          >
            {isPanelPointerInside && panelDragSession?.activityTarget?.targetIndex === index ? (
              <div className="layout-v2-activity-bar__icon-placeholder" aria-hidden="true" />
            ) : null}
            {draggingIconId === icon.id || draggingPanelId === icon.id ? (
              <div className="layout-v2-activity-bar__icon-placeholder" aria-hidden="true" />
            ) : (
              <ActivityBarIcon
                barId={activityBar.id}
                index={index}
                icon={icon}
                selected={activityBar.selectedIconId === icon.id}
                dragging={dragSession?.phase === "dragging" && dragSession.iconId === icon.id}
                focusAttributes={mergeLayoutFocusAttributes(
                  {
                    "data-layout-role": "activity-icon",
                    "data-layout-bar-id": activityBar.id,
                    "data-layout-icon-id": icon.id,
                  },
                  focusBridge?.getIconAttributes?.(activityBar, icon),
                )}
                renderIcon={renderIcon}
                onSelect={() => {
                  onActivateIcon?.(icon.id);
                  if (icon.activationMode !== "action") {
                    onSelectIcon(icon.id);
                  }
                }}
                onPointerPress={handlePointerPress}
              />
            )}
          </div>
        ))}
        <div
          className={[
            "layout-v2-activity-bar__tail-drop-target",
            (isPointerInside && dragSession?.phase === "dragging" && dragSession.targetIndex === activityBar.icons.length) ||
              (isPanelPointerInside && panelDragSession?.activityTarget?.targetIndex === activityBar.icons.length)
              ? "layout-v2-activity-bar__tail-drop-target--drag-over"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
    </div>
  );
}