/**
 * @module host/layout-v2/layoutModel
 * @description section 布局树的数据模型与纯函数操作集合。
 *   该模块只处理 section 树的创建、切割、更新与比例调整，
 *   不依赖 React，可直接用于状态管理、序列化与测试。
 * @dependencies
 *   - none
 *
 * @example
 *   let root = createRootSection({
 *     id: "root",
 *     title: "Root",
 *     data: { tone: "neutral" },
 *   });
 *   root = splitSectionTree(root, "root", "horizontal", {
 *     first: { id: "left", title: "Left", data: { tone: "calm" } },
 *     second: { id: "right", title: "Right", data: { tone: "warm" } },
 *   });
 *   root = resizeSectionSplit(root, "root", 0.35);
 *
 * @exports
 *   - SectionEdge             section 边缘方向
 *   - SectionResizableEdges   section 边缘拖拽配置
 *   - SectionSplitDirection   切割方向：左右或上下
 *   - SectionNode             section 节点结构
 *   - SectionSplitState       section 的子分割状态
 *   - createRootSection       创建根 section
 *   - splitSectionTree        对指定 section 执行切割
 *   - destroySectionTree      销毁指定 section 并将 sibling 提升回父 section
 *   - resizeSectionSplit      调整切割比例
 *   - updateSectionTree       更新指定 section 数据
 *   - findSectionNode         查找指定 section
 *   - isSectionEdgeDraggable  判断 section 某条边是否可拖动
 *   - canResizeSectionSplit   判断当前父 section 的分隔条是否允许拖拽
 *   - collectLeafSections     收集所有叶子 section
 *   - describeSectionPath     获取 section 在树中的路径
 */

/**
 * @constant MIN_SPLIT_RATIO
 * @description 默认最小切割比例，避免任一子区域被压缩到不可见。
 */
export const MIN_SPLIT_RATIO = 0.15;

/**
 * @type SectionEdge
 * @description section 的四条边方向。
 */
export type SectionEdge = "top" | "right" | "bottom" | "left";

/**
 * @interface SectionResizableEdges
 * @description section 各边是否允许参与拖拽调节。
 *   当某条边为 false 时，与该边相邻的分隔条不能被用户拖拽。
 * @field top    - 上边是否可拖动。
 * @field right  - 右边是否可拖动。
 * @field bottom - 下边是否可拖动。
 * @field left   - 左边是否可拖动。
 */
export interface SectionResizableEdges {
  /** 上边是否可拖动。 */
  top: boolean;
  /** 右边是否可拖动。 */
  right: boolean;
  /** 下边是否可拖动。 */
  bottom: boolean;
  /** 左边是否可拖动。 */
  left: boolean;
}

/**
 * @type SectionSplitDirection
 * @description section 切割方向。
 *   horizontal 表示左右分割；vertical 表示上下分割。
 */
export type SectionSplitDirection = "horizontal" | "vertical";

/**
 * @interface SectionDraft
 * @description 新建 section 时使用的草稿信息。
 * @template T section 承载的数据类型。
 * @field id    - section 唯一标识。
 * @field title - section 标题。
 * @field data  - section 业务数据。
 * @field resizableEdges - section 各边是否允许拖拽调节。
 */
export interface SectionDraft<T> {
  /** section 唯一标识。 */
  id?: string;
  /** section 标题。 */
  title?: string;
  /** section 业务数据。 */
  data: T;
  /** section 各边是否允许拖拽调节。 */
  resizableEdges?: Partial<SectionResizableEdges>;
}

/**
 * @interface SectionSplitState
 * @description section 的子分割状态。
 * @template T section 承载的数据类型。
 * @field direction - 切割方向。
 * @field ratio     - 第一个子区域占父区域的比例。
 * @field children  - 两个子 section，仍归属于父 section。
 */
export interface SectionSplitState<T> {
  /** 切割方向。 */
  direction: SectionSplitDirection;
  /** 第一个子区域占父区域的比例。 */
  ratio: number;
  /** 两个子 section，仍归属于父 section。 */
  children: [SectionNode<T>, SectionNode<T>];
}

/**
 * @interface SectionNode
 * @description section 布局树节点。
 *   当 split 为 null 时表示叶子区域；
 *   当 split 非 null 时表示该区域仍保留为父节点，并拥有两个子 section。
 * @template T section 承载的数据类型。
 * @field id    - section 唯一标识。
 * @field title - section 标题。
 * @field data  - section 业务数据。
 * @field resizableEdges - section 各边是否允许拖拽调节。
 * @field split - section 的子分割状态。
 */
