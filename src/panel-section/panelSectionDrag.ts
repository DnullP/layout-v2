import { type PanelSectionPanelDefinition } from "./panelSectionModel";

export type PanelSectionSplitSide = "top" | "bottom";

export interface PanelSectionHoverTarget {
    area: "bar" | "content";
    leafSectionId: string;
    anchorLeafSectionId?: string;
    panelSectionId: string;
    targetIndex?: number;
    splitSide?: PanelSectionSplitSide | null;
    contentBounds?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

export interface PanelSectionPointerPressPayload {
    leafSectionId: string;
    panelSectionId: string;
    panelId: string;
    index: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    label: string;
    symbol: string;
    content: string;
    tone?: PanelSectionPanelDefinition["tone"];
}

export interface PanelSectionDragSession {
    sourcePanelSectionId: string;
    currentPanelSectionId: string;
    sourceLeafSectionId: string;
    currentLeafSectionId: string;
    activityTarget: {
        barId: string;
        targetIndex: number;
    } | null;
    panelId: string;
    label: string;
    symbol: string;
    content: string;
    tone?: PanelSectionPanelDefinition["tone"];
    pointerId: number;
    originX: number;
    originY: number;
    pointerX: number;
    pointerY: number;
    phase: "pending" | "dragging";
    hoverTarget: PanelSectionHoverTarget | null;
}