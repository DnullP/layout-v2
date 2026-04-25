/**
 * @module host/layout-v2/section/previewSession
 * @description 供 tab / panel 等可分区组件复用的预览会话底层能力。
 */

export interface PreviewStableBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface PreviewHoverTargetBase<
    TArea extends string = string,
    TSplitSide extends string = string,
> {
    area: TArea;
    leafSectionId: string;
    anchorLeafSectionId?: string;
    targetIndex?: number;
    splitSide?: TSplitSide | null;
    contentBounds?: PreviewStableBounds;
}

export interface PreviewSplitSideMap<TSplitSide extends string> {
    left?: TSplitSide;
    right?: TSplitSide;
    top?: TSplitSide;
    bottom?: TSplitSide;
}

type PreviewSplitSideValue<TSplitSides extends PreviewSplitSideMap<string>> = NonNullable<
    TSplitSides[keyof TSplitSides]
>;

const DEFAULT_PREVIEW_SPLIT_HYSTERESIS_PX = 10;
const DEFAULT_PREVIEW_SPLIT_SWITCH_SCORE_EPSILON = 0.05;

function resolvePreviewSplitScore(
    rect: DOMRect | PreviewStableBounds,
    pointerX: number,
    pointerY: number,
    side: "left" | "right" | "top" | "bottom",
    entryHysteresisPx: number,
): number | null {
    const leftThreshold = rect.left + rect.width / 3;
    const rightThreshold = rect.right - rect.width / 3;
    const topThreshold = rect.top + rect.height / 3;
    const bottomThreshold = rect.bottom - rect.height / 3;

    if (side === "left") {
        const activation = leftThreshold - entryHysteresisPx;
        if (pointerX > activation) {
            return null;
        }

        return (activation - pointerX) / Math.max(leftThreshold - rect.left, 1);
    }

    if (side === "right") {
        const activation = rightThreshold + entryHysteresisPx;
        if (pointerX < activation) {
            return null;
        }

        return (pointerX - activation) / Math.max(rect.right - rightThreshold, 1);
    }

    if (side === "top") {
        const activation = topThreshold - entryHysteresisPx;
        if (pointerY > activation) {
            return null;
        }

        return (activation - pointerY) / Math.max(topThreshold - rect.top, 1);
    }

    const activation = bottomThreshold + entryHysteresisPx;
    if (pointerY < activation) {
        return null;
    }

    return (pointerY - activation) / Math.max(rect.bottom - bottomThreshold, 1);
}

function collectPreviewSplitCandidates<const TSplitSides extends PreviewSplitSideMap<string>>(
    rect: DOMRect | PreviewStableBounds,
    pointerX: number,
    pointerY: number,
    splitSides: TSplitSides,
    entryHysteresisPx: number,
): Array<{
    side: PreviewSplitSideValue<TSplitSides>;
    score: number;
}> {
    const candidates: Array<{
        side: PreviewSplitSideValue<TSplitSides>;
        score: number;
    }> = [];

    const pushCandidate = (
        side: PreviewSplitSideValue<TSplitSides> | undefined,
        score: number | null,
    ): void => {
        if (!side || score === null) {
            return;
        }

        candidates.push({ side, score });
    };

    pushCandidate(
        splitSides.left as PreviewSplitSideValue<TSplitSides> | undefined,
        splitSides.left
            ? resolvePreviewSplitScore(rect, pointerX, pointerY, "left", entryHysteresisPx)
            : null,
    );
    pushCandidate(
        splitSides.right as PreviewSplitSideValue<TSplitSides> | undefined,
        splitSides.right
            ? resolvePreviewSplitScore(rect, pointerX, pointerY, "right", entryHysteresisPx)
            : null,
    );
    pushCandidate(
        splitSides.top as PreviewSplitSideValue<TSplitSides> | undefined,
        splitSides.top
            ? resolvePreviewSplitScore(rect, pointerX, pointerY, "top", entryHysteresisPx)
            : null,
    );
    pushCandidate(
        splitSides.bottom as PreviewSplitSideValue<TSplitSides> | undefined,
        splitSides.bottom
            ? resolvePreviewSplitScore(rect, pointerX, pointerY, "bottom", entryHysteresisPx)
            : null,
    );

    return candidates;
}

function shouldRetainPreviewSplitSide<const TSplitSides extends PreviewSplitSideMap<string>>(
    rect: DOMRect | PreviewStableBounds,
    pointerX: number,
    pointerY: number,
    splitSides: TSplitSides,
    currentSplitSide: PreviewSplitSideValue<TSplitSides> | null | undefined,
    hysteresisPx: number,
): currentSplitSide is PreviewSplitSideValue<TSplitSides> {
    if (!currentSplitSide) {
        return false;
    }

    const leftThreshold = rect.left + rect.width / 3;
    const rightThreshold = rect.right - rect.width / 3;
    const topThreshold = rect.top + rect.height / 3;
    const bottomThreshold = rect.bottom - rect.height / 3;

    if (splitSides.left === currentSplitSide) {
        return pointerX <= leftThreshold + hysteresisPx;
    }

    if (splitSides.right === currentSplitSide) {
        return pointerX >= rightThreshold - hysteresisPx;
    }

    if (splitSides.top === currentSplitSide) {
        return pointerY <= topThreshold + hysteresisPx;
    }

    if (splitSides.bottom === currentSplitSide) {
        return pointerY >= bottomThreshold - hysteresisPx;
    }

    return false;
}

