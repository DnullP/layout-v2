import { type ActivityBarDragPayload } from "./ActivityBarIcon";
import { type PanelSectionHoverTarget } from "../panel-section/panelSectionDrag";

export interface ActivityBarDragSession extends ActivityBarDragPayload {
    currentBarId: string;
    panelTarget: {
        panelSectionId: string;
        targetIndex: number;
    } | null;
    contentTarget: PanelSectionHoverTarget | null;
    pointerId: number;
    originX: number;
    originY: number;
    pointerX: number;
    pointerY: number;
    targetIndex: number;
    phase: "pending" | "dragging";
}