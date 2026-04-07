/**
 * @module tests/activityBarModel.test
 * @description activity bar 模型测试：验证 icon 选择、排序与跨栏移动。
 */

import { describe, expect, test } from "bun:test";
import {
  createActivityBarState,
  moveActivityBarIcon,
  selectActivityBarIcon,
  updateActivityBarIconMetadata,
} from "../src/activity-bar/activityBarModel";

describe("activityBarModel", () => {
  test("应支持选中指定 icon", () => {
    const state = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E" },
          { id: "search", label: "Search", symbol: "S" },
        ],
        selectedIconId: null,
      },
    ]);

    const nextState = selectActivityBarIcon(state, "primary", "search");

    expect(nextState.bars.primary.selectedIconId).toBe("search");
  });

  test("应支持同一个 activity bar 内排序", () => {
    const state = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E" },
          { id: "search", label: "Search", symbol: "S" },
          { id: "git", label: "Git", symbol: "G" },
        ],
        selectedIconId: "explorer",
      },
    ]);

    const nextState = moveActivityBarIcon(state, {
      sourceBarId: "primary",
      targetBarId: "primary",
      iconId: "git",
      targetIndex: 0,
    });

    expect(nextState.bars.primary.icons.map((icon) => icon.id)).toEqual([
      "git",
      "explorer",
      "search",
    ]);
    expect(nextState.bars.primary.selectedIconId).toBe("git");
  });

  test("当实时拖拽经过同一位置时不应重复抖动", () => {
    const state = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E" },
          { id: "search", label: "Search", symbol: "S" },
          { id: "git", label: "Git", symbol: "G" },
        ],
        selectedIconId: "explorer",
      },
    ]);

    const nextState = moveActivityBarIcon(state, {
      sourceBarId: "primary",
      targetBarId: "primary",
      iconId: "search",
      targetIndex: 1,
    });

    expect(nextState).toBe(state);
  });

  test("应支持跨 activity bar 移动 icon", () => {
    const state = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E" },
          { id: "search", label: "Search", symbol: "S" },
        ],
        selectedIconId: "search",
      },
      {
        id: "secondary",
        icons: [
          { id: "debug", label: "Debug", symbol: "D" },
        ],
        selectedIconId: null,
      },
    ]);

    const nextState = moveActivityBarIcon(state, {
      sourceBarId: "primary",
      targetBarId: "secondary",
      iconId: "search",
      targetIndex: 1,
    });

    expect(nextState.bars.primary.icons.map((icon) => icon.id)).toEqual(["explorer"]);
    expect(nextState.bars.primary.selectedIconId).toBeNull();
    expect(nextState.bars.secondary.icons.map((icon) => icon.id)).toEqual([
      "debug",
      "search",
    ]);
    expect(nextState.bars.secondary.selectedIconId).toBe("search");
  });

  test("应支持为 activity icon 挂载宿主元数据", () => {
    const state = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E" },
        ],
        selectedIconId: "explorer",
      },
    ]);

    const nextState = updateActivityBarIconMetadata(state, "primary", "explorer", (meta) => ({
      ...meta,
      componentId: "explorer-view",
      restorePolicy: "sticky",
    }));

    expect(nextState.bars.primary.icons[0]?.meta).toEqual({
      componentId: "explorer-view",
      restorePolicy: "sticky",
    });
  });
});