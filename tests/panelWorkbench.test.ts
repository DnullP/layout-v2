import { describe, expect, test } from "bun:test";
import {
  buildPanelWorkbenchPreviewState,
  buildActivityBarContentPreviewState,
  cleanupEmptyPanelWorkbenchSections,
  commitPanelWorkbenchDrop,
  commitActivityBarContentDrop,
  createRootSection,
  createSectionComponentBinding,
  createPanelSectionsState,
  finalizePanelWorkbenchDrop,
  findSectionNode,
  movePanelSectionPanel,
  splitSectionTree,
  buildWorkbenchPanelSections,
  WORKBENCH_LEFT_PANEL_SECTION_ID,
  WORKBENCH_RIGHT_PANEL_SECTION_ID,
  type SectionComponentData,
  type SectionDraft,
  type PanelSectionDragSession,
  type PanelSectionHoverTarget,
  type WorkbenchActivityDefinition,
  type WorkbenchPanelDefinition,
} from "../src";

interface TestBindingData extends SectionComponentData {
  role: "root" | "sidebar" | "container";
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
  createPanelSectionDraft: ({ sourceLeaf, nextSectionId, nextPanelSectionId, title }: {
    sourceLeaf: ReturnType<typeof createRootSection<TestBindingData>>;
    nextSectionId: string;
    nextPanelSectionId: string;
    title: string;
  }): SectionDraft<TestBindingData> => ({
    id: nextSectionId,
    title,
    data: {
      role: sourceLeaf.data.role,
      component: createSectionComponentBinding("panel-section", {
        panelSectionId: nextPanelSectionId,
      }),
    },
    resizableEdges: sourceLeaf.resizableEdges,
  }),
};

function createDragSession(overrides: Partial<PanelSectionDragSession> = {}): PanelSectionDragSession {
  return {
    sourcePanelSectionId: "source-panels",
    currentPanelSectionId: "source-panels",
    sourceLeafSectionId: "source-leaf",
    currentLeafSectionId: "source-leaf",
    activityTarget: null,
    panelId: "terminal",
    label: "Terminal",
    symbol: "T",
    content: "Terminal pane",
    pointerId: 1,
    originX: 100,
    originY: 100,
    pointerX: 200,
    pointerY: 300,
    phase: "dragging",
    hoverTarget: null,
    ...overrides,
  };
}

