import { type PanelSectionPanelDefinition } from "./panelSectionModel";
import {
    isPointerInsidePreviewBounds,
    resolvePreviewSplitSide,
    toPreviewStableBounds,
} from "../section/previewSession";

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
    sessionId?: number;
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

const RECENT_ENDED_PANEL_SESSION_IDS_LIMIT = 12;

let nextPanelSectionDragSessionId = 1;

const recentEndedPanelSectionSessionIds: number[] = [];

export function createPanelSectionDragSessionId(): number {
    return nextPanelSectionDragSessionId++;
}

export function markPanelSectionDragSessionEnded(
    session: Pick<PanelSectionDragSession, "sessionId"> | null | undefined,
): void {
    const sessionId = session?.sessionId;
    if (sessionId === undefined) {
        return;
    }

    if (recentEndedPanelSectionSessionIds[recentEndedPanelSectionSessionIds.length - 1] === sessionId) {
        return;
    }

    recentEndedPanelSectionSessionIds.push(sessionId);
    if (recentEndedPanelSectionSessionIds.length > RECENT_ENDED_PANEL_SESSION_IDS_LIMIT) {
        recentEndedPanelSectionSessionIds.splice(
            0,
            recentEndedPanelSectionSessionIds.length - RECENT_ENDED_PANEL_SESSION_IDS_LIMIT,
        );
    }
}

export function isEndedPanelSectionDragSession(
    session: Pick<PanelSectionDragSession, "sessionId"> | null | undefined,
): boolean {
    const sessionId = session?.sessionId;
    return sessionId !== undefined && recentEndedPanelSectionSessionIds.includes(sessionId);
}

function readElementTranslateX(element: HTMLElement): number {
    const transform = window.getComputedStyle(element).transform;
    if (!transform || transform === "none") {
        return 0;
    }

    try {
        return new DOMMatrixReadOnly(transform).m41;
    } catch {
        return 0;
    }
}

function getSlotMidpointX(slotElement: HTMLDivElement): number {
    const rect = slotElement.getBoundingClientRect();
    const logicalLeft = rect.left - readElementTranslateX(slotElement);
    return logicalLeft + rect.width / 2;
}

function getPanelTargetIndexFromSlotElements(
    pointerX: number,
    slotElements: HTMLDivElement[],
): number {
    let candidateIndex = slotElements.length;

    for (let index = 0; index < slotElements.length; index += 1) {
        const slotElement = slotElements[index];
        if (pointerX < getSlotMidpointX(slotElement)) {
            candidateIndex = index;
            break;
        }
    }

    return candidateIndex;
}

export function advancePanelSectionDragSessionPointer(
    session: PanelSectionDragSession,
    pointerX: number,
    pointerY: number,
): PanelSectionDragSession {
    const distance = Math.hypot(
        pointerX - session.originX,
        pointerY - session.originY,
    );
    const nextPhase = session.phase === "pending" && distance >= 4
        ? "dragging"
        : session.phase;

    if (
        nextPhase === session.phase &&
        session.pointerX === pointerX &&
        session.pointerY === pointerY
    ) {
        return session;
    }

    return {
        ...session,
        phase: nextPhase,
        pointerX,
        pointerY,
    };
}

export function resolvePanelSectionPointerEndHoverTarget(
    pointerX: number,
    pointerY: number,
): PanelSectionHoverTarget | null {
    const hoveredElement = document.elementFromPoint(pointerX, pointerY);
    const sectionRoot = hoveredElement?.closest(".layout-v2-panel-section");
    if (!(sectionRoot instanceof HTMLElement)) {
        return null;
    }

    const panelSectionId = sectionRoot.getAttribute("data-panel-section-id");
    const leafSectionId = sectionRoot.getAttribute("data-layout-leaf-section-id");
    const anchorLeafSectionId = sectionRoot.getAttribute("data-layout-committed-leaf-section-id") ?? undefined;

    if (!panelSectionId || !leafSectionId) {
        return null;
    }

    const barElement = sectionRoot.querySelector(".layout-v2-panel-section__bar");
    if (barElement instanceof HTMLDivElement) {
        const barRect = barElement.getBoundingClientRect();
        const insideBar = (
            pointerX >= barRect.left &&
            pointerX <= barRect.right &&
            pointerY >= barRect.top &&
            pointerY <= barRect.bottom
        );

        if (insideBar) {
            const slotElements = Array.from(
                sectionRoot.querySelectorAll<HTMLDivElement>(".layout-v2-panel-section__panel-slot"),
            );

            return {
                area: "bar",
                leafSectionId,
                anchorLeafSectionId: anchorLeafSectionId ?? leafSectionId,
                panelSectionId,
                targetIndex: getPanelTargetIndexFromSlotElements(pointerX, slotElements),
            };
        }
    }

    const contentElement = sectionRoot.querySelector(".layout-v2-panel-section__content");
    if (!(contentElement instanceof HTMLDivElement)) {
        return null;
    }

    const contentBounds = toPreviewStableBounds(contentElement.getBoundingClientRect());
    if (!contentBounds || !isPointerInsidePreviewBounds(contentBounds, pointerX, pointerY)) {
        return null;
    }

    return {
        area: "content",
        leafSectionId,
        anchorLeafSectionId: anchorLeafSectionId ?? leafSectionId,
        panelSectionId,
        splitSide: resolvePreviewSplitSide(
            contentBounds,
            pointerX,
            pointerY,
            {
                top: "top",
                bottom: "bottom",
            } as const,
        ),
        contentBounds,
    };
}