import { type TabSectionTabDefinition } from "./tabSectionModel";

export type TabSectionSplitSide = "left" | "right" | "top" | "bottom";

export interface TabSectionHoverTarget {
    area: "strip" | "content";
    leafSectionId: string;
    anchorLeafSectionId?: string;
    tabSectionId: string;
    targetIndex?: number;
    splitSide?: TabSectionSplitSide | null;
    contentBounds?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

export interface TabSectionPointerPressPayload {
    leafSectionId: string;
    tabSectionId: string;
    tabId: string;
    index: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    title: string;
    content: string;
    tone?: TabSectionTabDefinition["tone"];
}

export interface TabSectionDragSession {
    sourceTabSectionId: string;
    currentTabSectionId: string;
    sourceLeafSectionId: string;
    currentLeafSectionId: string;
    tabId: string;
    title: string;
    content: string;
    tone?: TabSectionTabDefinition["tone"];
    pointerId: number;
    originX: number;
    originY: number;
    pointerX: number;
    pointerY: number;
    phase: "pending" | "dragging";
    hoverTarget: TabSectionHoverTarget | null;
}