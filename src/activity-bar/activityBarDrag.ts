import { type ActivityBarDragPayload } from "./ActivityBarIcon";

export interface ActivityBarDragSession extends ActivityBarDragPayload {
    currentBarId: string;
    panelTarget: {
        panelSectionId: string;
        targetIndex: number;
    } | null;
    pointerId: number;
    originX: number;
    originY: number;
    pointerX: number;
    pointerY: number;
    targetIndex: number;
    phase: "pending" | "dragging";
}