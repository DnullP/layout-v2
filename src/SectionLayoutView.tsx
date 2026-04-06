/**
 * @module host/layout-v2/SectionLayoutView
 * @description section 布局树的递归 React 渲染器。
 *   该组件将二叉 section 树渲染为可拖拽调比的布局容器，
 *   并通过 renderSection 将具体内容交给业务侧自定义。
 * @dependencies
 *   - react
 *   - ./layoutModel
 *   - ./layoutV2.css
 *
 * @example
 *   <SectionLayoutView
 *     root={layout.root}
 *     onResizeSection={layout.resizeSection}
 *     renderSection={(section) => <div>{section.title}</div>}
 *   />
 *
 * @exports
 *   - SectionLayoutViewProps   组件属性
 *   - SectionLayoutView        section 布局渲染器
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  canResizeSectionSplit,
  type SectionNode,
  type SectionSplitDirection,
} from "./layoutModel";
import "./layoutV2.css";

/**
 * @interface SectionLayoutViewProps
 * @description SectionLayoutView 组件属性。
 * @template T section 承载的数据类型。
 * @field root            - 布局树根节点。
 * @field renderSection   - 叶子 section 的渲染函数。
 * @field onResizeSection - 当拖拽分隔条时的比例更新回调。
 * @field minSectionSize  - 拖拽时单个 section 的最小像素尺寸。
 * @field className       - 外部附加类名。
 */
export interface SectionLayoutViewProps<T> {
  /** 布局树根节点。 */
  root: SectionNode<T>;
  /** 用于检测真实 split 变更的布局树。默认与 root 相同。 */
  animationRoot?: SectionNode<T>;
  /** 叶子 section 的渲染函数。 */
  renderSection: (section: SectionNode<T>) => ReactNode;
  /** 当拖拽分隔条时的比例更新回调。 */
  onResizeSection: (sectionId: string, ratio: number) => void;
  /** 拖拽时单个 section 的最小像素尺寸。 */
  minSectionSize?: number;
  /** 外部附加类名。 */
  className?: string;
}

/**
 * @interface SectionNodeViewProps
 * @description 递归 section 节点视图属性。
 * @template T section 承载的数据类型。
 * @field node            - 当前节点。
 * @field renderSection   - 叶子 section 渲染函数。
 * @field onResizeSection - 比例更新回调。
 * @field minSectionSize  - 单个 section 最小像素尺寸。
 */
interface SectionNodeViewProps<T> {
  /** 当前节点。 */
  node: SectionNode<T>;
  /** 叶子 section 渲染函数。 */
  renderSection: (section: SectionNode<T>) => ReactNode;
  /** 比例更新回调。 */
  onResizeSection: (sectionId: string, ratio: number) => void;
  /** 单个 section 最小像素尺寸。 */
  minSectionSize: number;
  /** 当前处于入场动画中的 split 节点表。 */
  splitAnimations: Record<string, SplitAnimationDescriptor>;
  /** split 动画完成回调。 */
  onSplitAnimationComplete: (sectionId: string, token: number) => void;
}

/**
 * @interface SplitAnimationDescriptor
 * @description 新发生 split 的 section 动画描述。
 * @field token         - 动画实例 token，用于驱动一次性动画。
 * @field direction     - split 方向。
 * @field ratio         - 目标比例。
 * @field newChildIndex - 新 section 在 children 中的位置。
 */
interface SplitAnimationDescriptor {
  /** 动画实例 token。 */
  token: number;
  /** 当前 split 动画签名。 */
  signature: string;
  /** split 方向。 */
  direction: SectionSplitDirection;
  /** 目标比例。 */
  ratio: number;
  /** 新 section 在 children 中的位置。 */
  newChildIndex: 0 | 1;
}

/**
 * @interface SplitAnimationSnapshot
 * @description 当前 split 节点的稳定签名快照。
 * @field signature     - split 动画签名。
 * @field direction     - split 方向。
 * @field newChildIndex - 新 section 在 children 中的位置。
 */
