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
    const leftThreshold = rect.left + rect.width / 3;
    const rightThreshold = rect.right - rect.width / 3;
    const topThreshold = rect.top + rect.height / 3;
    const bottomThreshold = rect.bottom - rect.height / 3;

    const hysteresisPx = Math.max(0, options.hysteresisPx ?? DEFAULT_PREVIEW_SPLIT_HYSTERESIS_PX);
    if (shouldRetainPreviewSplitSide(rect, pointerX, pointerY, splitSides, options.currentSplitSide, hysteresisPx)) {
        return options.currentSplitSide;
    }

    if (splitSides.left && pointerX <= leftThreshold) {
        return splitSides.left as PreviewSplitSideValue<TSplitSides>;
    }

    if (splitSides.right && pointerX >= rightThreshold) {
        return splitSides.right as PreviewSplitSideValue<TSplitSides>;
    }

    if (splitSides.top && pointerY <= topThreshold) {
        return splitSides.top as PreviewSplitSideValue<TSplitSides>;
    }

    if (splitSides.bottom && pointerY >= bottomThreshold) {
        return splitSides.bottom as PreviewSplitSideValue<TSplitSides>;
    }

    return null;
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