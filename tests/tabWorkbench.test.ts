import { describe, expect, test } from "bun:test";
import {
  buildTabWorkbenchPreviewState,
  cleanupEmptyTabWorkbenchSections,
  commitTabWorkbenchDrop,
  createRootSection,
  createSectionComponentBinding,
  createTabSectionsState,
  findSectionNode,
  splitSectionTree,
  type SectionComponentData,
  type SectionDraft,
  type TabSectionDragSession,
} from "../src";

interface TestBindingData extends SectionComponentData {
  role: "root" | "main" | "container";
}

function createDraft(
  id: string,
  title: string,
  role: TestBindingData["role"],
  component: TestBindingData["component"],
): SectionDraft<TestBindingData> {
  return {
    id,
    title,
    data: {
      role,
      component,
    },
  };
}

const adapter = {
  createTabSectionDraft: ({ sourceLeaf, nextSectionId, nextTabSectionId, title }: {
    sourceLeaf: ReturnType<typeof createRootSection<TestBindingData>>;
    nextSectionId: string;
    nextTabSectionId: string;
    title: string;
  }): SectionDraft<TestBindingData> => ({
    id: nextSectionId,
    title,
    data: {
      role: sourceLeaf.data.role,
      component: createSectionComponentBinding("tab-section", {
        tabSectionId: nextTabSectionId,
      }),
    },
    resizableEdges: sourceLeaf.resizableEdges,
  }),
};

describe("tabWorkbench helpers", () => {
  test("preview split 应生成临时 tab section 并折叠空源 section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "source-tabs",
        }),
      ),
      second: createDraft(
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

    const preview = buildTabWorkbenchPreviewState(root, state, session, adapter);

    expect(preview).not.toBeNull();
    expect(preview?.state.sections["source-tabs"]).toBeUndefined();
    expect(preview?.state.sections["target-tabs"]?.tabs.map((tab) => tab.id)).toEqual(["outline"]);
    const previewSection = Object.values(preview!.state.sections).find((section) => section.tabs.some((tab) => tab.id === "review"));
    expect(previewSection?.tabs.map((tab) => tab.id)).toEqual(["review"]);
  });

  test("commit split 应生成新的 committed tab section 并返回 active group", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "source-tabs",
        }),
      ),
      second: createDraft(
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

    const committed = commitTabWorkbenchDrop(root, state, session, adapter);

    expect(committed).not.toBeNull();
    expect(committed?.activeTabSectionId).toBeTruthy();
    expect(committed?.state.sections["source-tabs"]).toBeUndefined();
    expect(findSectionNode(committed!.root, "source-leaf")).toBeNull();
    expect(committed?.state.sections["target-tabs"]?.tabs.map((tab) => tab.id)).toEqual(["outline"]);
    const newGroup = Object.values(committed!.state.sections).find((section) => section.tabs.some((tab) => tab.id === "review"));
    expect(newGroup).toBeTruthy();
    expect(newGroup?.id ?? null).toBe(committed?.activeTabSectionId ?? null);
  });

  test("cleanup 应在空 root tab section 被折叠后转移 root 标记", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createDraft(
        "root-tabs-leaf",
        "Root Tabs",
        "main",
        createSectionComponentBinding("tab-section", {
          tabSectionId: "main-tabs",
        }),
      ),
      second: createDraft(
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
        id: "review-tabs",
        tabs: [{ id: "review", title: "Review", content: "Review card" }],
        focusedTabId: "review",
        isRoot: false,
      },
    ]);

    const cleaned = cleanupEmptyTabWorkbenchSections(root, state, adapter);

    expect(cleaned.state.sections["main-tabs"]).toBeUndefined();
    expect(cleaned.state.sections["review-tabs"]?.isRoot).toBe(true);
  });
});