describe("panelWorkbench helpers", () => {
  test("preview split 应生成临时 panel section 并折叠空源 section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "source-panels",
        }),
      ),
      second: createDraft(
        "target-leaf",
        "Target",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "target-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "source-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
      {
        id: "target-panels",
        panels: [
          { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
        ],
        focusedPanelId: "problems",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      hoverTarget: {
        area: "content",
        leafSectionId: "target-leaf",
        anchorLeafSectionId: "target-leaf",
        panelSectionId: "target-panels",
        splitSide: "bottom",
        contentBounds: { left: 0, top: 100, right: 300, bottom: 400, width: 300, height: 300 },
      },
    });

    const result = buildPanelWorkbenchPreviewState(root, state, session, adapter);

    expect(result).not.toBeNull();
    // Source section should be cleaned up (only had 1 panel, now empty)
    expect(result!.state.sections["source-panels"]).toBeUndefined();
    // A detached preview panel section should be created alongside the target section.
    expect(Object.keys(result!.state.sections)).toHaveLength(2);
    const previewSection = Object.values(result!.state.sections).find((section) =>
      section.panels.some((panel) => panel.id === "terminal"),
    );
    expect(previewSection).toBeDefined();
    expect(previewSection!.panels.map((p) => p.id)).toEqual(["terminal"]);
    expect(result!.state.sections["target-panels"]?.panels.map((p) => p.id)).toEqual(["problems"]);
    // Source-leaf was destroyed (empty section cleanup). The sibling (target-leaf's
    // split children) got promoted into root, so root itself should now be split.
    expect(result!.root.split).toBeTruthy();
    expect(result!.root.split!.direction).toBe("vertical");
  });

  test("commit split 应创建新 panel section 和分裂 section tree", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "sidebar-leaf",
        "Sidebar",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "left-panels",
        }),
      ),
      second: createDraft(
        "other-leaf",
        "Other",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "left-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
          { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
    ]);

    const session = createDragSession({
      sourcePanelSectionId: "left-panels",
      currentPanelSectionId: "left-panels",
      panelId: "problems",
      label: "Problems",
      symbol: "P",
      hoverTarget: {
        area: "content",
        leafSectionId: "sidebar-leaf",
        anchorLeafSectionId: "sidebar-leaf",
        panelSectionId: "left-panels",
        splitSide: "bottom",
        contentBounds: { left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400 },
      },
    });

    const result = commitPanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    // Original section should still exist with only "terminal"
    expect(result!.state.sections["left-panels"]?.panels.map((p) => p.id)).toEqual(["terminal"]);
    // A new panel section should be created
    const newSectionIds = Object.keys(result!.state.sections).filter((id) => id !== "left-panels");
    expect(newSectionIds.length).toBe(1);
    // The new section should have "problems"
    const newSection = result!.state.sections[newSectionIds[0]];
    expect(newSection.panels.map((p) => p.id)).toEqual(["problems"]);
    // sidebar-leaf should be split vertically
    const sidebarNode = findSectionNode(result!.root, "sidebar-leaf");
    expect(sidebarNode?.split?.direction).toBe("vertical");
  });

  test("single-panel source 的 split commit 应在 detached base 上创建新 section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "source-panels",
        }),
      ),
      second: createDraft(
        "target-leaf",
        "Target",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "target-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "source-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
      {
        id: "target-panels",
        panels: [
          { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
        ],
        focusedPanelId: "problems",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      hoverTarget: {
        area: "content",
        leafSectionId: "target-leaf",
        anchorLeafSectionId: "target-leaf",
        panelSectionId: "target-panels",
        splitSide: "bottom",
        contentBounds: { left: 0, top: 100, right: 300, bottom: 400, width: 300, height: 300 },
      },
    });

    const result = commitPanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    expect(result!.state.sections["source-panels"]).toBeUndefined();
    expect(result!.state.sections["target-panels"]?.panels.map((panel) => panel.id)).toEqual([
      "problems",
    ]);
    const detachedSection = Object.values(result!.state.sections).find((section) =>
      section.panels.some((panel) => panel.id === "terminal"),
    );
    expect(detachedSection).toBeDefined();
    expect(detachedSection!.id).not.toBe("target-panels");
    expect(detachedSection!.panels.map((panel) => panel.id)).toEqual(["terminal"]);
    expect(result!.root.split?.direction).toBe("vertical");
  });

  test("commit split top 应将新 section 放在上方", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "sidebar-leaf",
        "Sidebar",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "left-panels",
        }),
      ),
      second: createDraft(
        "other-leaf",
        "Other",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "left-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
          { id: "problems", label: "Problems", symbol: "P", content: "Problems pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
    ]);

    const session = createDragSession({
      sourcePanelSectionId: "left-panels",
      currentPanelSectionId: "left-panels",
      panelId: "problems",
      label: "Problems",
      symbol: "P",
      hoverTarget: {
        area: "content",
        leafSectionId: "sidebar-leaf",
        anchorLeafSectionId: "sidebar-leaf",
        panelSectionId: "left-panels",
        splitSide: "top",
        contentBounds: { left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400 },
      },
    });

    const result = commitPanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    // sidebar-leaf should be split vertically
    const sidebarNode = findSectionNode(result!.root, "sidebar-leaf");
    expect(sidebarNode?.split?.direction).toBe("vertical");
    // For "top" split: the new section is first (top), original is second (bottom)
    const firstChild = sidebarNode!.split!.children[0];
    const secondChild = sidebarNode!.split!.children[1];

    // First child should be the new section with "problems"
    const firstBinding = firstChild.data.component;
    const firstPanelSectionId = (firstBinding.props as { panelSectionId: string }).panelSectionId;
    expect(result!.state.sections[firstPanelSectionId]?.panels.map((p) => p.id)).toEqual(["problems"]);

    // Second child should be the original section with "terminal"
    const secondBinding = secondChild.data.component;
    const secondPanelSectionId = (secondBinding.props as { panelSectionId: string }).panelSectionId;
    expect(result!.state.sections[secondPanelSectionId]?.panels.map((p) => p.id)).toEqual(["terminal"]);
  });

  test("无 content hover target 时 commit 应返回 null", () => {
    const root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("panel-section", {
        panelSectionId: "main-panels",
      })),
    );

    const state = createPanelSectionsState([
      {
        id: "main-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      hoverTarget: {
        area: "bar",
        leafSectionId: "root",
        panelSectionId: "main-panels",
        targetIndex: 0,
      },
    });

    expect(commitPanelWorkbenchDrop(root, state, session, adapter)).toBeNull();
  });

  test("single-panel source 在 hover target 未建立前应预销毁 source section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "main-panels",
        }),
      ),
      second: createDraft(
        "other-leaf",
        "Other",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "main-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      hoverTarget: null,
      sourcePanelSectionId: "main-panels",
      currentPanelSectionId: "main-panels",
      sourceLeafSectionId: "source-leaf",
      currentLeafSectionId: "source-leaf",
    });

    const preview = buildPanelWorkbenchPreviewState(root, state, session, adapter);

    expect(preview).not.toBeNull();
    expect(preview!.state.sections["main-panels"]).toBeUndefined();
    expect(findSectionNode(preview!.root, "source-leaf")).toBeNull();
    expect(preview!.root.split).toBeNull();
  });

  test("single-panel source 在 panel bar drop 时应沿用 detached base 并回收空 source section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "source-leaf",
        "Source",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "source-panels",
        }),
      ),
      second: createDraft(
        "target-leaf",
        "Target",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "target-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "source-panels",
        panels: [
          { id: "outline", label: "Outline", symbol: "O", content: "Outline" },
        ],
        focusedPanelId: "outline",
        isCollapsed: false,
      },
      {
        id: "target-panels",
        panels: [
          { id: "files", label: "Files", symbol: "F", content: "Files" },
        ],
        focusedPanelId: "files",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      sourcePanelSectionId: "source-panels",
      currentPanelSectionId: "source-panels",
      sourceLeafSectionId: "source-leaf",
      currentLeafSectionId: "source-leaf",
      panelId: "outline",
      label: "Outline",
      symbol: "O",
      content: "Outline",
      hoverTarget: {
        area: "bar",
        leafSectionId: "target-leaf",
        panelSectionId: "target-panels",
        targetIndex: 1,
      },
    });

    const result = finalizePanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    expect(result!.state.sections["source-panels"]).toBeUndefined();
    expect(result!.state.sections["target-panels"]?.panels.map((panel) => panel.id)).toEqual([
      "files",
      "outline",
    ]);
    expect(result!.root.split).toBeNull();
  });

  test("cleanup 应移除空的非 root panel section 并销毁对应 leaf", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createDraft(
        "top-leaf",
        "Top",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "top-panels",
        }),
      ),
      second: createDraft(
        "bottom-leaf",
        "Bottom",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "bottom-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "top-panels",
        panels: [],
        focusedPanelId: null,
        isCollapsed: false,
        isRoot: false,
      },
      {
        id: "bottom-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
    ]);

    const result = cleanupEmptyPanelWorkbenchSections(root, state, adapter);

    // empty top-panels should be removed
    expect(result.state.sections["top-panels"]).toBeUndefined();
    // bottom-panels should remain
    expect(result.state.sections["bottom-panels"]).toBeDefined();
    // root should no longer be split (the empty leaf was destroyed)
    expect(result.root.split).toBeNull();
  });

  test("cross-section content drop 无 splitSide 时应将 panel 移入目标 section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createDraft(
        "top-leaf",
        "Top",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "top-panels",
        }),
      ),
      second: createDraft(
        "bottom-leaf",
        "Bottom",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "bottom-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "top-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
      {
        id: "bottom-panels",
        panels: [
          { id: "problems", label: "Problems", symbol: "P", content: "Problems" },
        ],
        focusedPanelId: "problems",
        isCollapsed: false,
      },
    ]);

    const session = createDragSession({
      sourcePanelSectionId: "top-panels",
      currentPanelSectionId: "top-panels",
      panelId: "terminal",
      hoverTarget: {
        area: "content",
        leafSectionId: "bottom-leaf",
        panelSectionId: "bottom-panels",
        // no splitSide → move into existing section
        contentBounds: { left: 0, top: 200, right: 300, bottom: 400, width: 300, height: 200 },
      },
    });

    const result = commitPanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    // terminal should be in bottom-panels now
    expect(result!.state.sections["bottom-panels"]?.panels.map((p) => p.id)).toEqual([
      "problems",
      "terminal",
    ]);
    // top-panels had only 1 panel and is root, so it should be kept but empty
    // After cleanup, the empty root stays
    expect(result!.state.sections["top-panels"]?.panels.length).toBe(0);
  });

  test("finalize 应在 panel bar drop 后回收拖空的 split section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createDraft(
        "root-leaf",
        "Root",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "root-panels",
        }),
      ),
      second: createDraft(
        "split-leaf",
        "Split",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "split-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "root-panels",
        panels: [
          { id: "files", label: "Files", symbol: "F", content: "Files" },
        ],
        focusedPanelId: "files",
        isCollapsed: false,
        isRoot: true,
      },
      {
        id: "split-panels",
        panels: [
          { id: "outline", label: "Outline", symbol: "O", content: "Outline" },
        ],
        focusedPanelId: "outline",
        isCollapsed: false,
        isRoot: false,
      },
    ]);

    const movedState = movePanelSectionPanel(state, {
      sourceSectionId: "split-panels",
      targetSectionId: "root-panels",
      panelId: "outline",
      targetIndex: 1,
    });

    const session = createDragSession({
      sourcePanelSectionId: "split-panels",
      currentPanelSectionId: "root-panels",
      currentLeafSectionId: "root-leaf",
      panelId: "outline",
      label: "Outline",
      symbol: "O",
      content: "Outline",
      hoverTarget: {
        area: "bar",
        leafSectionId: "root-leaf",
        panelSectionId: "root-panels",
        targetIndex: 1,
      },
    });

    const result = finalizePanelWorkbenchDrop(root, movedState, session, adapter);

    expect(result).not.toBeNull();
    expect(result!.state.sections["split-panels"]).toBeUndefined();
    expect(result!.state.sections["root-panels"]?.panels.map((p) => p.id)).toEqual([
      "files",
      "outline",
    ]);
    expect(result!.root.split).toBeNull();
  });

  test("finalize 应在 panel bar drop 时兜底应用最后一次 move 并回收 split section", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "vertical", {
      first: createDraft(
        "root-leaf",
        "Root",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "root-panels",
        }),
      ),
      second: createDraft(
        "split-leaf",
        "Split",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "split-panels",
        }),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "root-panels",
        panels: [
          { id: "files", label: "Files", symbol: "F", content: "Files" },
        ],
        focusedPanelId: "files",
        isCollapsed: false,
        isRoot: true,
      },
      {
        id: "split-panels",
        panels: [
          { id: "outline", label: "Outline", symbol: "O", content: "Outline" },
        ],
        focusedPanelId: "outline",
        isCollapsed: false,
        isRoot: false,
      },
    ]);

    const session = createDragSession({
      sourcePanelSectionId: "split-panels",
      currentPanelSectionId: "split-panels",
      currentLeafSectionId: "split-leaf",
      panelId: "outline",
      label: "Outline",
      symbol: "O",
      content: "Outline",
      hoverTarget: {
        area: "bar",
        leafSectionId: "root-leaf",
        panelSectionId: "root-panels",
        targetIndex: 1,
      },
    });

    const result = finalizePanelWorkbenchDrop(root, state, session, adapter);

    expect(result).not.toBeNull();
    expect(result!.state.sections["split-panels"]).toBeUndefined();
    expect(result!.state.sections["root-panels"]?.panels.map((p) => p.id)).toEqual([
      "files",
      "outline",
    ]);
    expect(result!.root.split).toBeNull();
  });
});