export interface SectionNode<T> {
  /** section 唯一标识。 */
  id: string;
  /** section 标题。 */
  title: string;
  /** section 业务数据。 */
  data: T;
  /** section 各边是否允许拖拽调节。 */
  resizableEdges: SectionResizableEdges;
  /** section 的子分割状态。 */
  split: SectionSplitState<T> | null;
}

/**
 * @interface SplitSectionOptions
 * @description section 切割时的附加参数。
 * @template T section 承载的数据类型。
 * @field first  - 第一个子区域草稿。
 * @field second - 第二个子区域草稿。
 * @field ratio  - 初始切割比例。
 */
export interface SplitSectionOptions<T> {
  /** 第一个子区域草稿。 */
  first?: SectionDraft<T>;
  /** 第二个子区域草稿。 */
  second?: SectionDraft<T>;
  /** 初始切割比例。 */
  ratio?: number;
}

let sectionSequence = 0;

/**
 * @function createSectionId
 * @description 生成默认 section 标识。
 * @returns 自增的 section 标识。
 */
function createSectionId(): string {
  sectionSequence += 1;
  return `section-${sectionSequence}`;
}

/**
 * @function createSectionResizableEdges
 * @description 生成带默认值的 section 边缘拖拽配置。
 * @param partialEdges 用户传入的局部边缘配置。
 * @returns 补齐默认值后的边缘拖拽配置。
 */
function createSectionResizableEdges(
  partialEdges?: Partial<SectionResizableEdges>,
): SectionResizableEdges {
  return {
    top: partialEdges?.top ?? true,
    right: partialEdges?.right ?? true,
    bottom: partialEdges?.bottom ?? true,
    left: partialEdges?.left ?? true,
  };
}

/**
 * @function normalizeInitialSplitRatio
 * @description 约束初始切割比例。
 *   初始布局允许使用更小的比例创建窄区域，
 *   与拖拽阶段的最小比例限制分开处理。
 * @param ratio 初始切割比例。
 * @returns 约束后的初始切割比例。
 */
function normalizeInitialSplitRatio(ratio: number): number {
  return Math.min(0.99, Math.max(0.01, ratio));
}

/**
 * @function clampSplitRatio
 * @description 将切割比例约束到可用范围内。
 * @param ratio 待约束的比例。
 * @param minRatio 最小比例限制。
 * @returns 约束后的比例。
 */
export function clampSplitRatio(ratio: number, minRatio = MIN_SPLIT_RATIO): number {
  const safeMinRatio = Math.max(0.01, Math.min(minRatio, 0.49));
  return Math.min(1 - safeMinRatio, Math.max(safeMinRatio, ratio));
}

/**
 * @function createSectionNode
 * @description 根据草稿创建单个 section 节点。
 * @param draft section 草稿信息。
 * @returns 初始化后的 section 节点。
 */
export function createSectionNode<T>(draft: SectionDraft<T>): SectionNode<T> {
  return {
    id: draft.id ?? createSectionId(),
    title: draft.title ?? "Untitled Section",
    data: draft.data,
    resizableEdges: createSectionResizableEdges(draft.resizableEdges),
    split: null,
  };
}

/**
 * @function createRootSection
 * @description 创建一个占满整个布局的根 section。
 * @param draft 根 section 草稿信息。
 * @returns 根 section 节点。
 */
export function createRootSection<T>(draft: SectionDraft<T>): SectionNode<T> {
  return createSectionNode(draft);
}

/**
 * @function mapSectionTree
 * @description 递归更新 section 树中的指定节点。
 * @param node 当前节点。
 * @param targetId 目标 section 标识。
 * @param updater 命中目标节点后的更新函数。
 * @returns 更新后的节点与是否命中目标节点。
 */
function mapSectionTree<T>(
  node: SectionNode<T>,
  targetId: string,
  updater: (target: SectionNode<T>) => SectionNode<T>,
): { nextNode: SectionNode<T>; matched: boolean } {
  if (node.id === targetId) {
    return {
      nextNode: updater(node),
      matched: true,
    };
  }

  if (!node.split) {
    return {
      nextNode: node,
      matched: false,
    };
  }

  const firstResult = mapSectionTree(node.split.children[0], targetId, updater);
  const secondResult = mapSectionTree(node.split.children[1], targetId, updater);

  if (!firstResult.matched && !secondResult.matched) {
    return {
      nextNode: node,
      matched: false,
    };
  }

  return {
    nextNode: {
      ...node,
      split: {
        ...node.split,
        children: [firstResult.nextNode, secondResult.nextNode],
      },
    },
    matched: true,
  };
}

