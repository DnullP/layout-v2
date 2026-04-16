import { useEffect, useRef, type ReactNode } from "react";
import {
    advanceTabSectionDragSessionPointer,
    type TabSectionDragSession,
} from "./tabSectionDrag";
import { type TabSectionTabDefinition } from "./tabSectionModel";
import "./tabSection.css";

function getCardToneClassName(tone: TabSectionTabDefinition["tone"]): string {
    if (!tone || tone === "neutral") {
        return "layout-v2-tab-section__card--neutral";
    }

    return `layout-v2-tab-section__card--${tone}`;
}

export function TabSectionDragPreview(props: {
    session: TabSectionDragSession | null;
    onSessionChange?: (session: TabSectionDragSession | null) => void;
    onSessionEnd?: (session: TabSectionDragSession) => void;
}): ReactNode {
    const { session, onSessionChange, onSessionEnd } = props;
    const sessionRef = useRef<TabSectionDragSession | null>(session);

    sessionRef.current = session;

    useEffect(() => {
        if (!session || !onSessionChange) {
            return;
        }
        const handleSessionChange: NonNullable<typeof onSessionChange> = onSessionChange;

        const currentSession = session;
        let pendingEvent: PointerEvent | null = null;
        let frameId = 0;

        function flushPointerMove(): TabSectionDragSession | null {
            frameId = 0;
            const event = pendingEvent;
            pendingEvent = null;
            if (!event) {
                return sessionRef.current;
            }

            const baseSession = sessionRef.current ?? currentSession;
            const nextSession = advanceTabSectionDragSessionPointer(
                baseSession,
                event.clientX,
                event.clientY,
            );

            if (nextSession === baseSession) {
                return baseSession;
            }

            sessionRef.current = nextSession;
            handleSessionChange(nextSession);
            return nextSession;
        }

        function handlePointerMove(event: PointerEvent): void {
            const baseSession = sessionRef.current ?? currentSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            pendingEvent = event;
            if (!frameId) {
                frameId = window.requestAnimationFrame(flushPointerMove);
            }
        }

        function handlePointerEnd(event: PointerEvent): void {
            const baseSession = sessionRef.current ?? currentSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            let finalSession = sessionRef.current ?? currentSession;
            if (frameId) {
                window.cancelAnimationFrame(frameId);
                finalSession = flushPointerMove() ?? finalSession;
            }

            sessionRef.current = null;
            handleSessionChange(null);

            if (finalSession?.phase === "dragging") {
                onSessionEnd?.(finalSession);
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
    }, [session, onSessionChange, onSessionEnd]);

    if (!session || session.phase !== "dragging") {
        return null;
    }

    const previewVariant = session.hoverTarget?.area === "content"
        ? "card"
        : "tab";

    return (
        <div
            className="layout-v2-tab-section-drag-preview"
            style={{
                transform: `translate3d(${session.pointerX + 18}px, ${session.pointerY + 18}px, 0)`,
            }}
            aria-hidden="true"
        >
            {previewVariant === "card" ? (
                <div className={[
                    "layout-v2-tab-section-drag-preview--card",
                    getCardToneClassName(session.tone),
                ].join(" ")}>
                    <div className="layout-v2-tab-section-drag-preview__card-title">{session.title}</div>
                    <div className="layout-v2-tab-section-drag-preview__card-body">{session.content}</div>
                </div>
            ) : (
                <div className="layout-v2-tab-section-drag-preview--tab">
                    <span className="layout-v2-tab-section-drag-preview__tab-title">{session.title}</span>
                    <span className="layout-v2-tab-section-drag-preview__tab-close">×</span>
                </div>
            )}
        </div>
    );
}