/**
 * @module tests/layoutV2ExampleState.test
 * @description layout-v2 示例状态测试：验证空 tab section 清理与 preview 分区不会留下空壳 section。
 */

import { describe, expect, test } from "bun:test";
import {
  createTabSectionsState,
  createRootSection,
  createSectionComponentBinding,
  splitSectionTree,
  type TabSectionDragSession,
} from "../src";
import {
  buildPreviewLayoutState,
  closeTabInLayoutState,
  cleanupEmptyTabSections,
  createExampleSectionDraft,
  findTabSectionLeaf,
  type ExampleSectionLayoutData,
} from "../example/exampleLayoutState";

describe("layoutV2 example state", () => {
  test("关闭最后一个 tab 时应销毁空 tab section 并提升 sibling", () => {
    let root = createRootSection<ExampleSectionLayoutData>(
      createExampleSectionDraft(
        "root",
        "Root",
        "root",
        createSectionComponentBinding("empty", {}),
      ),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createExampleSectionDraft(
        "main-leaf",
        "Main",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "main-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "review-leaf",
        "Review",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "review-tabs",
        }),
      ),
    });

    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [{ id: "welcome", title: "Welcome", content: "Welcome card" }],
        focusedTabId: "welcome",
        isRoot: true,
      },
      {
        id: "review-tabs",
        tabs: [{ id: "review", title: "Review", content: "Review card" }],
        focusedTabId: "review",
        isRoot: false,
      },
    ]);

    const closed = closeTabInLayoutState(root, state, "main-tabs", "welcome");

    expect(findTabSectionLeaf(closed.root, "main-tabs")).toBeNull();
    expect(findTabSectionLeaf(closed.root, "review-tabs")?.id).toBe("root");
    expect(closed.state.sections["main-tabs"]).toBeUndefined();
    expect(closed.state.sections["review-tabs"]?.isRoot).toBe(true);
  });

  test("空 root tab section 在 sibling 带子结构时应被折叠并转移 root 标记", () => {
    let root = createRootSection<ExampleSectionLayoutData>(
      createExampleSectionDraft(
        "root",
        "Root",
        "root",
        createSectionComponentBinding("empty", {}),
      ),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createExampleSectionDraft(
        "root-tabs-leaf",
        "Root Tabs",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "main-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "bottom-container",
        "Bottom Container",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    root = splitSectionTree(root, "bottom-container", "horizontal", {
      first: createExampleSectionDraft(
        "outline-leaf",
        "Outline",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "outline-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "review-leaf",
        "Review",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "review-tabs",
        }),
      ),
    });

    const state = createTabSectionsState([
      {
        id: "main-tabs",
        tabs: [],
        focusedTabId: null,
        isRoot: true,
      },
      {
        id: "outline-tabs",
        tabs: [{ id: "outline", title: "Outline", content: "Outline card" }],
        focusedTabId: "outline",
        isRoot: false,
      },
      {
        id: "review-tabs",
        tabs: [{ id: "review", title: "Review", content: "Review card" }],
        focusedTabId: "review",
        isRoot: false,
      },
    ]);

    const cleaned = cleanupEmptyTabSections(root, state);

    expect(findTabSectionLeaf(cleaned.root, "main-tabs")).toBeNull();
    expect(findTabSectionLeaf(cleaned.root, "outline-tabs")?.id).toBe("outline-leaf");
    expect(findTabSectionLeaf(cleaned.root, "review-tabs")?.id).toBe("review-leaf");
    expect(cleaned.state.sections["main-tabs"]).toBeUndefined();
    expect(cleaned.state.sections["outline-tabs"]?.isRoot).toBe(true);
    expect(cleaned.state.sections["review-tabs"]?.isRoot).toBeFalsy();
  });

  test("preview split 应将拖拽 tab 放入预览分区并折叠空源 section", () => {
    let root = createRootSection<ExampleSectionLayoutData>(
      createExampleSectionDraft(
        "root",
        "Root",
        "root",
        createSectionComponentBinding("empty", {}),
      ),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createExampleSectionDraft(
        "source-leaf",
        "Source",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "source-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "target-leaf",
        "Target",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "target-tabs",
        }),
      ),
    });

    const state = createTabSectionsState([
      {
        id: "source-tabs",
        tabs: [{ id: "review", title: "Review Queue", content: "Review card" }],
        focusedTabId: "review",
        isRoot: false,
      },
      {
        id: "target-tabs",
        tabs: [{ id: "outline", title: "Outline", content: "Outline card" }],
        focusedTabId: "outline",
        isRoot: true,
      },
    ]);

    const session: TabSectionDragSession = {
      sourceTabSectionId: "source-tabs",
      currentTabSectionId: "source-tabs",
      sourceLeafSectionId: "source-leaf",
      currentLeafSectionId: "source-leaf",
      tabId: "review",
      title: "Review Queue",
      content: "Review card",
      pointerId: 1,
      originX: 10,
      originY: 10,
      pointerX: 200,
      pointerY: 120,
      phase: "dragging",
      hoverTarget: {
        area: "content",
        leafSectionId: "target-leaf",
        anchorLeafSectionId: "target-leaf",
        tabSectionId: "target-tabs",
        splitSide: "right",
        contentBounds: {
          left: 100,
          top: 0,
          right: 300,
          bottom: 200,
          width: 200,
          height: 200,
        },
      },
    };

    const preview = buildPreviewLayoutState(root, state, session);

    expect(preview).not.toBeNull();
    expect(preview?.state.sections["source-tabs"]).toBeUndefined();
    expect(preview?.state.sections["target-tabs"]?.tabs.map((tab) => tab.id)).toEqual(["outline"]);

    const previewSectionEntry = Object.values(preview!.state.sections).find((section) => {
      return section.tabs.some((tab) => tab.id === "review");
    });

    expect(previewSectionEntry?.tabs.map((tab) => tab.id)).toEqual(["review"]);
    expect(findTabSectionLeaf(preview!.root, "source-tabs")).toBeNull();
    expect(findTabSectionLeaf(preview!.root, "target-tabs")).not.toBeNull();
    expect(findTabSectionLeaf(preview!.root, previewSectionEntry!.id)).not.toBeNull();
  });

  test("content 中央区 preview 应将 tab 预合并到目标 section 并折叠空源 section", () => {
    let root = createRootSection<ExampleSectionLayoutData>(
      createExampleSectionDraft(
        "root",
        "Root",
        "root",
        createSectionComponentBinding("empty", {}),
      ),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createExampleSectionDraft(
        "source-leaf",
        "Source",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "source-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "target-leaf",
        "Target",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "target-tabs",
        }),
      ),
    });

    const state = createTabSectionsState([
      {
        id: "source-tabs",
        tabs: [{ id: "daily", title: "Daily Notes", content: "Daily card" }],
        focusedTabId: "daily",
        isRoot: false,
      },
      {
        id: "target-tabs",
        tabs: [
          { id: "welcome", title: "Welcome", content: "Welcome card" },
          { id: "outline", title: "Outline", content: "Outline card" },
          { id: "review", title: "Review Queue", content: "Review card" },
        ],
        focusedTabId: "review",
        isRoot: true,
      },
    ]);

    const session: TabSectionDragSession = {
      sourceTabSectionId: "source-tabs",
      currentTabSectionId: "source-tabs",
      sourceLeafSectionId: "source-leaf",
      currentLeafSectionId: "source-leaf",
      tabId: "daily",
      title: "Daily Notes",
      content: "Daily card",
      pointerId: 2,
      originX: 10,
      originY: 10,
      pointerX: 180,
      pointerY: 100,
      phase: "dragging",
      hoverTarget: {
        area: "content",
        leafSectionId: "target-leaf",
        anchorLeafSectionId: "target-leaf",
        tabSectionId: "target-tabs",
        splitSide: null,
        contentBounds: {
          left: 100,
          top: 0,
          right: 300,
          bottom: 200,
          width: 200,
          height: 200,
        },
      },
    };

    const preview = buildPreviewLayoutState(root, state, session);

    expect(preview).not.toBeNull();
    expect(findTabSectionLeaf(preview!.root, "source-tabs")).toBeNull();
    expect(preview!.state.sections["source-tabs"]).toBeUndefined();
    expect(preview!.state.sections["target-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "welcome",
      "outline",
      "review",
      "daily",
    ]);
  });

  test("单 tab source 在开始拖拽且尚未命中内容区时应先预折叠", () => {
    let root = createRootSection<ExampleSectionLayoutData>(
      createExampleSectionDraft(
        "root",
        "Root",
        "root",
        createSectionComponentBinding("empty", {}),
      ),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createExampleSectionDraft(
        "source-leaf",
        "Source",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "source-tabs",
        }),
      ),
      second: createExampleSectionDraft(
        "target-leaf",
        "Target",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "target-tabs",
        }),
      ),
    });

    const state = createTabSectionsState([
      {
        id: "source-tabs",
        tabs: [{ id: "welcome", title: "Welcome", content: "Welcome card" }],
        focusedTabId: "welcome",
        isRoot: false,
      },
      {
        id: "target-tabs",
        tabs: [
          { id: "daily", title: "Daily Notes", content: "Daily card" },
          { id: "outline", title: "Outline", content: "Outline card" },
          { id: "review", title: "Review Queue", content: "Review card" },
        ],
        focusedTabId: "review",
        isRoot: true,
      },
    ]);

    const session: TabSectionDragSession = {
      sourceTabSectionId: "source-tabs",
      currentTabSectionId: "source-tabs",
      sourceLeafSectionId: "source-leaf",
      currentLeafSectionId: "source-leaf",
      tabId: "welcome",
      title: "Welcome",
      content: "Welcome card",
      pointerId: 3,
      originX: 10,
      originY: 10,
      pointerX: 60,
      pointerY: 80,
      phase: "dragging",
      hoverTarget: null,
    };

    const preview = buildPreviewLayoutState(root, state, session);

    expect(preview).not.toBeNull();
    expect(findTabSectionLeaf(preview!.root, "source-tabs")).toBeNull();
    expect(findTabSectionLeaf(preview!.root, "target-tabs")).not.toBeNull();
    expect(preview!.state.sections["source-tabs"]).toBeUndefined();
    expect(preview!.state.sections["target-tabs"]?.tabs.map((tab) => tab.id)).toEqual([
      "daily",
      "outline",
      "review",
    ]);
  });
});