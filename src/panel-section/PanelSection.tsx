import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
    createPanelSectionDragSessionId,
    isEndedPanelSectionDragSession,
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
const PANEL_BAR_CONTENT_BOUNDARY_HYSTERESIS_PX = 10;

function isPointerInsidePreviewBoundsWithPadding(
    bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null,
    pointerX: number,
    pointerY: number,
    paddingPx: number,
): boolean {
    if (!bounds) {
        return false;
    }

    return (
        pointerX >= bounds.left - paddingPx &&
        pointerX <= bounds.right + paddingPx &&
        pointerY >= bounds.top - paddingPx &&
        pointerY <= bounds.bottom + paddingPx
    );
}

function buildPanelSectionDragSession(
    payload: PanelSectionPointerPressPayload,
): PanelSectionDragSession {
    return {
        sessionId: createPanelSectionDragSessionId(),
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
    hideBarWhenEmpty?: boolean;
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
        hideBarWhenEmpty = false,
        dragSession: controlledDragSession,
        activityDragSession,
        focusBridge,
        interactive = true,
        allowContentPreview = false,
        renderPanelTab,
        renderPanelContent,
        onDragSessionChange,
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
    const previousPanelsRef = useRef(panelSection?.panels);
    const hoverTargetClearFrameRef = useRef<number>(0);
    const rawDragSession = controlledDragSession ?? internalDragSession;
    const dragSession = rawDragSession && !isEndedPanelSectionDragSession(rawDragSession)
        ? rawDragSession
        : null;
    const dragSessionRef = useRef<PanelSectionDragSession | null>(dragSession);
    const setDragSessionState = onDragSessionChange ?? setInternalDragSession;
    const updateDragSession = useCallback((nextSession: PanelSectionDragSession | null): void => {
        if (isEndedPanelSectionDragSession(nextSession)) {
            return;
        }

        setDragSessionState(nextSession);
    }, [setDragSessionState]);
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
    const hasPanels = panelSection.panels.length > 0;
    const shouldRenderBar = hasPanels || !hideBarWhenEmpty;
    const draggingPanelId = dragSession?.phase === "dragging" && dragSession.currentPanelSectionId === panelSection.id
        ? dragSession.panelId
        : null;
    const activityDropIndex = activityDragSession?.panelTarget?.panelSectionId === panelSection.id
        ? activityDragSession.panelTarget.targetIndex
        : null;
    const canPreviewRetargetContent = Boolean(
        allowContentPreview &&
        dragSession &&
        !panelSection.panels.some((panel) => panel.id === dragSession.panelId),
    );

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
        const draggingId = dragSession?.phase === "dragging" ? dragSession.panelId : null;
        // Only animate when panels actually reordered; position changes caused by
        // external layout shifts (e.g. section resize) should just update the ref.
        const panelsReordered = previousPanelsRef.current !== panelSection.panels;
        previousPanelsRef.current = panelSection.panels;

        panelSection.panels.forEach((panel) => {
            const slotElement = slotRefs.current[panel.id];
            if (!slotElement) {
                return;
            }

            // During an active drag, clear ALL transforms so that
            // getBoundingClientRect() in the hover-detection effect returns
            // accurate natural positions.  FLIP reorder animations applied
            // mid-drag cause the animated visual offsets to feed back into
            // getPanelTargetIndexFromPointer, producing oscillating target
            // indices that trigger "Maximum update depth exceeded".
            if (draggingId) {
                slotElement.style.transition = "none";
                slotElement.style.transform = "none";
                nextSlotLefts[panel.id] = slotElement.getBoundingClientRect().left;
                return;
            }

            const nextLeft = slotElement.getBoundingClientRect().left;
            const previousLeft = previousSlotLeftsRef.current[panel.id];
            nextSlotLefts[panel.id] = nextLeft;

            if (!panelsReordered || previousLeft === undefined || previousLeft === nextLeft) {
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
    }, [dragSession?.phase, dragSession?.panelId, panelSection.panels]);

    useLayoutEffect(() => {
        if ((!interactive && !canPreviewRetargetContent) || !dragSession || dragSession.phase !== "dragging") {
            if (hoverTargetClearFrameRef.current) {
                window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
                hoverTargetClearFrameRef.current = 0;
            }
            return;
        }

        const barRect = barRef.current?.getBoundingClientRect() ?? null;
        const contentRect = contentRef.current?.getBoundingClientRect() ?? null;
        const isCurrentSectionBarTarget = Boolean(
            dragSession.hoverTarget?.area === "bar" &&
            dragSession.hoverTarget.panelSectionId === panelSection.id,
        );
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
        const shouldPreferStableBarTarget = Boolean(
            interactive &&
            isCurrentSectionBarTarget &&
            barRect &&
            dragSession.pointerX >= barRect.left &&
            dragSession.pointerX <= barRect.right &&
            dragSession.pointerY >= barRect.top &&
            dragSession.pointerY <= barRect.bottom + PANEL_BAR_CONTENT_BOUNDARY_HYSTERESIS_PX,
        );
        const shouldPreferStableContentBoundary = Boolean(
            isCurrentSectionContentTarget &&
            isPointerInsidePreviewBoundsWithPadding(
                contentBounds,
                dragSession.pointerX,
                dragSession.pointerY,
                PANEL_BAR_CONTENT_BOUNDARY_HYSTERESIS_PX,
            ),
        );
        const stableContentTarget = shouldPreferStableContentTarget || shouldPreferStableContentBoundary;
        const insideBar = Boolean(
            interactive &&
            !stableContentTarget &&
            (shouldPreferStableBarTarget || (
                barRect &&
                dragSession.pointerX >= barRect.left &&
                dragSession.pointerX <= barRect.right &&
                dragSession.pointerY >= barRect.top &&
                dragSession.pointerY <= barRect.bottom
            )),
        );
        const insideContent = !panelSection.isCollapsed && (
            isPointerInsidePreviewBounds(
                contentBounds,
                dragSession.pointerX,
                dragSession.pointerY,
            ) || shouldPreferStableContentBoundary
        );

        if (insideBar) {
            if (hoverTargetClearFrameRef.current) {
                window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
                hoverTargetClearFrameRef.current = 0;
            }
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
            if (hoverTargetClearFrameRef.current) {
                window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
                hoverTargetClearFrameRef.current = 0;
            }
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
                    {
                        currentSplitSide: isCurrentSectionContentTarget ? dragSession.hoverTarget?.splitSide ?? null : null,
                    },
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
            if (!hoverTargetClearFrameRef.current) {
                hoverTargetClearFrameRef.current = window.requestAnimationFrame(() => {
                    hoverTargetClearFrameRef.current = 0;
                    const latestSession = dragSessionRef.current;
                    if (!latestSession || latestSession.hoverTarget?.leafSectionId !== leafSectionId) {
                        return;
                    }

                    updateDragSession({
                        ...latestSession,
                        hoverTarget: null,
                    });
                });
            }
        }

        return () => {
            if (hoverTargetClearFrameRef.current) {
                window.cancelAnimationFrame(hoverTargetClearFrameRef.current);
                hoverTargetClearFrameRef.current = 0;
            }
        };
    }, [
        canPreviewRetargetContent,
        committedLeafSectionId,
        dragSession,
        interactive,
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
        const contentRect = contentRef.current?.getBoundingClientRect() ?? null;
        const isCurrentSectionContentTarget = Boolean(
            activityDragSession.contentTarget?.area === "content" &&
            activityDragSession.contentTarget.panelSectionId === panelSection.id,
        );
        const { contentBounds, shouldPreferStableContentTarget } = resolvePreviewContentSession({
            currentTarget: activityDragSession.contentTarget,
            isCurrentSectionContentTarget,
            contentRect,
            pointerX: activityDragSession.pointerX,
            pointerY: activityDragSession.pointerY,
        });
        const insideBar = Boolean(
            !shouldPreferStableContentTarget &&
            barRect &&
            activityDragSession.pointerX >= barRect.left &&
            activityDragSession.pointerX <= barRect.right &&
            activityDragSession.pointerY >= barRect.top &&
            activityDragSession.pointerY <= barRect.bottom,
        );
        const insideContent = !panelSection.isCollapsed && isPointerInsidePreviewBounds(
            contentBounds,
            activityDragSession.pointerX,
            activityDragSession.pointerY,
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
                    contentTarget: null,
                });
            }
            return;
        }

        if (insideContent && contentBounds) {
            const nextTarget: PanelSectionHoverTarget = {
                area: "content",
                leafSectionId,
                anchorLeafSectionId: resolvePreviewAnchorLeafSectionId({
                    currentTarget: activityDragSession.contentTarget,
                    isCurrentSectionContentTarget,
                    committedLeafSectionId,
                }),
                panelSectionId: panelSection.id,
                splitSide: resolvePreviewSplitSide(
                    contentBounds,
                    activityDragSession.pointerX,
                    activityDragSession.pointerY,
                    {
                        top: "top",
                        bottom: "bottom",
                    } as const,
                    {
                        currentSplitSide: isCurrentSectionContentTarget
                            ? activityDragSession.contentTarget?.splitSide ?? null
                            : null,
                    },
                ),
                contentBounds,
            };

            if (!arePreviewHoverTargetsEqual(activityDragSession.contentTarget, nextTarget, getPanelSectionHoverTargetId)) {
                updateActivityDragSession({
                    ...activityDragSession,
                    panelTarget: null,
                    contentTarget: nextTarget,
                });
            }
            return;
        }

        const needsClearPanelTarget = activityDragSession.panelTarget?.panelSectionId === panelSection.id;
        const needsClearContentTarget = activityDragSession.contentTarget?.leafSectionId === leafSectionId;

        if (needsClearPanelTarget || needsClearContentTarget) {
            updateActivityDragSession({
                ...activityDragSession,
                panelTarget: needsClearPanelTarget ? null : activityDragSession.panelTarget,
                contentTarget: needsClearContentTarget ? null : activityDragSession.contentTarget,
            });
        }
    }, [activityDragSession, committedLeafSectionId, interactive, leafSectionId, panelSection.id, panelSection.isCollapsed, panelSection.panels, updateActivityDragSession]);

    const pointerInsideBar = Boolean(
        interactive &&
        dragSession?.phase === "dragging" &&
        dragSession.hoverTarget?.area === "bar" &&
        dragSession.hoverTarget.panelSectionId === panelSection.id,
    );
    const pointerInsideContent = Boolean(
        (interactive || canPreviewRetargetContent) &&
        dragSession?.phase === "dragging" &&
        dragSession.hoverTarget?.area === "content" &&
        dragSession.hoverTarget.panelSectionId === panelSection.id &&
        dragSession.hoverTarget.splitSide,
    );
    const activityPointerInsideBar = Boolean(activityDropIndex !== null);
    const activityPointerInsideContent = Boolean(
        interactive &&
        activityDragSession?.phase === "dragging" &&
        activityDragSession.contentTarget?.area === "content" &&
        activityDragSession.contentTarget.panelSectionId === panelSection.id &&
        activityDragSession.contentTarget.splitSide,
    );

    return (
        <div
            ref={rootRef}
            className="layout-v2-panel-section"
            data-panel-section-id={panelSection.id}
            data-layout-leaf-section-id={leafSectionId}
            data-layout-committed-leaf-section-id={committedLeafSectionId}
            {...mergeLayoutFocusAttributes(
                {
                    "data-layout-role": "panel-section",
                    "data-layout-panel-section-id": panelSection.id,
                },
                focusBridge?.getSectionAttributes?.(panelSection),
            )}
        >
            {shouldRenderBar ? (
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
            ) : null}

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
                    pointerInsideContent || activityPointerInsideContent ? "layout-v2-panel-section__content--drag-over" : "",
                ].filter(Boolean).join(" ")}
            >
                <div className="layout-v2-panel-section__content-inner">
                    {activePanel ? (
                        <div className={["layout-v2-panel-section__pane", getPanelToneClassName(activePanel.tone)].join(" ")}>
                            <div
                                className="layout-v2-panel-section__pane-header"
                                {...(focusBridge?.getHeaderAttributes?.(panelSection, activePanel) ?? {})}
                            >
                                <span className="layout-v2-panel-section__pane-symbol">{activePanel.symbol}</span>
                                <span className="layout-v2-panel-section__pane-title">{activePanel.label}</span>
                            </div>
                            <div className="layout-v2-panel-section__pane-body">
                                {renderPanelContent ? renderPanelContent(activePanel) : activePanel.content}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="layout-v2-panel-section__empty-pane"
                            {...(focusBridge?.getEmptyAttributes?.(panelSection) ?? {})}
                        >{shouldRenderBar ? "Drop panel here or pick one from the bar" : "Drop panel here"}</div>
                    )}
                </div>
            </div>
        </div>
    );
}