interface SplitAnimationSnapshot {
  /** split 动画签名。 */
  signature: string;
  /** split 方向。 */
  direction: SectionSplitDirection;
  /** 新 section 在 children 中的位置。 */
  newChildIndex: 0 | 1;
}

/**
 * @constant SPLIT_ANIMATION_DURATION_MS
 * @description section split 入场动画时长。
 */
const SPLIT_ANIMATION_DURATION_MS = 240;

/**
 * @interface SplitDividerProps
 * @description 分隔条组件属性。
 * @field direction       - 当前切割方向。
 * @field ratio           - 当前比例。
 * @field minSectionSize  - 单个 section 最小像素尺寸。
 * @field onResize        - 比例更新回调。
 */
interface SplitDividerProps {
  /** 当前切割方向。 */
  direction: SectionSplitDirection;
  /** 当前比例。 */
  ratio: number;
  /** 单个 section 最小像素尺寸。 */
  minSectionSize: number;
  /** 比例更新回调。 */
  onResize: (ratio: number) => void;
  /** 当前分隔条是否允许拖拽。 */
  disabled?: boolean;
}

/**
 * @function clampRatioByContainer
 * @description 基于容器尺寸和最小像素尺寸计算拖拽后的安全比例。
 * @param nextRatio 候选比例。
 * @param totalSize 当前父容器沿分割轴的总尺寸。
 * @param minSectionSize 单个 section 最小像素尺寸。
 * @returns 约束后的比例。
 */
function clampRatioByContainer(
  nextRatio: number,
  totalSize: number,
  minSectionSize: number,
): number {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return 0.5;
  }

  const minRatio = Math.min(0.45, minSectionSize / totalSize);
  return Math.min(1 - minRatio, Math.max(minRatio, nextRatio));
}

/**
 * @function buildChildStyle
 * @description 根据比例生成子 section 容器样式。
 * @param ratio 当前比例。
 * @param isPrimary 是否为第一个子区域。
 * @returns 对应的 flex 样式。
 */
function buildChildStyle(ratio: number, isPrimary: boolean): CSSProperties {
  return {
    flex: isPrimary ? ratio : 1 - ratio,
  };
}

/**
 * @function findSectionNodeById
 * @description 在布局树中按 id 查找节点。
 * @param node 当前节点。
 * @param targetId 目标节点 id。
 * @returns 命中的节点；未命中时返回 null。
 */
function findSectionNodeById<T>(
  node: SectionNode<T>,
  targetId: string,
): SectionNode<T> | null {
  if (node.id === targetId) {
    return node;
  }

  if (!node.split) {
    return null;
  }

  return (
    findSectionNodeById(node.split.children[0], targetId) ??
    findSectionNodeById(node.split.children[1], targetId)
  );
}

/**
 * @function resolveNewChildIndex
 * @description 通过当前 parent 与 child 的数据引用关系推断新 child 的位置。
 * @param node 当前 split parent。
 * @returns 新 child 索引；无法识别时返回 null。
 */
function resolveNewChildIndex<T>(
  node: SectionNode<T>,
): 0 | 1 | null {
  if (!node.split) {
    return null;
  }

  const firstMatchesParent = Object.is(node.split.children[0].data, node.data);
  const secondMatchesParent = Object.is(node.split.children[1].data, node.data);

  if (firstMatchesParent && !secondMatchesParent) {
    return 1;
  }

  if (secondMatchesParent && !firstMatchesParent) {
    return 0;
  }

  return null;
}

/**
 * @function buildSplitAnimationSignature
 * @description 基于方向和新 child 位置生成 split 动画签名。
 * @param direction split 方向。
 * @param newChildIndex 新 child 在 children 中的位置。
 * @returns split 动画签名。
 */
function buildSplitAnimationSignature(
  direction: SectionSplitDirection,
  newChildIndex: 0 | 1,
): string {
  return `${direction}:${newChildIndex}`;
}

