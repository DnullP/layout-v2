/**
 * @module host/layout-v2/section/useSectionLayout
 * @description section 布局树的 React hook 封装。
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

export interface UseSectionLayoutOptions<T> {
    initialRoot: SectionNode<T>;
}

export interface SectionLayoutController<T> {
    root: SectionNode<T>;
    leafSections: SectionNode<T>[];
    getSection: (sectionId: string) => SectionNode<T> | null;
    splitSection: (
        sectionId: string,
        direction: SectionSplitDirection,
        options: SplitSectionOptions<T>,
    ) => void;
    destroySection: (sectionId: string) => void;
    resizeSection: (sectionId: string, ratio: number) => void;
    updateSection: (
        sectionId: string,
        updater: (section: SectionNode<T>) => SectionNode<T>,
    ) => void;
    resetLayout: (nextRoot: SectionNode<T>) => void;
}

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
            dispatch({
                type: "split",
                sectionId,
                direction,
                options: splitOptions,
            });
        },
        destroySection: (sectionId) => {
            dispatch({
                type: "destroy",
                sectionId,
            });
        },
        resizeSection: (sectionId, ratio) => {
            dispatch({
                type: "resize",
                sectionId,
                ratio,
            });
        },
        updateSection: (sectionId, updater) => {
            dispatch({
                type: "update",
                sectionId,
                updater,
            });
        },
        resetLayout: (nextRoot) => {
            dispatch({
                type: "reset",
                nextRoot,
            });
        },
    };
}