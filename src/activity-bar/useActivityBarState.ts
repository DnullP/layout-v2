/**
 * @module host/layout-v2/activity-bar/useActivityBarState
 * @description activity bar 状态的 React hook 封装。
 *   用于在 section component 内管理 icon 选择、排序与跨栏移动。
 * @dependencies
 *   - react
 *   - ./activityBarModel
 *
 * @example
 *   const activityBars = useActivityBarState({
 *     initialState: createActivityBarState([...]),
 *   });
 *
 * @exports
 *   - UseActivityBarStateOptions   hook 初始化参数
 *   - ActivityBarStateController   hook 控制器
 *   - useActivityBarState          activity bar 状态 hook
 */

import { useReducer } from "react";
import {
  createActivityBarState,
  getActivityBarById,
  moveActivityBarIcon,
  removeActivityBarIcon,
  selectActivityBarIcon,
  type ActivityBarIconMove,
  type ActivityBarsState,
  type ActivityBarStateItem,
} from "./activityBarModel";

/**
 * @interface UseActivityBarStateOptions
 * @description useActivityBarState 初始化参数。
 * @field initialState - 初始 activity bar 状态。
 */
export interface UseActivityBarStateOptions {
  /** 初始 activity bar 状态。 */
  initialState: ActivityBarsState;
}

/**
 * @interface ActivityBarStateController
 * @description activity bar 状态控制器。
 * @field state      - 当前状态。
 * @field getBar     - 获取指定 bar。
 * @field selectIcon - 选中 icon。
 * @field removeIcon - 移除 icon。
 * @field moveIcon   - 移动 icon。
 * @field resetState - 重置状态。
 */
export interface ActivityBarStateController {
  /** 当前状态。 */
  state: ActivityBarsState;
  /** 获取指定 bar。 */
  getBar: (barId: string) => ActivityBarStateItem | null;
  /** 选中 icon。 */
  selectIcon: (barId: string, iconId: string) => void;
  /** 移除 icon。 */
  removeIcon: (barId: string, iconId: string) => void;
  /** 移动 icon。 */
  moveIcon: (move: ActivityBarIconMove) => void;
  /** 重置状态。 */
  resetState: (nextState: ActivityBarsState) => void;
}

/**
 * @type ActivityBarAction
 * @description hook 内部 reducer action。
 */
type ActivityBarAction =
  | {
    type: "select";
    barId: string;
    iconId: string;
  }
  | {
    type: "move";
    move: ActivityBarIconMove;
  }
  | {
    type: "remove";
    barId: string;
    iconId: string;
  }
  | {
    type: "reset";
    nextState: ActivityBarsState;
  };

/**
 * @function activityBarReducer
 * @description activity bar reducer。
 * @param state 当前状态。
 * @param action 更新动作。
 * @returns 更新后的状态。
 */
function activityBarReducer(
  state: ActivityBarsState,
  action: ActivityBarAction,
): ActivityBarsState {
  if (action.type === "select") {
    return selectActivityBarIcon(state, action.barId, action.iconId);
  }

  if (action.type === "move") {
    return moveActivityBarIcon(state, action.move);
  }

  if (action.type === "remove") {
    return removeActivityBarIcon(state, action.barId, action.iconId);
  }

  return action.nextState;
}

/**
 * @function useActivityBarState
 * @description 将 activity bar 状态模型接入 React。
 * @param options hook 初始化参数。
 * @returns activity bar 状态控制器。
 */
export function useActivityBarState(
  options: UseActivityBarStateOptions,
): ActivityBarStateController {
  const [state, dispatch] = useReducer(activityBarReducer, options.initialState);

  return {
    state,
    getBar: (barId) => getActivityBarById(state, barId),
    selectIcon: (barId, iconId) => {
      dispatch({
        type: "select",
        barId,
        iconId,
      });
    },
    removeIcon: (barId, iconId) => {
      dispatch({
        type: "remove",
        barId,
        iconId,
      });
    },
    moveIcon: (move) => {
      dispatch({
        type: "move",
        move,
      });
    },
    resetState: (nextState) => {
      dispatch({
        type: "reset",
        nextState,
      });
    },
  };
}

export { createActivityBarState };