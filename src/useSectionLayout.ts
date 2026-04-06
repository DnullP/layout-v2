/**
 * @module host/layout-v2/useSectionLayout
 * @description section 布局树的 React hook 封装。
 *   该 hook 负责将纯函数布局模型接入 React，
 *   并统一提供切割、调比、更新、重置等操作。
 * @dependencies
 *   - react
 *   - ./layoutModel
 *
 * @example
 *   const layout = useSectionLayout({
 *     initialRoot: createRootSection({
 *       id: "root",
 *       title: "Root",
 *       data: { kind: "empty" },
 *     }),
 *   });
 *   layout.splitSection("root", "horizontal", { first: ..., second: ... });
 *
 * @exports
 *   - UseSectionLayoutOptions   hook 初始化参数
 *   - SectionLayoutController   React 侧布局控制器
 *   - useSectionLayout          section 布局 hook
 */

import { useEffect, useReducer } from "react";
import {
  collectLeafSections,
  destroySectionTree,
  findSectionNode,
  resizeSectionSplit,
  splitSectionTree,
  summarizeSectionTree,
  updateSectionTree,
  type SectionNode,
  type SectionSplitDirection,
  type SplitSectionOptions,
} from "./layoutModel";

/**
 * @interface UseSectionLayoutOptions
 * @description useSectionLayout 的初始化参数。
 * @template T section 承载的数据类型。
 * @field initialRoot - 初始布局树根节点。
 */
export interface UseSectionLayoutOptions<T> {
  /** 初始布局树根节点。 */
  initialRoot: SectionNode<T>;
}

/**
 * @interface SectionLayoutController
 * @description React 侧布局控制器。
 * @template T section 承载的数据类型。
 * @field root         - 当前布局树根节点。
 * @field leafSections - 当前所有叶子 section。
 * @field getSection   - 查询指定 section。
 * @field splitSection - 切割指定 section。
 * @field destroySection - 销毁指定 section，并将 sibling 提升回父 section。
 * @field resizeSection - 调整指定父 section 的子区域比例。
 * @field updateSection - 更新指定 section。
 * @field resetLayout  - 重置整个布局树。
 */
export interface SectionLayoutController<T> {
  /** 当前布局树根节点。 */
  root: SectionNode<T>;
  /** 当前所有叶子 section。 */
  leafSections: SectionNode<T>[];
  /** 查询指定 section。 */
  getSection: (sectionId: string) => SectionNode<T> | null;
  /** 切割指定 section。 */
  splitSection: (
    sectionId: string,
    direction: SectionSplitDirection,
    options: SplitSectionOptions<T>,
  ) => void;
  /** 销毁指定 section。 */
  destroySection: (sectionId: string) => void;
  /** 调整指定父 section 的子区域比例。 */
  resizeSection: (sectionId: string, ratio: number) => void;
  /** 更新指定 section。 */
  updateSection: (
    sectionId: string,
    updater: (section: SectionNode<T>) => SectionNode<T>,
  ) => void;
  /** 重置整个布局树。 */
  resetLayout: (nextRoot: SectionNode<T>) => void;
}

/**
 * @type SectionLayoutAction
 * @description section 布局 reducer 的内部 action。
 * @template T section 承载的数据类型。
 */
type SectionLayoutAction<T> =
  | {
      type: "split";
      sectionId: string;
      direction: SectionSplitDirection;
      options: SplitSectionOptions<T>;
    }
  | {
      type: "resize";
      sectionId: string;
      ratio: number;
    }
  | {
      type: "destroy";
      sectionId: string;
    }
  | {
      type: "update";
      sectionId: string;
      updater: (section: SectionNode<T>) => SectionNode<T>;
    }
  | {
      type: "reset";
      nextRoot: SectionNode<T>;
    };

/**
 * @function sectionLayoutReducer
 * @description section 布局 reducer。
 * @param state 当前布局树。
 * @param action 更新动作。
 * @returns 更新后的布局树。
 */
function sectionLayoutReducer<T>(
  state: SectionNode<T>,
  action: SectionLayoutAction<T>,
): SectionNode<T> {
  if (action.type === "split") {
    return splitSectionTree(state, action.sectionId, action.direction, action.options);
  }

  if (action.type === "resize") {
    return resizeSectionSplit(state, action.sectionId, action.ratio);
  }

  if (action.type === "destroy") {
    return destroySectionTree(state, action.sectionId);
  }

  if (action.type === "update") {
    return updateSectionTree(state, action.sectionId, action.updater);
  }

  return action.nextRoot;
}

/**
 * @function useSectionLayout
 * @description 将 section 布局模型接入 React 生命周期。
 * @param options hook 初始化参数。
 * @returns 布局控制器。
 */
export function useSectionLayout<T>(
  options: UseSectionLayoutOptions<T>,
): SectionLayoutController<T> {
  const [root, dispatch] = useReducer(sectionLayoutReducer<T>, options.initialRoot);

  useEffect(() => {
    console.info("[layout-v2] section layout initialized", summarizeSectionTree(options.initialRoot));
  }, [options.initialRoot]);

  useEffect(() => {
    console.info("[layout-v2] section layout updated", summarizeSectionTree(root));
  }, [root]);

  const leafSections = collectLeafSections(root);

  return {
    root,
    leafSections,
    getSection: (sectionId: string) => findSectionNode(root, sectionId),
    splitSection: (sectionId, direction, splitOptions) => {
      console.info("[layout-v2] split section requested", {
        sectionId,
        direction,
      });
      dispatch({
        type: "split",
        sectionId,
        direction,
        options: splitOptions,
      });
    },
    destroySection: (sectionId) => {
      console.info("[layout-v2] destroy section requested", {
        sectionId,
      });
      dispatch({
        type: "destroy",
        sectionId,
      });
    },
    resizeSection: (sectionId, ratio) => {
      console.debug("[layout-v2] resize section requested", {
        sectionId,
        ratio,
      });
      dispatch({
        type: "resize",
        sectionId,
        ratio,
      });
    },
    updateSection: (sectionId, updater) => {
      console.info("[layout-v2] update section requested", {
        sectionId,
      });
      dispatch({
        type: "update",
        sectionId,
        updater,
      });
    },
    resetLayout: (nextRoot) => {
      console.info("[layout-v2] reset layout requested", summarizeSectionTree(nextRoot));
      dispatch({
        type: "reset",
        nextRoot,
      });
    },
  };
}