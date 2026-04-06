/**
 * @module host/layout-v2/activity-bar/activityBarModel
 * @description activity bar 的纯数据模型与状态操作。
 *   该模块负责 icon 选择、拖拽重排与跨 activity bar 移动，
 *   不依赖 React，可直接复用于不同宿主或测试。
 * @dependencies
 *   - none
 *
 * @example
 *   let state = createActivityBarState([
 *     {
 *       id: "primary",
 *       icons: [
 *         { id: "explorer", label: "Explorer", symbol: "E" },
 *       ],
 *       selectedIconId: "explorer",
 *     },
 *   ]);
 *   state = moveActivityBarIcon(state, {
 *     sourceBarId: "primary",
 *     targetBarId: "primary",
 *     iconId: "explorer",
 *     targetIndex: 0,
 *   });
 *
 * @exports
 *   - ActivityBarIconDefinition    activity icon 定义
 *   - ActivityBarStateItem         单个 activity bar 状态
 *   - ActivityBarsState            全部 activity bar 状态
 *   - ActivityBarIconMove          icon 移动参数
 *   - createActivityBarState       创建 activity bar 状态
 *   - selectActivityBarIcon        选中 activity icon
 *   - moveActivityBarIcon          拖拽移动 activity icon
 *   - getActivityBarById           按 ID 获取 activity bar
 */

/**
 * @interface ActivityBarIconDefinition
 * @description activity bar icon 的数据定义。
 * @field id     - icon 标识。
 * @field label  - icon 文本标签。
 * @field symbol - icon 的简化符号内容。
 */
export interface ActivityBarIconDefinition {
  /** icon 标识。 */
  id: string;
  /** icon 文本标签。 */
  label: string;
  /** icon 的简化符号内容。 */
  symbol: string;
  /** 点击后是切换选中态还是仅触发外部动作。 */
  activationMode?: "focus" | "action";
}

/**
 * @interface ActivityBarStateItem
 * @description 单个 activity bar 的状态。
 * @field id             - activity bar 标识。
 * @field icons          - 当前 icon 顺序。
 * @field selectedIconId - 当前选中的 icon 标识。
 */
export interface ActivityBarStateItem {
  /** activity bar 标识。 */
  id: string;
  /** 当前 icon 顺序。 */
  icons: ActivityBarIconDefinition[];
  /** 当前选中的 icon 标识。 */
  selectedIconId: string | null;
}

/**
 * @interface ActivityBarsState
 * @description 全部 activity bar 的状态集合。
 * @field bars - 以 ID 为键的 activity bar 状态表。
 */
export interface ActivityBarsState {
  /** 以 ID 为键的 activity bar 状态表。 */
  bars: Record<string, ActivityBarStateItem>;
}

/**
 * @interface ActivityBarIconMove
 * @description activity icon 拖拽移动参数。
 * @field sourceBarId - 源 activity bar 标识。
 * @field targetBarId - 目标 activity bar 标识。
 * @field iconId      - 被移动的 icon 标识。
 * @field targetIndex - 目标插入位置。
 */
export interface ActivityBarIconMove {
  /** 源 activity bar 标识。 */
  sourceBarId: string;
  /** 目标 activity bar 标识。 */
  targetBarId: string;
  /** 被移动的 icon 标识。 */
  iconId: string;
  /** 目标插入位置。 */
  targetIndex: number;
}

/**
 * @function createActivityBarState
 * @description 基于初始 activity bar 列表创建状态。
 * @param bars 初始 activity bar 列表。
 * @returns activity bar 状态。
 */
export function createActivityBarState(bars: ActivityBarStateItem[]): ActivityBarsState {
  return {
    bars: Object.fromEntries(bars.map((bar) => [bar.id, bar])),
  };
}

/**
 * @function getActivityBarById
 * @description 按 ID 获取 activity bar 状态。
 * @param state activity bar 状态。
 * @param barId activity bar 标识。
 * @returns 对应 activity bar 状态；未命中时返回 null。
 */
export function getActivityBarById(
  state: ActivityBarsState,
  barId: string,
): ActivityBarStateItem | null {
  return state.bars[barId] ?? null;
}

/**
 * @function selectActivityBarIcon
 * @description 设置指定 activity bar 的选中 icon。
 * @param state activity bar 状态。
 * @param barId activity bar 标识。
 * @param iconId 目标 icon 标识。
 * @returns 更新后的状态。
 */
export function selectActivityBarIcon(
  state: ActivityBarsState,
  barId: string,
  iconId: string,
): ActivityBarsState {
  const bar = getActivityBarById(state, barId);
  if (!bar) {
    return state;
  }

  return {
    bars: {
      ...state.bars,
      [barId]: {
        ...bar,
        selectedIconId: iconId,
      },
    },
  };
}

