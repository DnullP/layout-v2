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
  type ReactNode,
} from "react";
import {
  ActivityBarIcon,
  type ActivityBarDragPayload,
  type ActivityBarPointerPressPayload,
} from "./ActivityBarIcon";
import {
  type ActivityBarIconMove,
  type ActivityBarStateItem,
} from "./activityBarModel";
import "./activityBar.css";

/**
 * @interface ActivityBarDragSession
 * @description 当前 activity bar 的 pointer 拖拽会话。
 * @extends ActivityBarDragPayload
 * @field currentBarId - 当前 icon 所在的 activity bar。
 * @field pointerId    - 活动 pointer 标识。
 * @field originX      - 初始按下横坐标。
 * @field originY      - 初始按下纵坐标。
 * @field pointerX     - 当前 pointer 横坐标。
 * @field pointerY     - 当前 pointer 纵坐标。
 * @field targetIndex  - icon 当前落位索引。
 * @field phase        - 拖拽阶段：pending 或 dragging。
 */
export interface ActivityBarDragSession extends ActivityBarDragPayload {
  /** 当前 icon 所在的 activity bar。 */
  currentBarId: string;
  /** 活动 pointer 标识。 */
  pointerId: number;
  /** 初始按下横坐标。 */
  originX: number;
  /** 初始按下纵坐标。 */
  originY: number;
  /** 当前 pointer 横坐标。 */
  pointerX: number;
  /** 当前 pointer 纵坐标。 */
  pointerY: number;
  /** icon 当前落位索引。 */
  targetIndex: number;
  /** 拖拽阶段。 */
  phase: "pending" | "dragging";
}

/**
 * @constant POINTER_TARGET_HYSTERESIS_PX
 * @description 相邻落点切换时的滞回范围。
 *   只有 pointer 明确越过分界线一小段距离后，
 *   才允许目标索引在相邻位置之间切换，避免边界来回抖动。
 */
const POINTER_TARGET_HYSTERESIS_PX = 6;

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
  dragSession: ActivityBarDragSession | null;
  onDragSessionChange: (session: ActivityBarDragSession | null) => void;
  onSelectIcon: (iconId: string) => void;
  onMoveIcon: (move: ActivityBarIconMove) => void;
}): ReactNode {
  const { bar, dragSession, onDragSessionChange, onSelectIcon, onMoveIcon } = props;
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousSlotTopsRef = useRef<Record<string, number>>({});
  const processedPointerKeyRef = useRef<string | null>(null);

  if (!bar) {
    console.warn("[layout-v2] activity bar state is missing");
    return null;
  }

  const activityBar = bar;
  const draggingIconId = dragSession?.currentBarId === activityBar.id
    ? dragSession.iconId
    : null;

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
    onDragSessionChange({
      ...dragSession,
      currentBarId: activityBar.id,
      targetIndex,
    });
  }, [activityBar.icons, activityBar.id, dragSession, onDragSessionChange, onMoveIcon]);

  const isPointerInside = Boolean(
    dragSession?.phase === "dragging" &&
    dragSession.currentBarId === activityBar.id,
  );

  /**
   * @function handlePointerPress
   * @description 接收 icon 的 pointer 按下，交给上层建立拖拽会话。
   * @param payload pointer 按下载荷。
   */
  function handlePointerPress(payload: ActivityBarPointerPressPayload): void {
    onDragSessionChange(buildDragSessionFromPress(payload));
  }

  return (
    <div
      ref={rootRef}
      className={[
        "layout-v2-activity-bar",
        dragSession?.phase === "dragging" ? "layout-v2-activity-bar--dragging" : "",
        isPointerInside ? "layout-v2-activity-bar--drag-over" : "",
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
            {draggingIconId === icon.id ? (
              <div className="layout-v2-activity-bar__icon-placeholder" aria-hidden="true" />
            ) : (
              <ActivityBarIcon
                barId={activityBar.id}
                index={index}
                icon={icon}
                selected={activityBar.selectedIconId === icon.id}
                dragging={dragSession?.phase === "dragging" && dragSession.iconId === icon.id}
                onSelect={() => onSelectIcon(icon.id)}
                onPointerPress={handlePointerPress}
              />
            )}
          </div>
        ))}
        <div
          className={[
            "layout-v2-activity-bar__tail-drop-target",
            isPointerInside && dragSession?.phase === "dragging" && dragSession.targetIndex === activityBar.icons.length
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