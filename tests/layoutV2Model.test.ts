/**
 * @module tests/layoutV2Model.test
 * @description layout-v2 纯模型测试：验证 section 根节点创建、切割保留父节点、比例调整会被约束。
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  canResizeSectionSplit,
  createRootSection,
  destroySectionTree,
  findSectionNode,
  isSectionEdgeDraggable,
  resizeSectionSplit,
  resetSectionSequenceForTest,
  splitSectionTree,
} from "../src";
import { createSectionTreeExample } from "../example/usage/sectionTreeExample";

afterEach(() => {
  resetSectionSequenceForTest();
});

describe("layout-v2 layout model", () => {
  test("默认可创建一个占满布局的根 section", () => {
    const root = createRootSection({
      id: "root",
      title: "Root",
      data: { kind: "root" },
    });

    expect(root.id).toBe("root");
    expect(root.split).toBeNull();
    expect(isSectionEdgeDraggable(root, "left")).toBe(true);
    expect(isSectionEdgeDraggable(root, "right")).toBe(true);
  });

  test("切割时允许使用较小初始比例创建窄区域", () => {
    const root = splitSectionTree(
      createRootSection({
        id: "root",
        title: "Root",
        data: { kind: "root" },
      }),
      "root",
      "horizontal",
      {
        ratio: 0.05,
        first: {
          id: "activity-bar",
          title: "Activity Bar",
          data: { kind: "activity-bar" },
        },
        second: {
          id: "rest",
          title: "Rest",
          data: { kind: "rest" },
        },
      },
    );

    expect(root.split?.ratio).toBe(0.05);
  });

  test("切割 section 时父 section 仍然存在并持有子节点", () => {
    const root = splitSectionTree(
      createRootSection({
        id: "root",
        title: "Root",
        data: { kind: "root" },
      }),
      "root",
      "horizontal",
      {
        first: {
          id: "left",
          title: "Left",
          data: { kind: "left" },
        },
        second: {
          id: "right",
          title: "Right",
          data: { kind: "right" },
        },
      },
    );

    expect(root.id).toBe("root");
    expect(root.split?.children[0].id).toBe("left");
    expect(root.split?.children[1].id).toBe("right");
    expect(findSectionNode(root, "root")?.split).not.toBeNull();
  });

  test("调整切割比例时会被最小比例约束", () => {
    const root = splitSectionTree(
      createRootSection({
        id: "root",
        title: "Root",
        data: { kind: "root" },
      }),
      "root",
      "vertical",
      {
        first: {
          id: "top",
          title: "Top",
          data: { kind: "top" },
        },
        second: {
          id: "bottom",
          title: "Bottom",
          data: { kind: "bottom" },
        },
      },
    );

    const resized = resizeSectionSplit(root, "root", 0.01);

    expect(resized.split?.ratio).toBeGreaterThanOrEqual(0.15);
    expect(resized.split?.ratio).toBeLessThanOrEqual(0.85);
  });

  test("当相邻 section 边缘被锁定时分隔条不可拖拽", () => {
    const root = splitSectionTree(
      createRootSection({
        id: "root",
        title: "Root",
        data: { kind: "root" },
      }),
      "root",
      "horizontal",
      {
        first: {
          id: "fixed",
          title: "Fixed",
          data: { kind: "fixed" },
          resizableEdges: {
            right: false,
          },
        },
        second: {
          id: "main",
          title: "Main",
          data: { kind: "main" },
        },
      },
    );

    expect(canResizeSectionSplit(root)).toBe(false);
    expect(isSectionEdgeDraggable(root.split!.children[0], "right")).toBe(false);
  });

  test("示例布局中的 activity bar 分隔条默认应锁定", () => {
    const root = createSectionTreeExample();

    expect(root.split).not.toBeNull();
    expect(root.split?.children[0].id).toBe("activity-bar");
    expect(canResizeSectionSplit(root)).toBe(false);
    expect(isSectionEdgeDraggable(root.split!.children[0], "right")).toBe(false);
  });

  test("销毁一个子 section 时应将 sibling 内容提升回父 section", () => {
    const root = splitSectionTree(
      createRootSection({
        id: "root",
        title: "Root",
        data: { kind: "root" },
      }),
      "root",
      "horizontal",
      {
        first: {
          id: "left",
          title: "Left",
          data: { kind: "left" },
        },
        second: {
          id: "right",
          title: "Right",
          data: { kind: "right" },
          resizableEdges: {
            left: false,
          },
        },
      },
    );

    const collapsed = destroySectionTree(root, "left");

    expect(collapsed.id).toBe("root");
    expect(collapsed.split).toBeNull();
    expect(collapsed.title).toBe("Right");
    expect(collapsed.data).toEqual({ kind: "right" });
    expect(collapsed.resizableEdges.left).toBe(false);
    expect(findSectionNode(collapsed, "left")).toBeNull();
  });

  test("销毁一个子 section 时应保留 survivor 的子树结构", () => {
    let root = createRootSection({
      id: "root",
      title: "Root",
      data: { kind: "root" },
    });

    root = splitSectionTree(root, "root", "horizontal", {
      first: {
        id: "left",
        title: "Left",
        data: { kind: "left" },
      },
      second: {
        id: "right",
        title: "Right",
        data: { kind: "right" },
      },
    });

    root = splitSectionTree(root, "right", "vertical", {
      first: {
        id: "top-right",
        title: "Top Right",
        data: { kind: "top-right" },
      },
      second: {
        id: "bottom-right",
        title: "Bottom Right",
        data: { kind: "bottom-right" },
      },
    });

    const collapsed = destroySectionTree(root, "left");

    expect(collapsed.id).toBe("root");
    expect(collapsed.title).toBe("Right");
    expect(collapsed.split?.direction).toBe("vertical");
    expect(collapsed.split?.children[0].id).toBe("top-right");
    expect(collapsed.split?.children[1].id).toBe("bottom-right");
  });

  test("不允许销毁根 section", () => {
    const root = createRootSection({
      id: "root",
      title: "Root",
      data: { kind: "root" },
    });

    expect(() => destroySectionTree(root, "root")).toThrow(
      "[layout-v2] root section cannot be destroyed: root",
    );
  });
});