import { describe, expect, test } from "bun:test";
import {
    arePreviewHoverTargetsEqual,
    isPointerInsidePreviewBounds,
    resolvePreviewAnchorLeafSectionId,
    resolvePreviewContentSession,
    resolvePreviewSplitSide,
    type PreviewHoverTargetBase,
    type PreviewStableBounds,
} from "../src/section";

interface TestHoverTarget extends PreviewHoverTargetBase<"content" | "strip", "left" | "right" | "top" | "bottom"> {
    sectionId: string;
}

function createBounds(): PreviewStableBounds {
    return {
        left: 0,
        top: 0,
        right: 300,
        bottom: 180,
        width: 300,
        height: 180,
    };
}

describe("previewSession", () => {
    test("应在 pointer 仍位于稳定 content bounds 内时保留 stable content target", () => {
        const currentTarget: TestHoverTarget = {
            area: "content",
            leafSectionId: "preview-leaf",
            anchorLeafSectionId: "committed-leaf",
            sectionId: "main-section",
            splitSide: "right",
            contentBounds: createBounds(),
        };

        const previewSession = resolvePreviewContentSession({
            currentTarget,
            isCurrentSectionContentTarget: true,
            contentRect: null,
            pointerX: 280,
            pointerY: 90,
        });

        expect(previewSession.contentBounds).toEqual(createBounds());
        expect(previewSession.shouldPreferStableContentTarget).toBe(true);
    });

    test("应支持按方向映射解析 preview split side", () => {
        const bounds = createBounds();

        expect(resolvePreviewSplitSide(bounds, 10, 90, { left: "left", right: "right" })).toBe("left");
        expect(resolvePreviewSplitSide(bounds, 290, 90, { left: "left", right: "right" })).toBe("right");
        expect(resolvePreviewSplitSide(bounds, 150, 10, { top: "top", bottom: "bottom" })).toBe("top");
        expect(resolvePreviewSplitSide(bounds, 150, 175, { top: "top", bottom: "bottom" })).toBe("bottom");
    });

    test("应在 split 阈值附近保留当前命中的 preview split side", () => {
        const bounds = createBounds();

        expect(resolvePreviewSplitSide(
            bounds,
            150,
            68,
            { top: "top", bottom: "bottom" },
            { currentSplitSide: "top" },
        )).toBe("top");

        expect(resolvePreviewSplitSide(
            bounds,
            108,
            90,
            { left: "left", right: "right" },
            { currentSplitSide: "left" },
        )).toBe("left");
    });

    test("应在越过滞回范围后释放当前 split side", () => {
        const bounds = createBounds();

        expect(resolvePreviewSplitSide(
            bounds,
            150,
            76,
            { top: "top", bottom: "bottom" },
            { currentSplitSide: "top" },
        )).toBeNull();

        expect(resolvePreviewSplitSide(
            bounds,
            116,
            90,
            { left: "left", right: "right" },
            { currentSplitSide: "left" },
        )).toBeNull();
    });

    test("应支持公共 anchor 解析和 hover target 比较", () => {
        const left: TestHoverTarget = {
            area: "content",
            leafSectionId: "preview-leaf",
            anchorLeafSectionId: "committed-leaf",
            sectionId: "main-section",
            splitSide: "left",
            contentBounds: createBounds(),
        };
        const right: TestHoverTarget = {
            area: "content",
            leafSectionId: "preview-leaf",
            anchorLeafSectionId: "committed-leaf",
            sectionId: "main-section",
            splitSide: "left",
            contentBounds: createBounds(),
        };

        expect(resolvePreviewAnchorLeafSectionId({
            currentTarget: left,
            isCurrentSectionContentTarget: true,
            committedLeafSectionId: "fallback-leaf",
        })).toBe("committed-leaf");
        expect(arePreviewHoverTargetsEqual(left, right, (target) => target.sectionId)).toBe(true);
        expect(isPointerInsidePreviewBounds(createBounds(), 120, 90)).toBe(true);
    });
});