describe("activityBarContentDrop helpers", () => {
  test("preview 应生成临时 panel section 和 split", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "sidebar-leaf",
        "Sidebar",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "left-panels",
        }),
      ),
      second: createDraft(
        "editor-leaf",
        "Editor",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "left-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
    ]);

    const contentTarget: PanelSectionHoverTarget = {
      area: "content",
      leafSectionId: "sidebar-leaf",
      anchorLeafSectionId: "sidebar-leaf",
      panelSectionId: "left-panels",
      splitSide: "bottom",
      contentBounds: { left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400 },
    };

    const result = buildActivityBarContentPreviewState(root, state, contentTarget, adapter, "Files");
    expect(result).not.toBeNull();

    // sidebar-leaf should be split vertically
    const sidebarNode = findSectionNode(result!.root, "sidebar-leaf");
    expect(sidebarNode?.split?.direction).toBe("vertical");

    // New panel section should exist (empty — no panels moved)
    const allSectionIds = Object.keys(result!.state.sections);
    const newIds = allSectionIds.filter((id) => id !== "left-panels");
    expect(newIds.length).toBe(1);
    expect(result!.state.sections[newIds[0]].panels).toEqual([]);
  });

  test("commit bottom 应创建新 section 并返回 newPanelSectionId", () => {
    let root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    root = splitSectionTree(root, "root", "horizontal", {
      first: createDraft(
        "sidebar-leaf",
        "Sidebar",
        "sidebar",
        createSectionComponentBinding("panel-section", {
          panelSectionId: "left-panels",
        }),
      ),
      second: createDraft(
        "editor-leaf",
        "Editor",
        "container",
        createSectionComponentBinding("empty", {}),
      ),
    });

    const state = createPanelSectionsState([
      {
        id: "left-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal pane" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
        isRoot: true,
      },
    ]);

    const contentTarget: PanelSectionHoverTarget = {
      area: "content",
      leafSectionId: "sidebar-leaf",
      anchorLeafSectionId: "sidebar-leaf",
      panelSectionId: "left-panels",
      splitSide: "bottom",
      contentBounds: { left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400 },
    };

    const result = commitActivityBarContentDrop(root, state, contentTarget, adapter);
    expect(result).not.toBeNull();

    // Should return the new panel section id
    expect(typeof result!.newPanelSectionId).toBe("string");
    expect(result!.newPanelSectionId).not.toBe("left-panels");

    // sidebar-leaf should be split vertically
    const sidebarNode = findSectionNode(result!.root, "sidebar-leaf");
    expect(sidebarNode?.split?.direction).toBe("vertical");

    // New section should be empty (host populates it)
    expect(result!.state.sections[result!.newPanelSectionId].panels).toEqual([]);

    // Original section should still have its panels
    expect(result!.state.sections["left-panels"]?.panels.map((p) => p.id)).toEqual(["terminal"]);
  });

  test("无 splitSide 时 commit 应返回 null", () => {
    const root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("panel-section", {
        panelSectionId: "main-panels",
      })),
    );

    const state = createPanelSectionsState([
      {
        id: "main-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
    ]);

    const contentTarget: PanelSectionHoverTarget = {
      area: "content",
      leafSectionId: "root",
      panelSectionId: "main-panels",
      // no splitSide
      contentBounds: { left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400 },
    };

    expect(commitActivityBarContentDrop(root, state, contentTarget, adapter)).toBeNull();
  });

  test("null contentTarget 时 commit 和 preview 应返回 null", () => {
    const root = createRootSection<TestBindingData>(
      createDraft("root", "Root", "root", createSectionComponentBinding("panel-section", {
        panelSectionId: "main-panels",
      })),
    );

    const state = createPanelSectionsState([
      {
        id: "main-panels",
        panels: [
          { id: "terminal", label: "Terminal", symbol: "T", content: "Terminal" },
        ],
        focusedPanelId: "terminal",
        isCollapsed: false,
      },
    ]);

    expect(commitActivityBarContentDrop(root, state, null, adapter)).toBeNull();
    expect(buildActivityBarContentPreviewState(root, state, null, adapter, "")).toBeNull();
  });
});