/**
 * @function removeActivityBarIcon
 * @description 从指定 activity bar 中移除一个 icon。
 * @param state activity bar 状态。
 * @param barId activity bar 标识。
 * @param iconId 目标 icon 标识。
 * @returns 更新后的状态。
 */
export function removeActivityBarIcon(
  state: ActivityBarsState,
  barId: string,
  iconId: string,
): ActivityBarsState {
  const bar = getActivityBarById(state, barId);
  if (!bar) {
    return state;
  }

  const removedIndex = bar.icons.findIndex((icon) => icon.id === iconId);
  if (removedIndex < 0) {
    return state;
  }

  const nextIcons = bar.icons.filter((icon) => icon.id !== iconId);
  const nextSelectedIconId = bar.selectedIconId === iconId
    ? nextIcons[Math.max(0, removedIndex - 1)]?.id ?? nextIcons[0]?.id ?? null
    : bar.selectedIconId;

  return {
    bars: {
      ...state.bars,
      [barId]: {
        ...bar,
        icons: nextIcons,
        selectedIconId: nextSelectedIconId,
      },
    },
  };
}

/**
 * @function insertActivityBarIcon
 * @description 向指定 activity bar 插入一个 icon。
 * @param state activity bar 状态。
 * @param barId activity bar 标识。
 * @param icon 待插入 icon。
 * @param targetIndex 目标插入位置。
 * @returns 更新后的状态。
 */
export function insertActivityBarIcon(
  state: ActivityBarsState,
  barId: string,
  icon: ActivityBarIconDefinition,
  targetIndex: number,
): ActivityBarsState {
  const bar = getActivityBarById(state, barId);
  if (!bar) {
    return state;
  }

  const nextIcons = [...bar.icons.filter((item) => item.id !== icon.id)];
  const nextTargetIndex = clampTargetIndex(targetIndex, nextIcons.length);
  nextIcons.splice(nextTargetIndex, 0, icon);

  return {
    bars: {
      ...state.bars,
      [barId]: {
        ...bar,
        icons: nextIcons,
        selectedIconId: icon.id,
      },
    },
  };
}

/**
 * @function clampTargetIndex
 * @description 将目标插入位置约束到合法范围内。
 * @param targetIndex 候选插入位置。
 * @param listLength 目标列表长度。
 * @returns 约束后的插入位置。
 */
function clampTargetIndex(targetIndex: number, listLength: number): number {
  return Math.max(0, Math.min(targetIndex, listLength));
}

/**
 * @function moveActivityBarIcon
 * @description 移动 activity icon，支持同栏排序与跨栏移动。
 * @param state activity bar 状态。
 * @param move 移动参数。
 * @returns 更新后的状态。
 */
export function moveActivityBarIcon(
  state: ActivityBarsState,
  move: ActivityBarIconMove,
): ActivityBarsState {
  const sourceBar = getActivityBarById(state, move.sourceBarId);
  const targetBar = getActivityBarById(state, move.targetBarId);

  if (!sourceBar || !targetBar) {
    return state;
  }

  const sourceIndex = sourceBar.icons.findIndex((icon) => icon.id === move.iconId);
  if (sourceIndex < 0) {
    return state;
  }

  const movingIcon = sourceBar.icons[sourceIndex];
  const nextSourceIcons = sourceBar.icons.filter((icon) => icon.id !== move.iconId);

  if (move.sourceBarId === move.targetBarId) {
    const nextTargetIndex = clampTargetIndex(move.targetIndex, nextSourceIcons.length);
    if (sourceIndex === nextTargetIndex) {
      return state;
    }

    const reorderedIcons = [...nextSourceIcons];
    reorderedIcons.splice(nextTargetIndex, 0, movingIcon);

    return {
      bars: {
        ...state.bars,
        [sourceBar.id]: {
          ...sourceBar,
          icons: reorderedIcons,
          selectedIconId: movingIcon.id,
        },
      },
    };
  }

  const nextTargetIcons = [...targetBar.icons];
  const nextTargetIndex = clampTargetIndex(move.targetIndex, nextTargetIcons.length);
  nextTargetIcons.splice(nextTargetIndex, 0, movingIcon);

  return {
    bars: {
      ...state.bars,
      [sourceBar.id]: {
        ...sourceBar,
        icons: nextSourceIcons,
        selectedIconId:
          sourceBar.selectedIconId === movingIcon.id ? null : sourceBar.selectedIconId,
      },
      [targetBar.id]: {
        ...targetBar,
        icons: nextTargetIcons,
        selectedIconId: movingIcon.id,
      },
    },
  };
}