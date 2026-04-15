/**
 * @module host/layout-v2/section/layoutModel
 * @description section 布局树的数据模型与纯函数操作集合。
 *   该模块只处理 section 树的创建、切割、更新与比例调整，
 *   不依赖 React，可直接用于状态管理、序列化与测试。
 */

import {
    updateLayoutMetadata,
    type LayoutHostMetadata,
    type LayoutHostMetadataUpdater,
} from "../hostMetadata";

export const MIN_SPLIT_RATIO = 0.15;

export type SectionEdge = "top" | "right" | "bottom" | "left";

export interface SectionResizableEdges {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}

export type SectionSplitDirection = "horizontal" | "vertical";

export const SECTION_SPLIT_HORIZONTAL: SectionSplitDirection = "horizontal";

export const SECTION_SPLIT_VERTICAL: SectionSplitDirection = "vertical";

export const SECTION_HIDDEN_META_KEY = "layout-v2:hidden";
export const SECTION_FIXED_SIZE_META_KEY = "layout-v2:fixedSize";

export interface SectionDraft<T> {
    id?: string;
    title?: string;
    data: T;
    resizableEdges?: Partial<SectionResizableEdges>;
    meta?: LayoutHostMetadata;
}

export interface SectionSplitState<T> {
    direction: SectionSplitDirection;
    ratio: number;
    children: [SectionNode<T>, SectionNode<T>];
}

export interface SectionNode<T> {
    id: string;
    title: string;
    data: T;
    resizableEdges: SectionResizableEdges;
    meta?: LayoutHostMetadata;
    split: SectionSplitState<T> | null;
}

export interface SplitSectionOptions<T> {
    first?: SectionDraft<T>;
    second?: SectionDraft<T>;
    ratio?: number;
}

let sectionSequence = 0;

function createSectionId(): string {
    sectionSequence += 1;
    return `section-${sectionSequence}`;
}

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

function normalizeInitialSplitRatio(ratio: number): number {
    return Math.min(0.99, Math.max(0.01, ratio));
}

export function clampSplitRatio(ratio: number, minRatio = MIN_SPLIT_RATIO): number {
    const safeMinRatio = Math.max(0.01, Math.min(minRatio, 0.49));
    return Math.min(1 - safeMinRatio, Math.max(safeMinRatio, ratio));
}

export function createSectionNode<T>(draft: SectionDraft<T>): SectionNode<T> {
    return {
        id: draft.id ?? createSectionId(),
        title: draft.title ?? "Untitled Section",
        data: draft.data,
        resizableEdges: createSectionResizableEdges(draft.resizableEdges),
        meta: draft.meta,
        split: null,
    };
}

export function createRootSection<T>(draft: SectionDraft<T>): SectionNode<T> {
    return createSectionNode(draft);
}

export function isSectionHidden<T>(section: SectionNode<T>): boolean {
    return section.meta?.[SECTION_HIDDEN_META_KEY] === true;
}

export function setSectionHidden<T>(
    root: SectionNode<T>,
    sectionId: string,
    isHidden: boolean,
): SectionNode<T> {
    return updateSectionMetadata(root, sectionId, (metadata) => {
        if (isHidden) {
            return {
                ...metadata,
                [SECTION_HIDDEN_META_KEY]: true,
            };
        }

        if (!(SECTION_HIDDEN_META_KEY in metadata)) {
            return metadata;
        }

        const nextMetadata = { ...metadata };
        delete nextMetadata[SECTION_HIDDEN_META_KEY];
        return nextMetadata;
    });
}

export function toggleSectionHidden<T>(
    root: SectionNode<T>,
    sectionId: string,
): SectionNode<T> {
    const section = findSectionNode(root, sectionId);
    if (!section) {
        return root;
    }

    return setSectionHidden(root, sectionId, !isSectionHidden(section));
}

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

export function isSectionEdgeDraggable<T>(
    section: SectionNode<T>,
    edge: SectionEdge,
): boolean {
    return section.resizableEdges[edge];
}

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
                    meta: survivor.meta,
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

export function updateSectionMetadata<T>(
    root: SectionNode<T>,
    sectionId: string,
    updater: LayoutHostMetadataUpdater,
): SectionNode<T> {
    return updateSectionTree(root, sectionId, (section) => updateLayoutMetadata(section, updater));
}

export function collectLeafSections<T>(node: SectionNode<T>): SectionNode<T>[] {
    if (!node.split) {
        return [node];
    }

    return [
        ...collectLeafSections(node.split.children[0]),
        ...collectLeafSections(node.split.children[1]),
    ];
}

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

export function resetSectionSequenceForTest(): void {
    sectionSequence = 0;
}