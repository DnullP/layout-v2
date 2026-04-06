/**
 * @module host/layout-v2/section/SectionLayoutView
 * @description section 布局树的递归 React 渲染器。
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
import { Section } from "./Section";
import "./layout.css";

export interface SectionLayoutViewProps<T> {
    root: SectionNode<T>;
    animationRoot?: SectionNode<T>;
    renderSection: (section: SectionNode<T>) => ReactNode;
    onResizeSection: (sectionId: string, ratio: number) => void;
    minSectionSize?: number;
    className?: string;
}

interface SectionNodeViewProps<T> {
    node: SectionNode<T>;
    renderSection: (section: SectionNode<T>) => ReactNode;
    onResizeSection: (sectionId: string, ratio: number) => void;
    minSectionSize: number;
    splitAnimations: Record<string, SplitAnimationDescriptor>;
    onSplitAnimationComplete: (sectionId: string, token: number) => void;
}

interface SplitAnimationDescriptor {
    token: number;
    signature: string;
    direction: SectionSplitDirection;
    ratio: number;
    newChildIndex: 0 | 1;
}

interface SplitAnimationSnapshot {
    signature: string;
    direction: SectionSplitDirection;
    newChildIndex: 0 | 1;
}

const SPLIT_ANIMATION_DURATION_MS = 240;

interface SplitDividerProps {
    direction: SectionSplitDirection;
    ratio: number;
    minSectionSize: number;
    onResize: (ratio: number) => void;
    disabled?: boolean;
}

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

function buildChildStyle(ratio: number, isPrimary: boolean): CSSProperties {
    return {
        flex: isPrimary ? ratio : 1 - ratio,
    };
}

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

function buildSplitAnimationSignature(
    direction: SectionSplitDirection,
    newChildIndex: 0 | 1,
): string {
    return `${direction}:${newChildIndex}`;
}

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
        if (!currentNode || !currentNode.split) {
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

function SplitDivider(props: SplitDividerProps): ReactNode {
    const { direction, ratio, minSectionSize, onResize, disabled = false } = props;
    const dividerRef = useRef<HTMLDivElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        return () => {
            setIsDragging(false);
        };
    }, []);

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
            <div className="layout-v2__divider-line" />
        </div>
    );
}

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
        return <Section sectionId={node.id}>{renderSection(node)}</Section>;
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
            <SplitDivider
                direction={node.split.direction}
                ratio={node.split.ratio}
                minSectionSize={minSectionSize}
                disabled={!canResizeSectionSplit(node)}
                onResize={(nextRatio) => onResizeSection(node.id, nextRatio)}
            />
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