/**
 * @function findSectionNode
 * @description 在 section 树中查找指定节点。
 * @param node 根节点。
 * @param sectionId 目标 section 标识。
 * @returns 命中的 section；未命中时返回 null。
 */
export function findSectionNode<T>(
  node: SectionNode<T>,
  sectionId: string,
): SectionNode<T> | null {
  if (node.id === sectionId) {
    return node;
  }

  if (!node.split) {
    return null;
  }

  return (
    findSectionNode(node.split.children[0], sectionId) ??
    findSectionNode(node.split.children[1], sectionId)
  );
}

/**
 * @function isSectionEdgeDraggable
 * @description 判断 section 某条边是否允许被用户拖拽。
 * @param section section 节点。
 * @param edge 边方向。
 * @returns 可拖动返回 true。
 */
export function isSectionEdgeDraggable<T>(
  section: SectionNode<T>,
  edge: SectionEdge,
): boolean {
  return section.resizableEdges[edge];
}

/**
 * @function canResizeSectionSplit
 * @description 判断当前父 section 的分隔条是否允许拖拽。
 *   只要分隔条两侧任一 section 对应边设置为不可拖动，
 *   则该分隔条视为锁定状态。
 * @param section 父 section 节点。
 * @returns 分隔条允许拖拽返回 true。
 */
export function canResizeSectionSplit<T>(section: SectionNode<T>): boolean {
  if (!section.split) {
    return false;
  }

  const [firstChild, secondChild] = section.split.children;
  if (section.split.direction === "horizontal") {
    return firstChild.resizableEdges.right && secondChild.resizableEdges.left;
  }

  return firstChild.resizableEdges.bottom && secondChild.resizableEdges.top;
}

/**
 * @function splitSectionTree
 * @description 对指定 section 执行一次二叉切割。
 * @param root 当前布局树根节点。
 * @param sectionId 需要切割的 section 标识。
 * @param direction 切割方向。
 * @param options 子区域草稿与初始比例。
 * @returns 切割后的新布局树。
 * @throws 当目标 section 不存在或已被切割时抛出异常。
 */
export function splitSectionTree<T>(
  root: SectionNode<T>,
  sectionId: string,
  direction: SectionSplitDirection,
  options: SplitSectionOptions<T>,
): SectionNode<T> {
  const target = findSectionNode(root, sectionId);

  if (!target) {
    throw new Error(`[layout-v2] section not found: ${sectionId}`);
  }

  if (target.split) {
    throw new Error(`[layout-v2] section already split: ${sectionId}`);
  }

  if (!options.first || !options.second) {
    throw new Error(`[layout-v2] split requires two child drafts: ${sectionId}`);
  }

  const ratio = normalizeInitialSplitRatio(options.ratio ?? 0.5);
  const result = mapSectionTree(root, sectionId, (node) => ({
    ...node,
    split: {
      direction,
      ratio,
      children: [
        createSectionNode(options.first as SectionDraft<T>),
        createSectionNode(options.second as SectionDraft<T>),
      ],
    },
  }));

  return result.nextNode;
}

/**
 * @function destroySectionTree
 * @description 销毁指定的非根 section，并将其 sibling 的内容提升回父 section。
 *   section 分裂后，两个子 section 的总占位等于父 section。
 *   当其中一个子 section 被销毁时，父 section 会取消 split，
 *   并继承另一个子 section 的标题、数据、边缘配置和子树结构。
 * @param root 当前布局树根节点。
 * @param sectionId 待销毁的 section 标识。
 * @returns 销毁后的布局树。
 * @throws 当目标 section 不存在，或目标是根 section 时抛出异常。
 */
export function destroySectionTree<T>(
  root: SectionNode<T>,
  sectionId: string,
): SectionNode<T> {
  if (root.id === sectionId) {
    throw new Error(`[layout-v2] root section cannot be destroyed: ${sectionId}`);
  }

  const visit = (
    node: SectionNode<T>,
  ): { nextNode: SectionNode<T>; matched: boolean } => {
    if (!node.split) {
      return {
        nextNode: node,
        matched: false,
      };
    }

    const [firstChild, secondChild] = node.split.children;

    if (firstChild.id === sectionId || secondChild.id === sectionId) {
      const survivor = firstChild.id === sectionId ? secondChild : firstChild;

      return {
        nextNode: {
          ...node,
          title: survivor.title,
          data: survivor.data,
          resizableEdges: survivor.resizableEdges,
          split: survivor.split,
        },
        matched: true,
      };
    }

    const firstResult = visit(firstChild);
    if (firstResult.matched) {
      return {
        nextNode: {
          ...node,
          split: {
            ...node.split,
            children: [firstResult.nextNode, secondChild],
          },
        },
        matched: true,
      };
    }

    const secondResult = visit(secondChild);
    if (secondResult.matched) {
      return {
        nextNode: {
          ...node,
          split: {
            ...node.split,
            children: [firstChild, secondResult.nextNode],
          },
        },
        matched: true,
      };
    }

    return {
      nextNode: node,
      matched: false,
    };
  };

  const result = visit(root);
  if (!result.matched) {
    throw new Error(`[layout-v2] section not found: ${sectionId}`);
  }

  return result.nextNode;
}