export function toPreviewStableBounds(rect: DOMRect | null): PreviewStableBounds | null {
    if (!rect) {
        return null;
    }

    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
}

export function isPointerInsidePreviewBounds(
    bounds: PreviewStableBounds | null,
    pointerX: number,
    pointerY: number,
): boolean {
    return Boolean(
        bounds &&
        pointerX >= bounds.left &&
        pointerX <= bounds.right &&
        pointerY >= bounds.top &&
        pointerY <= bounds.bottom,
    );
}

export function resolvePreviewContentSession<
    TTarget extends PreviewHoverTargetBase,
>(params: {
    currentTarget: TTarget | null | undefined;
    isCurrentSectionContentTarget: boolean;
    contentRect: DOMRect | null;
    pointerX: number;
    pointerY: number;
}): {
    contentBounds: PreviewStableBounds | null;
    shouldPreferStableContentTarget: boolean;
} {
    const existingContentBounds = params.isCurrentSectionContentTarget
        ? params.currentTarget?.contentBounds ?? null
        : null;
    const contentBounds = existingContentBounds ?? toPreviewStableBounds(params.contentRect);
    const shouldPreferStableContentTarget = Boolean(
        params.isCurrentSectionContentTarget &&
        params.currentTarget?.splitSide &&
        isPointerInsidePreviewBounds(
            params.currentTarget?.contentBounds ?? contentBounds,
            params.pointerX,
            params.pointerY,
        ),
    );

    return {
        contentBounds,
        shouldPreferStableContentTarget,
    };
}

export function resolvePreviewAnchorLeafSectionId<
    TTarget extends PreviewHoverTargetBase,
>(params: {
    currentTarget: TTarget | null | undefined;
    isCurrentSectionContentTarget: boolean;
    committedLeafSectionId: string;
}): string {
    if (!params.isCurrentSectionContentTarget) {
        return params.committedLeafSectionId;
    }

    return (
        params.currentTarget?.anchorLeafSectionId ??
        params.currentTarget?.leafSectionId ??
        params.committedLeafSectionId
    );
}

export function resolvePreviewSplitSide<const TSplitSides extends PreviewSplitSideMap<string>>(
    rect: DOMRect | PreviewStableBounds,
    pointerX: number,
    pointerY: number,
    splitSides: TSplitSides,
    options: {
        currentSplitSide?: PreviewSplitSideValue<TSplitSides> | null;
        hysteresisPx?: number;
    } = {},
): PreviewSplitSideValue<TSplitSides> | null {
    const hysteresisPx = Math.max(0, options.hysteresisPx ?? DEFAULT_PREVIEW_SPLIT_HYSTERESIS_PX);
    const entryHysteresisPx = options.currentSplitSide ? 0 : hysteresisPx;
    const candidates = collectPreviewSplitCandidates(
        rect,
        pointerX,
        pointerY,
        splitSides,
        entryHysteresisPx,
    );
    const bestCandidate = candidates.reduce<{
        side: PreviewSplitSideValue<TSplitSides>;
        score: number;
    } | null>((best, candidate) => {
        if (!best || candidate.score > best.score) {
            return candidate;
        }

        return best;
    }, null);

    if (options.currentSplitSide) {
        const currentCandidate = candidates.find((candidate) => candidate.side === options.currentSplitSide) ?? null;
        if (currentCandidate) {
            const bestOtherCandidate = candidates.reduce<{
                side: PreviewSplitSideValue<TSplitSides>;
                score: number;
            } | null>((best, candidate) => {
                if (candidate.side === options.currentSplitSide) {
                    return best;
                }

                if (!best || candidate.score > best.score) {
                    return candidate;
                }

                return best;
            }, null);

            if (
                bestOtherCandidate &&
                bestOtherCandidate.score > currentCandidate.score + DEFAULT_PREVIEW_SPLIT_SWITCH_SCORE_EPSILON
            ) {
                return bestOtherCandidate.side;
            }

            return options.currentSplitSide;
        }

        if (bestCandidate) {
            return bestCandidate.side;
        }

        if (shouldRetainPreviewSplitSide(rect, pointerX, pointerY, splitSides, options.currentSplitSide, hysteresisPx)) {
            return options.currentSplitSide;
        }
    }

    return bestCandidate?.side ?? null;
}

export function arePreviewHoverTargetsEqual<TTarget extends PreviewHoverTargetBase>(
    left: TTarget | null,
    right: TTarget | null,
    getContainerId: (target: TTarget) => string,
): boolean {
    return (
        left?.area === right?.area &&
        left?.leafSectionId === right?.leafSectionId &&
        left?.anchorLeafSectionId === right?.anchorLeafSectionId &&
        (left ? getContainerId(left) : undefined) === (right ? getContainerId(right) : undefined) &&
        left?.targetIndex === right?.targetIndex &&
        left?.splitSide === right?.splitSide &&
        left?.contentBounds?.left === right?.contentBounds?.left &&
        left?.contentBounds?.top === right?.contentBounds?.top &&
        left?.contentBounds?.right === right?.contentBounds?.right &&
        left?.contentBounds?.bottom === right?.contentBounds?.bottom
    );
}