/**
 * @function collectSplitAnimations
 * @description 比对前后布局树，收集新发生 split 的节点动画信息。
 * @param previousRoot 变更前布局树。
 * @param nextRoot 变更后布局树。
 * @param tokenBase 本轮动画 token 基数。
 * @returns 需要播放 split 动画的节点表。
 */
function collectSplitAnimations<T>(
  previousRoot: SectionNode<T>,
  nextRoot: SectionNode<T>,
  previousSnapshots: Record<string, SplitAnimationSnapshot>,
  tokenBase: number,
): {
  animations: Record<string, SplitAnimationDescriptor>;
  snapshots: Record<string, SplitAnimationSnapshot>;
} {
  const animations: Record<string, SplitAnimationDescriptor> = {};
  const snapshots: Record<string, SplitAnimationSnapshot> = {};
  let animationIndex = 0;
  const queue: SectionNode<T>[] = [nextRoot];

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      continue;
    }

    if (!currentNode.split) {
      continue;
    }

    const previousNode = findSectionNodeById(previousRoot, currentNode.id);
    const newChildIndex = resolveNewChildIndex(currentNode);
    if (newChildIndex !== null) {
      const signature = buildSplitAnimationSignature(
        currentNode.split.direction,
        newChildIndex,
      );
      snapshots[currentNode.id] = {
        signature,
        direction: currentNode.split.direction,
        newChildIndex,
      };

      const previousSignature = previousSnapshots[currentNode.id]?.signature ?? null;
      const shouldAnimate = Boolean(
        previousNode && (
          !previousNode.split ||
          previousSignature !== signature
        ),
      );

      if (shouldAnimate) {
        animations[currentNode.id] = {
          token: tokenBase + animationIndex,
          signature,
          direction: currentNode.split.direction,
          ratio: currentNode.split.ratio,
          newChildIndex,
        };
        animationIndex += 1;
      }
    }

    queue.push(currentNode.split.children[0], currentNode.split.children[1]);
  }

  return {
    animations,
    snapshots,
  };
}

/**
 * @function SplitDivider
 * @description 可拖拽的灰色分隔条。
 * @param props 分隔条组件属性。
 * @returns 分隔条 React 节点。
 */
function SplitDivider(props: SplitDividerProps): ReactNode {
  const { direction, ratio, minSectionSize, onResize, disabled = false } = props;
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      setIsDragging(false);
    };
  }, []);

  /**
   * @function handlePointerDown
   * @description 开始拖拽分隔条并监听全局 pointer 事件。
   * @param event React pointer down 事件。
   */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    const container = dividerRef.current?.parentElement;
    if (!container) {
      console.warn("[layout-v2] divider parent container is missing");
      return;
    }

    event.preventDefault();

    const startRect = container.getBoundingClientRect();
    const totalSize = direction === "horizontal" ? startRect.width : startRect.height;
    const startPointer = direction === "horizontal" ? event.clientX : event.clientY;
    const startRatio = ratio;

    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const nextPointer = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      const delta = nextPointer - startPointer;
      const nextRatio = clampRatioByContainer(
        (startRatio * totalSize + delta) / totalSize,
        totalSize,
        minSectionSize,
      );
      onResize(nextRatio);
    };

    const handlePointerUp = (): void => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  const dividerClassName = [
    "layout-v2__divider",
    direction === "horizontal"
      ? "layout-v2__divider--horizontal"
      : "layout-v2__divider--vertical",
    isDragging ? "layout-v2__divider--dragging" : "",
    disabled ? "layout-v2__divider--disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={dividerRef}
      className={dividerClassName}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-label="Resize sections"
      aria-disabled={disabled}
    >
      {/* 分隔条可视线：默认灰色，hover/drag 时高亮为蓝色并加粗。 */}
      <div className="layout-v2__divider-line" />
    </div>
  );
}

/**
 * @function SectionNodeView
 * @description 递归渲染 section 节点。
 * @param props 递归 section 节点视图属性。
 * @returns section 节点 React 视图。
 */
