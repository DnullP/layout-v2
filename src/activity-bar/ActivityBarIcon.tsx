/**
 * @module host/layout-v2/activity-bar/ActivityBarIcon
 * @description activity bar icon 子组件。
 *   负责渲染 icon、本地拖拽手势与选中交互。
 * @dependencies
 *   - react
 *   - ./activityBar.css
 *
 * @example
 *   <ActivityBarIcon
 *     icon={icon}
 *     selected
 *     onSelect={() => controller.selectIcon("primary", icon.id)}
 *   />
 *
 * @exports
 *   - ActivityBarDragPayload   icon 拖拽载荷
 *   - ActivityBarPointerPressPayload pointer 按下载荷
 *   - ActivityBarIcon          activity icon 组件
 */

import { type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { type ActivityBarIconDefinition } from "./activityBarModel";
import "./activityBar.css";

/**
 * @interface ActivityBarDragPayload
 * @description activity icon 的拖拽载荷。
 * @field sourceBarId - 源 activity bar 标识。
 * @field iconId      - icon 标识。
 */
export interface ActivityBarDragPayload {
  /** 源 activity bar 标识。 */
  sourceBarId: string;
  /** icon 标识。 */
  iconId: string;
}

/**
 * @interface ActivityBarPointerPressPayload
 * @description activity icon pointer 按下时的载荷。
 * @extends ActivityBarDragPayload
 * @field index     - icon 在当前 bar 内的索引。
 * @field pointerId - pointer 标识。
 * @field clientX   - pointer 按下时的横坐标。
 * @field clientY   - pointer 按下时的纵坐标。
 */
export interface ActivityBarPointerPressPayload extends ActivityBarDragPayload {
  /** icon 在当前 bar 内的索引。 */
  index: number;
  /** pointer 标识。 */
  pointerId: number;
  /** pointer 按下时的横坐标。 */
  clientX: number;
  /** pointer 按下时的纵坐标。 */
  clientY: number;
}

/**
 * @function ActivityBarIcon
 * @description 渲染单个 activity icon。
 * @param props 组件属性。
 * @returns activity icon React 节点。
 */
export function ActivityBarIcon(props: {
  barId: string;
  index: number;
  icon: ActivityBarIconDefinition;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onPointerPress: (payload: ActivityBarPointerPressPayload) => void;
}): ReactNode {
  const { barId, index, icon, selected, dragging, onSelect, onPointerPress } = props;
  const className = [
    "layout-v2-activity-bar__icon",
    selected ? "layout-v2-activity-bar__icon--selected" : "",
    dragging ? "layout-v2-activity-bar__icon--dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /**
   * @function handlePointerDown
   * @description 记录当前 icon 的 pointer 按下信息，交给上层判断是否进入拖拽。
   * @param event Pointer 按下事件。
   */
  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    onPointerPress({
      sourceBarId: barId,
      iconId: icon.id,
      index,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={icon.label}
      title={icon.label}
      onClick={onSelect}
      data-icon-id={icon.id}
      onPointerDown={handlePointerDown}
    >
      <span className="layout-v2-activity-bar__icon-symbol">{icon.symbol}</span>
    </button>
  );
}