import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { type ActivityBarDragSession } from "../activity-bar/activityBarDrag";
import {
    arePreviewHoverTargetsEqual,
    isPointerInsidePreviewBounds,
    resolvePreviewAnchorLeafSectionId,
    resolvePreviewContentSession,
    resolvePreviewSplitSide,
    type PreviewHoverTargetBase,
} from "../section/previewSession";
import {
    type PanelSectionDragSession,
    type PanelSectionHoverTarget,
    type PanelSectionPointerPressPayload,
    type PanelSectionSplitSide,
} from "./panelSectionDrag";
import {
    type PanelSectionPanelDefinition,
    type PanelSectionPanelMove,
    type PanelSectionStateItem,
} from "./panelSectionModel";
import {
    mergeLayoutFocusAttributes,
    type PanelSectionFocusBridge,
} from "../vscode-layout/focusBridge";
import "./panelSection.css";

export type {
    PanelSectionDragSession,
    PanelSectionHoverTarget,
    PanelSectionPointerPressPayload,
    PanelSectionSplitSide,
} from "./panelSectionDrag";

export type { PanelSectionPanelDefinition } from "./panelSectionModel";

export type PanelSectionTabRenderer = (panel: PanelSectionPanelDefinition) => ReactNode;

export type PanelSectionContentRenderer = (panel: PanelSectionPanelDefinition) => ReactNode;

const PANEL_BAR_HYSTERESIS_PX = 8;

const DRAG_START_DISTANCE_PX = 4;