function SectionNodeView<T>(props: SectionNodeViewProps<T>): ReactNode {
  const {
    node,
    renderSection,
    onResizeSection,
    minSectionSize,
    splitAnimations,
    onSplitAnimationComplete,
  } = props;
  const splitAnimation = splitAnimations[node.id] ?? null;
  const [isSplitAnimationEntered, setIsSplitAnimationEntered] = useState(false);

  useLayoutEffect(() => {
    if (!splitAnimation) {
      setIsSplitAnimationEntered(false);
      return;
    }

    setIsSplitAnimationEntered(false);
    const frameId = window.requestAnimationFrame(() => {
      setIsSplitAnimationEntered(true);
    });
    const timeoutId = window.setTimeout(() => {
      onSplitAnimationComplete(node.id, splitAnimation.token);
    }, SPLIT_ANIMATION_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [node.id, onSplitAnimationComplete, splitAnimation?.token]);

  if (!node.split) {
    return (
      <div className="layout-v2__leaf-shell" data-section-id={node.id}>
        {/* 叶子 section 内容承载层：引擎本身不施加装饰，只负责承载业务内容。 */}
        <div className="layout-v2__leaf-content">{renderSection(node)}</div>
      </div>
    );
  }

  const [firstChild, secondChild] = node.split.children;
  const branchClassName = [
    "layout-v2__branch",
    node.split.direction === "horizontal"
      ? "layout-v2__branch--horizontal"
      : "layout-v2__branch--vertical",
  ].join(" ");
  const firstTargetRatio = node.split.ratio;
  const secondTargetRatio = 1 - node.split.ratio;
  const firstChildStyle = splitAnimation
    ? {
        flex: "0 0 auto",
        flexBasis: splitAnimation.newChildIndex === 0
          ? (isSplitAnimationEntered ? `${firstTargetRatio * 100}%` : "0%")
          : (isSplitAnimationEntered ? `${firstTargetRatio * 100}%` : "100%"),
      }
    : buildChildStyle(node.split.ratio, true);
  const secondChildStyle = splitAnimation
    ? {
        flex: "0 0 auto",
        flexBasis: splitAnimation.newChildIndex === 1
          ? (isSplitAnimationEntered ? `${secondTargetRatio * 100}%` : "0%")
          : (isSplitAnimationEntered ? `${secondTargetRatio * 100}%` : "100%"),
      }
    : buildChildStyle(node.split.ratio, false);

  return (
    <div className={branchClassName} data-section-id={node.id}>
      {/* 第一个子区域容器：通过 flex 比例占据父区域的一部分。 */}
      <div
        className={[
          "layout-v2__child-slot",
          splitAnimation ? "layout-v2__child-slot--split-entering" : "",
          splitAnimation?.newChildIndex === 0 ? "layout-v2__child-slot--new" : "",
        ].filter(Boolean).join(" ")}
        style={firstChildStyle}
      >
        <div
          className={[
            "layout-v2__child-slot-inner",
            splitAnimation?.newChildIndex === 0 ? "layout-v2__child-slot-inner--new" : "",
            splitAnimation && isSplitAnimationEntered ? "layout-v2__child-slot-inner--entered" : "",
          ].filter(Boolean).join(" ")}
          data-split-direction={splitAnimation?.direction ?? undefined}
          data-new-child-index={splitAnimation?.newChildIndex === 0 ? "0" : undefined}
        >
          <SectionNodeView
            node={firstChild}
            renderSection={renderSection}
            onResizeSection={onResizeSection}
            minSectionSize={minSectionSize}
            splitAnimations={splitAnimations}
            onSplitAnimationComplete={onSplitAnimationComplete}
          />
        </div>
      </div>
      {/* 分隔条：用于调整当前父 section 下两个子区域的占比。 */}
      <SplitDivider
        direction={node.split.direction}
        ratio={node.split.ratio}
        minSectionSize={minSectionSize}
        disabled={!canResizeSectionSplit(node)}
        onResize={(nextRatio) => onResizeSection(node.id, nextRatio)}
      />
      {/* 第二个子区域容器：通过补足剩余 flex 比例占据父区域的一部分。 */}
      <div
        className={[
          "layout-v2__child-slot",
          splitAnimation ? "layout-v2__child-slot--split-entering" : "",
          splitAnimation?.newChildIndex === 1 ? "layout-v2__child-slot--new" : "",
        ].filter(Boolean).join(" ")}
        style={secondChildStyle}
      >
        <div
          className={[
            "layout-v2__child-slot-inner",
            splitAnimation?.newChildIndex === 1 ? "layout-v2__child-slot-inner--new" : "",
            splitAnimation && isSplitAnimationEntered ? "layout-v2__child-slot-inner--entered" : "",
          ].filter(Boolean).join(" ")}
          data-split-direction={splitAnimation?.direction ?? undefined}
          data-new-child-index={splitAnimation?.newChildIndex === 1 ? "1" : undefined}
        >
          <SectionNodeView
            node={secondChild}
            renderSection={renderSection}
            onResizeSection={onResizeSection}
            minSectionSize={minSectionSize}
            splitAnimations={splitAnimations}
            onSplitAnimationComplete={onSplitAnimationComplete}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * @function SectionLayoutView
 * @description 渲染完整的 section 布局树。
 * @param props 组件属性。
 * @returns section 布局根视图。
 */
export function SectionLayoutView<T>(props: SectionLayoutViewProps<T>): ReactNode {
  const {
    root,
    animationRoot,
    renderSection,
    onResizeSection,
    minSectionSize = 120,
    className,
  } = props;
  const rootClassName = ["layout-v2__root", className ?? ""].filter(Boolean).join(" ");
  const effectiveAnimationRoot = animationRoot ?? root;
  const previousRootRef = useRef(effectiveAnimationRoot);
  const previousSnapshotsRef = useRef<Record<string, SplitAnimationSnapshot>>({});
  const animationTokenRef = useRef(1);
  const [splitAnimations, setSplitAnimations] = useState<Record<string, SplitAnimationDescriptor>>({});

  useLayoutEffect(() => {
    const previousRoot = previousRootRef.current;
    if (previousRoot === effectiveAnimationRoot) {
      return;
    }

    const nextAnimationState = collectSplitAnimations(
      previousRoot,
      effectiveAnimationRoot,
      previousSnapshotsRef.current,
      animationTokenRef.current,
    );
    const nextAnimations = nextAnimationState.animations;
    animationTokenRef.current += Object.keys(nextAnimations).length + 1;
    previousSnapshotsRef.current = nextAnimationState.snapshots;
    if (Object.keys(nextAnimations).length > 0) {
      setSplitAnimations((currentAnimations) => ({
        ...currentAnimations,
        ...nextAnimations,
      }));
    }

    previousRootRef.current = effectiveAnimationRoot;
  }, [effectiveAnimationRoot]);

  const handleSplitAnimationComplete = useCallback((sectionId: string, token: number): void => {
    setSplitAnimations((currentAnimations) => {
      const currentAnimation = currentAnimations[sectionId];
      if (!currentAnimation || currentAnimation.token !== token) {
        return currentAnimations;
      }

      const nextAnimations = { ...currentAnimations };
      delete nextAnimations[sectionId];
      return nextAnimations;
    });
  }, []);

  return (
    <div className={rootClassName} data-layout-root-id={root.id}>
      {/* 布局根容器：撑满可用空间并承载整棵 section 树，不附带额外装饰。 */}
      <SectionNodeView
        node={root}
        renderSection={renderSection}
        onResizeSection={onResizeSection}
        minSectionSize={minSectionSize}
        splitAnimations={splitAnimations}
        onSplitAnimationComplete={handleSplitAnimationComplete}
      />
    </div>
  );
}