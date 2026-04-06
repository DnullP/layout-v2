/**
 * @module tests/tabSectionModel.test
 * @description tab section 纯模型测试：验证 focus、关闭、同栏重排与跨 section 移动。
 */

import { describe, expect, test } from "bun:test";
import {
  closeTabSectionTab,
  createTabSectionsState,
  focusTabSectionTab,
  moveTabSectionTab,
} from "../src";

describe("tabSectionModel", () => {
  test("应支持切换指定 tab 的 focus", () => {
    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [
          { id: "welcome", title: "Welcome", content: "Welcome card" },
          { id: "graph", title: "Graph", content: "Graph card" },
        ],
        focusedTabId: "welcome",
      },
    ]);

    const nextState = focusTabSectionTab(state, "main-tabs", "graph");

    expect(nextState.sections["main-tabs"]?.focusedTabId).toBe("graph");
  });

  test("关闭当前 focused tab 时应将 focus 切换到相邻 tab", () => {
    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [
          { id: "welcome", title: "Welcome", content: "Welcome card" },
          { id: "graph", title: "Graph", content: "Graph card" },
          { id: "notes", title: "Notes", content: "Notes card" },
        ],
        focusedTabId: "graph",
      },
    ]);

    const nextState = closeTabSectionTab(state, "main-tabs", "graph");

    expect(nextState.sections["main-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "welcome",
      "notes",
    ]);
    expect(nextState.sections["main-tabs"]?.focusedTabId).toBe("notes");
  });

  test("应支持同一个 section 内实时重排 tab", () => {
    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [
          { id: "welcome", title: "Welcome", content: "Welcome card" },
          { id: "graph", title: "Graph", content: "Graph card" },
          { id: "notes", title: "Notes", content: "Notes card" },
        ],
        focusedTabId: "welcome",
      },
    ]);

    const nextState = moveTabSectionTab(state, {
      sourceSectionId: "main-tabs",
      targetSectionId: "main-tabs",
      tabId: "notes",
      targetIndex: 1,
    });

    expect(nextState.sections["main-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "welcome",
      "notes",
      "graph",
    ]);
    expect(nextState.sections["main-tabs"]?.focusedTabId).toBe("notes");
  });

  test("应支持跨 section 移动 tab", () => {
    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [
          { id: "welcome", title: "Welcome", content: "Welcome card" },
          { id: "graph", title: "Graph", content: "Graph card" },
        ],
        focusedTabId: "graph",
      },
      {
        id: "secondary-tabs",
        tabs: [
          { id: "settings", title: "Settings", content: "Settings card" },
        ],
        focusedTabId: "settings",
      },
    ]);

    const nextState = moveTabSectionTab(state, {
      sourceSectionId: "main-tabs",
      targetSectionId: "secondary-tabs",
      tabId: "graph",
      targetIndex: 1,
    });

    expect(nextState.sections["main-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "welcome",
    ]);
    expect(nextState.sections["main-tabs"]?.focusedTabId).toBe("welcome");
    expect(nextState.sections["secondary-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "settings",
      "graph",
    ]);
    expect(nextState.sections["secondary-tabs"]?.focusedTabId).toBe("graph");
  });
});