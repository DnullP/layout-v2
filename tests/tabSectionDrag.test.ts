import { describe, expect, test } from "bun:test";
import {
  advanceTabSectionDragSessionPointer,
  type TabSectionDragSession,
} from "../src/tab-section/tabSectionDrag";

function createSession(): TabSectionDragSession {
  return {
    sourceTabSectionId: "main-tabs",
    currentTabSectionId: "main-tabs",
    sourceLeafSectionId: "main-leaf",
    currentLeafSectionId: "main-leaf",
    tabId: "welcome",
    title: "Welcome",
    content: "Welcome card",
    pointerId: 1,
    originX: 10,
    originY: 10,
    pointerX: 10,
    pointerY: 10,
    phase: "pending",
    hoverTarget: {
      area: "strip",
      leafSectionId: "main-leaf",
      anchorLeafSectionId: "main-leaf",
      tabSectionId: "main-tabs",
      targetIndex: 0,
    },
  };
}

describe("tabSectionDrag session helpers", () => {
  test("未超过阈值时保持 pending", () => {
    const session = createSession();
    const next = advanceTabSectionDragSessionPointer(session, 12, 12);

    expect(next.phase).toBe("pending");
    expect(next.pointerX).toBe(12);
    expect(next.pointerY).toBe(12);
  });

  test("超过阈值时切换到 dragging", () => {
    const session = createSession();
    const next = advanceTabSectionDragSessionPointer(session, 16, 16);

    expect(next.phase).toBe("dragging");
    expect(next.pointerX).toBe(16);
    expect(next.pointerY).toBe(16);
  });
});