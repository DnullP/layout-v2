/**
 * @module tests/activityBarModel.test
 * @description activity bar 模型测试：验证 icon 选择、排序与跨栏移动。
 */

import { describe, expect, test } from "bun:test";
import {
  createActivityBarState,
  moveActivityBarIcon,
  reconcileActivityBarsState,
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

  test("同步声明式 activity bar 时应保留运行时排序", () => {
    const runtimeState = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "project-reader", label: "Project Reader", symbol: "P" },
          { id: "explorer", label: "Explorer", symbol: "E" },
          { id: "search", label: "Search", symbol: "S" },
        ],
        selectedIconId: "project-reader",
      },
    ]);
    const declarativeState = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Files", symbol: "F" },
          { id: "search", label: "Search", symbol: "S" },
          { id: "project-reader", label: "Project Reader", symbol: "P" },
        ],
        selectedIconId: "explorer",
      },
    ]);

    const nextState = reconcileActivityBarsState(runtimeState, declarativeState);

    expect(nextState.bars.primary.icons.map((icon) => icon.id)).toEqual([
      "project-reader",
      "explorer",
      "search",
    ]);
    expect(nextState.bars.primary.icons[1]?.label).toBe("Files");
    expect(nextState.bars.primary.selectedIconId).toBe("explorer");
  });

  test("同步声明式 activity bar 时应允许 top 与 bottom 分组变化生效", () => {
    const runtimeState = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "search", label: "Search", symbol: "S", meta: { section: "top" } },
          { id: "explorer", label: "Explorer", symbol: "E", meta: { section: "top" } },
          { id: "settings", label: "Settings", symbol: "G", meta: { section: "bottom" } },
        ],
        selectedIconId: "explorer",
      },
    ]);
    const declarativeState = createActivityBarState([
      {
        id: "primary",
        icons: [
          { id: "explorer", label: "Explorer", symbol: "E", meta: { section: "top" } },
          { id: "settings", label: "Settings", symbol: "G", meta: { section: "bottom" } },
          { id: "search", label: "Search", symbol: "S", meta: { section: "bottom" } },
        ],
        selectedIconId: "search",
      },
    ]);

    const nextState = reconcileActivityBarsState(runtimeState, declarativeState);

    expect(nextState.bars.primary.icons.map((icon) => icon.id)).toEqual([
      "explorer",
      "settings",
      "search",
    ]);
    expect(nextState.bars.primary.selectedIconId).toBe("search");
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
