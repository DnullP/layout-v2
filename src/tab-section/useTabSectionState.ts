/**
 * @module host/layout-v2/tab-section/useTabSectionState
 * @description tab section 状态的 React hook 封装。
 *   用于接入 tab section 纯模型，统一处理 focus、关闭、移动与重置。
 * @dependencies
 *   - react
 *   - ./tabSectionModel
 *
 * @example
 *   const tabs = useTabSectionState({
 *     initialState: createTabSectionsState([...]),
 *   });
 *
 * @exports
 *   - UseTabSectionStateOptions   hook 初始化参数
 *   - TabSectionStateController   hook 控制器
 *   - useTabSectionState          tab section hook
 */

import { useReducer } from "react";
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
} from "./tabSectionModel";

/**
 * @interface UseTabSectionStateOptions
 * @description useTabSectionState 初始化参数。
 * @field initialState 初始状态。
 */
export interface UseTabSectionStateOptions {
  /** 初始状态。 */
  initialState: TabSectionsState;
}

/**
 * @interface TabSectionStateController
 * @description tab section 状态控制器。
 * @field state         - 当前状态。
 * @field getSection    - 查询 section。
 * @field focusTab      - 切换 focus。
 * @field closeTab      - 关闭 tab。
 * @field moveTab       - 移动 tab。
 * @field upsertSection - 写入 section。
 * @field removeSection - 删除 section。
 * @field resetState    - 重置状态。
 */
export interface TabSectionStateController {
  /** 当前状态。 */
  state: TabSectionsState;
  /** 查询 section。 */
  getSection: (sectionId: string) => TabSectionStateItem | null;
  /** 切换 focus。 */
  focusTab: (sectionId: string, tabId: string) => void;
  /** 关闭 tab。 */
  closeTab: (sectionId: string, tabId: string) => void;
  /** 移动 tab。 */
  moveTab: (move: TabSectionTabMove) => void;
  /** 写入 section。 */
  upsertSection: (section: TabSectionStateItem) => void;
  /** 删除 section。 */
  removeSection: (sectionId: string) => void;
  /** 重置状态。 */
  resetState: (state: TabSectionsState) => void;
}

/**
 * @type TabSectionAction
 * @description hook 内部 reducer action。
 */
type TabSectionAction =
  | {
      type: "focus";
      sectionId: string;
      tabId: string;
    }
  | {
      type: "close";
      sectionId: string;
      tabId: string;
    }
  | {
      type: "move";
      move: TabSectionTabMove;
    }
  | {
      type: "upsert";
      section: TabSectionStateItem;
    }
  | {
      type: "remove";
      sectionId: string;
    }
  | {
      type: "reset";
      state: TabSectionsState;
    };

/**
 * @function tabSectionReducer
 * @description tab section reducer。
 * @param state 当前状态。
 * @param action 更新动作。
 * @returns 更新后的状态。
 */
function tabSectionReducer(
  state: TabSectionsState,
  action: TabSectionAction,
): TabSectionsState {
  if (action.type === "focus") {
    return focusTabSectionTab(state, action.sectionId, action.tabId);
  }

  if (action.type === "close") {
    return closeTabSectionTab(state, action.sectionId, action.tabId);
  }

  if (action.type === "move") {
    return moveTabSectionTab(state, action.move);
  }

  if (action.type === "upsert") {
    return upsertTabSection(state, action.section);
  }

  if (action.type === "remove") {
    return removeTabSection(state, action.sectionId);
  }

  return action.state;
}

/**
 * @function useTabSectionState
 * @description 将 tab section 状态模型接入 React。
 * @param options hook 初始化参数。
 * @returns tab section 状态控制器。
 */
export function useTabSectionState(
  options: UseTabSectionStateOptions,
): TabSectionStateController {
  const [state, dispatch] = useReducer(tabSectionReducer, options.initialState);

  return {
    state,
    getSection: (sectionId) => getTabSectionById(state, sectionId),
    focusTab: (sectionId, tabId) => {
      dispatch({
        type: "focus",
        sectionId,
        tabId,
      });
    },
    closeTab: (sectionId, tabId) => {
      dispatch({
        type: "close",
        sectionId,
        tabId,
      });
    },
    moveTab: (move) => {
      dispatch({
        type: "move",
        move,
      });
    },
    upsertSection: (section) => {
      dispatch({
        type: "upsert",
        section,
      });
    },
    removeSection: (sectionId) => {
      dispatch({
        type: "remove",
        sectionId,
      });
    },
    resetState: (nextState) => {
      dispatch({
        type: "reset",
        state: nextState,
      });
    },
  };
}

export { createTabSectionsState };