/**
 * @function resizeSectionSplit
 * @description 调整指定 section 的子区域占比。
 * @param root 当前布局树根节点。
 * @param sectionId 目标父 section 标识。
 * @param ratio 新的第一子区域占比。
 * @param minRatio 最小比例限制。
 * @returns 更新后的布局树。
 * @throws 当目标 section 不存在或不是已切割节点时抛出异常。
 */
export function resizeSectionSplit<T>(
  root: SectionNode<T>,
  sectionId: string,
  ratio: number,
  minRatio = MIN_SPLIT_RATIO,
): SectionNode<T> {
  const target = findSectionNode(root, sectionId);

  if (!target) {
    throw new Error(`[layout-v2] section not found: ${sectionId}`);
  }

  if (!target.split) {
    throw new Error(`[layout-v2] section is not split: ${sectionId}`);
  }

  const nextRatio = clampSplitRatio(ratio, minRatio);
  const result = mapSectionTree(root, sectionId, (node) => ({
    ...node,
    split: node.split
      ? {
          ...node.split,
          ratio: nextRatio,
        }
      : null,
  }));

  return result.nextNode;
}

/**
 * @function updateSectionTree
 * @description 更新指定 section 的标题或业务数据。
 * @param root 当前布局树根节点。
 * @param sectionId 目标 section 标识。
 * @param updater 基于旧 section 生成新 section 的更新函数。
 * @returns 更新后的布局树。
 * @throws 当目标 section 不存在时抛出异常。
 */
export function updateSectionTree<T>(
  root: SectionNode<T>,
  sectionId: string,
  updater: (section: SectionNode<T>) => SectionNode<T>,
): SectionNode<T> {
  const result = mapSectionTree(root, sectionId, updater);

  if (!result.matched) {
    throw new Error(`[layout-v2] section not found: ${sectionId}`);
  }

  return result.nextNode;
}

/**
 * @function collectLeafSections
 * @description 收集当前布局树中的所有叶子 section。
 * @param node 根节点。
 * @returns 叶子 section 数组。
 */
export function collectLeafSections<T>(node: SectionNode<T>): SectionNode<T>[] {
  if (!node.split) {
    return [node];
  }

  return [
    ...collectLeafSections(node.split.children[0]),
    ...collectLeafSections(node.split.children[1]),
  ];
}

/**
 * @function describeSectionPath
 * @description 获取目标 section 自根到当前节点的路径。
 * @param node 根节点。
 * @param sectionId 目标 section 标识。
 * @returns section 路径；未命中时返回空数组。
 */
export function describeSectionPath<T>(
  node: SectionNode<T>,
  sectionId: string,
): SectionNode<T>[] {
  if (node.id === sectionId) {
    return [node];
  }

  if (!node.split) {
    return [];
  }

  const firstPath = describeSectionPath(node.split.children[0], sectionId);
  if (firstPath.length > 0) {
    return [node, ...firstPath];
  }

  const secondPath = describeSectionPath(node.split.children[1], sectionId);
  if (secondPath.length > 0) {
    return [node, ...secondPath];
  }

  return [];
}

/**
 * @function summarizeSectionTree
 * @description 生成布局树的摘要信息，便于日志记录。
 * @param root 根节点。
 * @returns 摘要对象。
 */
export function summarizeSectionTree<T>(root: SectionNode<T>): {
  totalSections: number;
  leafSections: number;
} {
  const leafSections = collectLeafSections(root).length;
  const path = [root];
  let totalSections = 0;

  while (path.length > 0) {
    const current = path.pop();
    if (!current) {
      continue;
    }

    totalSections += 1;
    if (current.split) {
      path.push(current.split.children[0], current.split.children[1]);
    }
  }

  return {
    totalSections,
    leafSections,
  };
}

/**
 * @function resetSectionSequenceForTest
 * @description 仅供测试重置默认 section 标识序列。
 */
export function resetSectionSequenceForTest(): void {
  sectionSequence = 0;
}