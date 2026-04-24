import { useEffect, useRef, type ReactNode } from "react";
import {
    advancePanelSectionDragSessionPointer,
    markPanelSectionDragSessionEnded,
    resolvePanelSectionPointerEndHoverTarget,
    type PanelSectionDragSession,
} from "./panelSectionDrag";
import "./panelSection.css";

export function PanelSectionDragPreview(props: {
    session: PanelSectionDragSession | null;
    onSessionChange?: (session: PanelSectionDragSession | null) => void;
    onSessionEnd?: (session: PanelSectionDragSession) => void;
    renderTab?: (session: PanelSectionDragSession) => ReactNode;
}): ReactNode {
    const { session, onSessionChange, onSessionEnd, renderTab } = props;
    const sessionRef = useRef<PanelSectionDragSession | null>(session);

    sessionRef.current = session;

    useEffect(() => {
        if (!session || !onSessionChange) {
            return;
        }
        const handleSessionChange: NonNullable<typeof onSessionChange> = onSessionChange;

        const currentSession = session;

        function handlePointerMove(event: PointerEvent): void {
            const baseSession = sessionRef.current ?? currentSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            const nextSession = advancePanelSectionDragSessionPointer(
                baseSession,
                event.clientX,
                event.clientY,
            );

            if (nextSession === baseSession) {
                return;
            }

            sessionRef.current = nextSession;
            handleSessionChange(nextSession);
        }

        function handlePointerEnd(event: PointerEvent): void {
            const baseSession = sessionRef.current ?? currentSession;
            if (event.pointerId !== baseSession.pointerId) {
                return;
            }

            let finalSession = sessionRef.current ?? currentSession;

            const resolvedHoverTarget = resolvePanelSectionPointerEndHoverTarget(event.clientX, event.clientY);
            if (resolvedHoverTarget) {
                finalSession = resolvedHoverTarget.area === "bar"
                    ? {
                        ...finalSession,
                        currentPanelSectionId: resolvedHoverTarget.panelSectionId,
                        currentLeafSectionId: resolvedHoverTarget.leafSectionId,
                        hoverTarget: resolvedHoverTarget,
                    }
                    : {
                        ...finalSession,
                        hoverTarget: resolvedHoverTarget,
                    };
            }

            markPanelSectionDragSessionEnded(finalSession);
            sessionRef.current = null;
            handleSessionChange(null);

            if (finalSession.phase === "dragging") {
                onSessionEnd?.(finalSession);
            }
        }

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
        };
    }, [session, onSessionChange, onSessionEnd]);

    if (!session || session.phase !== "dragging") {
        return null;
    }

    return (
        <div
            className="layout-v2-panel-section-drag-preview"
            style={{
                transform: `translate3d(${session.pointerX - 15}px, ${session.pointerY - 15}px, 0)`,
            }}
            aria-hidden="true"
        >
            {renderTab ? renderTab(session) : session.symbol}
        </div>
    );
}