describe("panel drag-split duplication regression", () => {
  const activities: WorkbenchActivityDefinition[] = [
    { id: "files", label: "Files", bar: "left", section: "top" },
    { id: "outline", label: "Outline", bar: "right", section: "top" },
    { id: "ai-chat", label: "AI Chat", bar: "right", section: "top" },
  ];

  const panels: WorkbenchPanelDefinition[] = [
    { id: "files", label: "Files", activityId: "files", position: "left", order: 1 },
    { id: "outline", label: "Outline", activityId: "outline", position: "right", order: 1 },
    { id: "backlinks", label: "Backlinks", activityId: "outline", position: "right", order: 2 },
    { id: "ai-chat", label: "AI Chat", activityId: "ai-chat", position: "right", order: 1 },
  ];

  test("after panel drag-split, rebuilding root sections should not re-add the moved panel", () => {
    // Step 1: Build initial panel sections
    const initialSections = buildWorkbenchPanelSections(
      panels, activities, "files", null, "files", null,
    );

    // Verify right panel section has outline, backlinks, and ai-chat
    const rightSection = initialSections.find(
      (s) => s.id === WORKBENCH_RIGHT_PANEL_SECTION_ID,
    )!;
    expect(rightSection.panels.map((p) => p.id)).toEqual(["outline", "ai-chat", "backlinks"]);

    // Step 2: Simulate a panel drag-split — outline moved to satellite section
    const postSplitState = createPanelSectionsState([
      ...initialSections,
      {
        id: "satellite-section-1",
        panels: [
          { id: "outline", label: "Outline", symbol: "O", content: "Outline pane" },
        ],
        focusedPanelId: "outline",
        isCollapsed: false,
      },
    ]);

    // Step 3: Rebuild root sections (as the effect would after icon click)
    const rebuiltSections = buildWorkbenchPanelSections(
      panels, activities, "files", null, "files", null,
    );

    // Step 4: Filter out panels in satellite sections (this is the fix logic)
    const rootSectionIds = new Set([
      WORKBENCH_LEFT_PANEL_SECTION_ID,
      WORKBENCH_RIGHT_PANEL_SECTION_ID,
    ]);
    const panelsInSatelliteSections = new Set<string>();
    for (const [sectionId, section] of Object.entries(postSplitState.sections)) {
      if (!rootSectionIds.has(sectionId)) {
        for (const panel of section.panels) {
          panelsInSatelliteSections.add(panel.id);
        }
      }
    }

    // Verify outline should be excluded from the rebuilt right panel section
    const rebuiltRight = rebuiltSections.find(
      (s) => s.id === WORKBENCH_RIGHT_PANEL_SECTION_ID,
    )!;
    const filteredPanels = rebuiltRight.panels.filter(
      (p) => !panelsInSatelliteSections.has(p.id),
    );

    // Only ai-chat and backlinks should remain (outline is in satellite)
    expect(filteredPanels.map((p) => p.id)).toEqual(["ai-chat", "backlinks"]);
    // Outline should NOT appear in the rebuilt right section
    expect(filteredPanels.some((p) => p.id === "outline")).toBe(false);
  });

  test("satellite section exclusion should be empty when no drag-splits exist", () => {
    const initialSections = buildWorkbenchPanelSections(
      panels, activities, "files", null, "files", null,
    );
    const state = createPanelSectionsState(initialSections);

    const rootSectionIds = new Set([
      WORKBENCH_LEFT_PANEL_SECTION_ID,
      WORKBENCH_RIGHT_PANEL_SECTION_ID,
    ]);
    const panelsInSatelliteSections = new Set<string>();
    for (const [sectionId, section] of Object.entries(state.sections)) {
      if (!rootSectionIds.has(sectionId)) {
        for (const panel of section.panels) {
          panelsInSatelliteSections.add(panel.id);
        }
      }
    }

    expect(panelsInSatelliteSections.size).toBe(0);

    // Rebuild should produce identical panels with no filtering needed
    const rebuiltSections = buildWorkbenchPanelSections(
      panels, activities, "files", null, "files", null,
    );
    const rebuiltRight = rebuiltSections.find(
      (s) => s.id === WORKBENCH_RIGHT_PANEL_SECTION_ID,
    )!;
    expect(rebuiltRight.panels.map((p) => p.id)).toEqual(["outline", "ai-chat", "backlinks"]);
  });
});
