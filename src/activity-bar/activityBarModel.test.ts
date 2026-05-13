/**
 * @module activity-bar/activityBarModel.test
 * @description activity bar 数据模型回归测试。
 */

import { describe, expect, test } from "bun:test";
import {
  createActivityBarState,
  moveActivityBarIcon,
  type ActivityBarIconDefinition,
} from "./activityBarModel";

function icon(id: string, section: "top" | "bottom" = "top"): ActivityBarIconDefinition {
  return {
    id,
    label: id,
    symbol: id.slice(0, 1).toUpperCase(),
    meta: { section },
  };
}

describe("moveActivityBarIcon", () => {
  test("keeps a downward same-bar move before the first bottom icon when target index points at that boundary", () => {
    const state = createActivityBarState([
      {
        id: "left",
        selectedIconId: "task-board",
        icons: [
          icon("files"),
          icon("search"),
          icon("calendar"),
          icon("task-board"),
          icon("notifications", "bottom"),
          icon("settings", "bottom"),
        ],
      },
    ]);

    const next = moveActivityBarIcon(state, {
      sourceBarId: "left",
      targetBarId: "left",
      iconId: "task-board",
      targetIndex: 4,
    });

    expect(next.bars.left.icons.map((item) => item.id)).toEqual([
      "files",
      "search",
      "calendar",
      "task-board",
      "notifications",
      "settings",
    ]);
  });
});