function buildPanelSectionDragSession(
    payload: PanelSectionPointerPressPayload,
): PanelSectionDragSession {
    return {
        sourcePanelSectionId: payload.panelSectionId,
        currentPanelSectionId: payload.panelSectionId,
        sourceLeafSectionId: payload.leafSectionId,
        currentLeafSectionId: payload.leafSectionId,
        activityTarget: null,
        panelId: payload.panelId,
        label: payload.label,
        symbol: payload.symbol,
        content: payload.content,
        tone: payload.tone,
        pointerId: payload.pointerId,
        originX: payload.clientX,
        originY: payload.clientY,
        pointerX: payload.clientX,
        pointerY: payload.clientY,
        phase: "pending",
        hoverTarget: null,
    };
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

function getPanelTargetIndexFromPointer(
    pointerX: number,
    slotRefs: Record<string, HTMLDivElement | null>,
    panelIds: string[],
    currentTargetIndex?: number,
): number {
    let candidateIndex = panelIds.length;

    for (let index = 0; index < panelIds.length; index += 1) {
        const panelId = panelIds[index];
        const slotElement = slotRefs[panelId];
        if (!slotElement) {
            continue;
        }

        if (pointerX < getSlotMidpointX(slotElement)) {
            candidateIndex = index;
            break;
        }
    }

    if (
        currentTargetIndex === undefined ||
        currentTargetIndex < 0 ||
        Math.abs(candidateIndex - currentTargetIndex) !== 1
    ) {
        return candidateIndex;
    }

    const boundarySlotIndex = Math.min(candidateIndex, currentTargetIndex);
    const boundarySlotId = panelIds[boundarySlotIndex];
    const boundarySlot = boundarySlotId ? slotRefs[boundarySlotId] : null;
    if (!boundarySlot) {
        return candidateIndex;
    }

    const boundaryX = getSlotMidpointX(boundarySlot);
    if (Math.abs(pointerX - boundaryX) <= PANEL_BAR_HYSTERESIS_PX) {
        return currentTargetIndex;
    }

    return candidateIndex;
}


function getPanelSectionHoverTargetId(target: PreviewHoverTargetBase<"bar" | "content", PanelSectionSplitSide> & { panelSectionId?: string }): string {
    return target.panelSectionId ?? "";
}

function getPanelToneClassName(tone: PanelSectionPanelDefinition["tone"]): string {
    if (!tone || tone === "neutral") {
        return "layout-v2-panel-section__pane--neutral";
    }

    return `layout-v2-panel-section__pane--${tone}`;
}

export function PanelSection(props: {
    leafSectionId: string;
    committedLeafSectionId: string;
    panelSectionId: string;
    panelSection: PanelSectionStateItem | null;
    dragSession?: PanelSectionDragSession | null;
    activityDragSession?: ActivityBarDragSession | null;
    focusBridge?: PanelSectionFocusBridge<PanelSectionStateItem, PanelSectionPanelDefinition>;
    interactive?: boolean;
    allowContentPreview?: boolean;
    renderPanelTab?: PanelSectionTabRenderer;
    renderPanelContent?: PanelSectionContentRenderer;
    onDragSessionChange?: (session: PanelSectionDragSession | null) => void;
    onDragSessionEnd?: (session: PanelSectionDragSession) => void;
    onActivityDragSessionChange?: (session: ActivityBarDragSession | null) => void;
    onActivatePanel?: (panelId: string) => void;
    onFocusPanel: (panelId: string) => void;
    onToggleCollapsed: () => void;
    onMovePanel: (move: PanelSectionPanelMove) => void;
}): ReactNode {
    const {
        leafSectionId,
        committedLeafSectionId,
        panelSectionId,
        panelSection,
        dragSession: controlledDragSession,
        activityDragSession,
        focusBridge,
        interactive = true,
        allowContentPreview = false,
        renderPanelTab,
        renderPanelContent,
        onDragSessionChange,
        onDragSessionEnd,
        onActivityDragSessionChange,
        onActivatePanel,
        onFocusPanel,
        onToggleCollapsed,
        onMovePanel,
    } = props;
    const [internalDragSession, setInternalDragSession] = useState<PanelSectionDragSession | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const barRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const previousSlotLeftsRef = useRef<Record<string, number>>({});
    const dragSession = controlledDragSession ?? internalDragSession;
    const dragSessionRef = useRef<PanelSectionDragSession | null>(dragSession);
    const updateDragSession = onDragSessionChange ?? setInternalDragSession;
    const updateActivityDragSession = onActivityDragSessionChange ?? (() => { });

    dragSessionRef.current = dragSession;

    if (!panelSection) {
        console.warn("[layout-v2] panel section state is missing", {
            leafSectionId,
            panelSectionId,
        });
        return null;
    }

    const activePanel = panelSection.panels.find((panel) => panel.id === panelSection.focusedPanelId) ?? null;
    const draggingPanelId = dragSession?.phase === "dragging" && dragSession.currentPanelSectionId === panelSection.id
        ? dragSession.panelId
        : null;
    const activityDropIndex = activityDragSession?.panelTarget?.panelSectionId === panelSection.id
        ? activityDragSession.panelTarget.targetIndex
        : null;
    const shouldHideActivePane = Boolean(
        dragSession?.phase === "dragging" &&
        activePanel &&
        activePanel.id === dragSession.panelId,
    );

    useEffect(() => {
        if (!dragSession || dragSession.sourcePanelSectionId !== panelSection.id) {
            return;
        }
        const currentDragSession: PanelSectionDragSession = dragSession;
        let pendingEvent: PointerEvent | null = null;
        let frameId = 0;

        function flushPointerMove(): PanelSectionDragSession | null {
            frameId = 0;
            const event = pendingEvent;
            pendingEvent = null;
            if (!event) {
                return dragSessionRef.current;
            }

            const baseSession = dragSessionRef.current ?? currentDragSession;

            const distance = Math.hypot(
                event.clientX - baseSession.originX,
                event.clientY - baseSession.originY,
            );
            const nextPhase = baseSession.phase === "pending" && distance >= DRAG_START_DISTANCE_PX
                ? "dragging"
                : baseSession.phase;

            if (
                nextPhase === baseSession.phase &&
                baseSession.pointerX === event.clientX &&
                baseSession.pointerY === event.clientY
            ) {
                return baseSession;
            }

            const nextSession: PanelSectionDragSession = {
                ...baseSession,
                phase: nextPhase,
                pointerX: event.clientX,
                pointerY: event.clientY,
            };
            dragSessionRef.current = nextSession;
            updateDragSession(nextSession);
            return nextSession;
        }

        function handlePointerMove(event: PointerEvent): void {
            const baseSession = dragSessionRef.current ?? currentDragSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            pendingEvent = event;
            if (!frameId) {
                frameId = window.requestAnimationFrame(flushPointerMove);
            }
        }

        function handlePointerEnd(event: PointerEvent): void {
            const baseSession = dragSessionRef.current ?? currentDragSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            let finalSession = dragSessionRef.current ?? currentDragSession;
            if (frameId) {
                window.cancelAnimationFrame(frameId);
                finalSession = flushPointerMove() ?? finalSession;
            }

            dragSessionRef.current = null;
            updateDragSession(null);

            if (finalSession?.phase === "dragging") {
                onDragSessionEnd?.(finalSession);
            }
        }

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
        };
    }, [dragSession, onDragSessionEnd, panelSection.id, updateDragSession]);

    useEffect(() => {
        const isDragging = dragSession?.phase === "dragging" || activityDragSession?.phase === "dragging";
        document.body.classList.toggle("layout-v2--dragging", isDragging);

        return () => {
            if (isDragging) {
                document.body.classList.remove("layout-v2--dragging");
            }
        };
    }, [activityDragSession?.phase, dragSession?.phase]);

    useLayoutEffect(() => {
        const nextSlotLefts: Record<string, number> = {};
        const disableFlipAnimation = dragSession?.phase === "dragging";

        panelSection.panels.forEach((panel) => {
            const slotElement = slotRefs.current[panel.id];
            if (!slotElement) {
                return;
            }

            const nextLeft = slotElement.getBoundingClientRect().left;
            const previousLeft = previousSlotLeftsRef.current[panel.id];
            nextSlotLefts[panel.id] = nextLeft;

            if (disableFlipAnimation) {
                slotElement.style.transition = "none";
                slotElement.style.transform = "none";
                return;
            }

            if (previousLeft === undefined || previousLeft === nextLeft) {
                return;
            }

            const deltaX = previousLeft - nextLeft;
            slotElement.style.transition = "none";
            slotElement.style.transform = `translateX(${deltaX}px)`;
            void slotElement.getBoundingClientRect();
            requestAnimationFrame(() => {
                slotElement.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
                slotElement.style.transform = "translateX(0)";
            });
        });

        previousSlotLeftsRef.current = nextSlotLefts;
    }, [dragSession?.phase, panelSection.panels]);

    useEffect(() => {
        if ((!interactive && !allowContentPreview) || !dragSession || dragSession.phase !== "dragging") {
            return;
        }

        const barRect = barRef.current?.getBoundingClientRect() ?? null;
        const contentRect = contentRef.current?.getBoundingClientRect() ?? null;
        const isCurrentSectionContentTarget = Boolean(
            dragSession.hoverTarget?.area === "content" &&
            dragSession.hoverTarget.panelSectionId === panelSection.id,
        );
        const { contentBounds, shouldPreferStableContentTarget } = resolvePreviewContentSession({
            currentTarget: dragSession.hoverTarget,
            isCurrentSectionContentTarget,
            contentRect,
            pointerX: dragSession.pointerX,
            pointerY: dragSession.pointerY,
        });
        const insideBar = Boolean(
            interactive &&
            !shouldPreferStableContentTarget &&
            barRect &&
            dragSession.pointerX >= barRect.left &&
            dragSession.pointerX <= barRect.right &&
            dragSession.pointerY >= barRect.top &&
            dragSession.pointerY <= barRect.bottom,
        );
        const insideContent = !panelSection.isCollapsed && isPointerInsidePreviewBounds(
            contentBounds,
            dragSession.pointerX,
            dragSession.pointerY,
        );

        if (insideBar) {
            const targetIndex = getPanelTargetIndexFromPointer(
                dragSession.pointerX,
                slotRefs.current,
                panelSection.panels.map((panel) => panel.id),
                dragSession.hoverTarget?.area === "bar" && dragSession.hoverTarget.panelSectionId === panelSection.id
                    ? dragSession.hoverTarget.targetIndex
                    : undefined,
            );

            const nextTarget: PanelSectionHoverTarget = {
                area: "bar",
                leafSectionId,
                anchorLeafSectionId: committedLeafSectionId,
                panelSectionId: panelSection.id,
                targetIndex,
            };

            if (
                dragSession.currentPanelSectionId !== panelSection.id ||
                dragSession.hoverTarget?.targetIndex !== targetIndex ||
                dragSession.hoverTarget?.panelSectionId !== panelSection.id ||
                dragSession.hoverTarget?.area !== "bar"
            ) {
                onMovePanel({
                    sourceSectionId: dragSession.currentPanelSectionId,
                    targetSectionId: panelSection.id,
                    panelId: dragSession.panelId,
                    targetIndex,
                });
                updateDragSession({
                    ...dragSession,
                    activityTarget: null,
                    currentPanelSectionId: panelSection.id,
                    currentLeafSectionId: leafSectionId,
                    hoverTarget: nextTarget,
                });
            }
            return;
        }

        if (insideContent && contentBounds) {
            const nextTarget: PanelSectionHoverTarget = {
                area: "content",
                leafSectionId,
                anchorLeafSectionId: resolvePreviewAnchorLeafSectionId({
                    currentTarget: dragSession.hoverTarget,
                    isCurrentSectionContentTarget,
                    committedLeafSectionId,
                }),
                panelSectionId: panelSection.id,
                splitSide: resolvePreviewSplitSide(
                    contentBounds,
                    dragSession.pointerX,
                    dragSession.pointerY,
                    {
                        top: "top",
                        bottom: "bottom",
                    } as const,
                ),
                contentBounds,
            };

            if (!arePreviewHoverTargetsEqual(dragSession.hoverTarget, nextTarget, getPanelSectionHoverTargetId)) {
                updateDragSession({
                    ...dragSession,
                    hoverTarget: nextTarget,
                });
            }
            return;
        }

        if (dragSession.hoverTarget?.leafSectionId === leafSectionId) {
            updateDragSession({
                ...dragSession,
                hoverTarget: null,
            });
        }
    }, [
        committedLeafSectionId,
        dragSession,
        interactive,
        allowContentPreview,
        leafSectionId,
        updateDragSession,
        onMovePanel,
        panelSection.id,
        panelSection.isCollapsed,
        panelSection.panels,
    ]);

    useEffect(() => {
        if (!interactive || !activityDragSession || activityDragSession.phase !== "dragging") {
            return;
        }

        const barRect = barRef.current?.getBoundingClientRect() ?? null;
        const insideBar = Boolean(
            barRect &&
            activityDragSession.pointerX >= barRect.left &&
            activityDragSession.pointerX <= barRect.right &&
            activityDragSession.pointerY >= barRect.top &&
            activityDragSession.pointerY <= barRect.bottom,
        );

        if (insideBar) {
            const targetIndex = getPanelTargetIndexFromPointer(
                activityDragSession.pointerX,
                slotRefs.current,
                panelSection.panels.map((panel) => panel.id),
                activityDragSession.panelTarget?.panelSectionId === panelSection.id
                    ? activityDragSession.panelTarget.targetIndex
                    : undefined,
            );

            if (
                activityDragSession.panelTarget?.panelSectionId !== panelSection.id ||
                activityDragSession.panelTarget.targetIndex !== targetIndex
            ) {
                updateActivityDragSession({
                    ...activityDragSession,
                    panelTarget: {
                        panelSectionId: panelSection.id,
                        targetIndex,
                    },
                });
            }
            return;
        }

        if (activityDragSession.panelTarget?.panelSectionId === panelSection.id) {
            updateActivityDragSession({
                ...activityDragSession,
                panelTarget: null,
            });
        }
    }, [activityDragSession, interactive, panelSection.id, panelSection.panels, updateActivityDragSession]);

    const pointerInsideBar = Boolean(
        interactive &&
        dragSession?.phase === "dragging" &&
        dragSession.hoverTarget?.area === "bar" &&
        dragSession.hoverTarget.panelSectionId === panelSection.id,
    );
    const pointerInsideContent = Boolean(
        (interactive || allowContentPreview) &&
        dragSession?.phase === "dragging" &&
        dragSession.hoverTarget?.area === "content" &&
        dragSession.hoverTarget.panelSectionId === panelSection.id &&
        dragSession.hoverTarget.splitSide,
    );
    const activityPointerInsideBar = Boolean(activityDropIndex !== null);

    return (
        <div
            ref={rootRef}
            className="layout-v2-panel-section"
            data-panel-section-id={panelSection.id}
            {...mergeLayoutFocusAttributes(
                {
                    "data-layout-role": "panel-section",
                    "data-layout-panel-section-id": panelSection.id,
                },
                focusBridge?.getSectionAttributes?.(panelSection),
            )}
        >
            <div
                ref={barRef}
                className={[
                    "layout-v2-panel-section__bar",
                    pointerInsideBar || activityPointerInsideBar ? "layout-v2-panel-section__bar--drag-over" : "",
                ].filter(Boolean).join(" ")}
            >
                <div className="layout-v2-panel-section__bar-list">
                    {panelSection.panels.map((panel, index) => (
                        <div
                            key={panel.id}
                            ref={(element) => {
                                slotRefs.current[panel.id] = element;
                            }}
                            className="layout-v2-panel-section__panel-slot"
                        >
                            {activityDropIndex === index ? (
                                <div className="layout-v2-panel-section__panel-placeholder" aria-hidden="true" />
                            ) : null}
                            {draggingPanelId === panel.id ? (
                                <div className="layout-v2-panel-section__panel-placeholder" aria-hidden="true" />
                            ) : (
                                <button
                                    type="button"
                                    {...mergeLayoutFocusAttributes(
                                        {
                                            "data-layout-role": "panel",
                                            "data-layout-panel-section-id": panelSection.id,
                                            "data-layout-panel-id": panel.id,
                                        },
                                        focusBridge?.getPanelAttributes?.(panelSection, panel),
                                    )}
                                    className={[
                                        "layout-v2-panel-section__panel-tab",
                                        panelSection.focusedPanelId === panel.id ? "layout-v2-panel-section__panel-tab--focused" : "",
                                    ].filter(Boolean).join(" ")}
                                    aria-label={panel.label}
                                    title={panel.label}
                                    onClick={() => {
                                        onActivatePanel?.(panel.id);
                                        if (panel.activationMode !== "action") {
                                            onFocusPanel(panel.id);
                                        }
                                    }}
                                    onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                                        if (!interactive || event.button !== 0) {
                                            return;
                                        }

                                        updateDragSession(buildPanelSectionDragSession({
                                            leafSectionId,
                                            panelSectionId: panelSection.id,
                                            panelId: panel.id,
                                            index,
                                            pointerId: event.pointerId,
                                            clientX: event.clientX,
                                            clientY: event.clientY,
                                            label: panel.label,
                                            symbol: panel.symbol,
                                            content: panel.content,
                                            tone: panel.tone,
                                        }));
                                    }}
                                >
                                    {renderPanelTab ? renderPanelTab(panel) : (
                                        <span className="layout-v2-panel-section__panel-symbol">{panel.symbol}</span>
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                    {activityDropIndex === panelSection.panels.length ? (
                        <div className="layout-v2-panel-section__panel-placeholder" aria-hidden="true" />
                    ) : null}
                </div>
                <button
                    type="button"
                    className="layout-v2-panel-section__toggle"
                    onClick={onToggleCollapsed}
                    aria-label={panelSection.isCollapsed ? "Expand pane content" : "Collapse pane content"}
                >
                    {panelSection.isCollapsed ? "▾" : "▴"}
                </button>
            </div>

            <div
                ref={contentRef}
                {...mergeLayoutFocusAttributes(
                    {
                        "data-layout-role": "panel-content",
                        "data-layout-panel-section-id": panelSection.id,
                        "data-layout-panel-id": activePanel?.id,
                    },
                    focusBridge?.getContentAttributes?.(panelSection, activePanel),
                )}
                className={[
                    "layout-v2-panel-section__content",
                    panelSection.isCollapsed ? "layout-v2-panel-section__content--collapsed" : "",
                    pointerInsideContent ? "layout-v2-panel-section__content--drag-over" : "",
                ].filter(Boolean).join(" ")}
            >
                <div className="layout-v2-panel-section__content-inner">
                    {activePanel && !shouldHideActivePane ? (
                        <div className={["layout-v2-panel-section__pane", getPanelToneClassName(activePanel.tone)].join(" ")}>
                            <div className="layout-v2-panel-section__pane-header">
                                <span className="layout-v2-panel-section__pane-symbol">{activePanel.symbol}</span>
                                <span className="layout-v2-panel-section__pane-title">{activePanel.label}</span>
                            </div>
                            <div className="layout-v2-panel-section__pane-body">
                                {renderPanelContent ? renderPanelContent(activePanel) : activePanel.content}
                            </div>
                        </div>
                    ) : (
                        <div className="layout-v2-panel-section__empty-pane">Drop panel here or pick one from the bar</div>
                    )}
                </div>
            </div>
        </div>
    );
}