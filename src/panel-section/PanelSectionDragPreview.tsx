import { type ReactNode } from "react";
import { type PanelSectionDragSession } from "./panelSectionDrag";
import "./panelSection.css";

export function PanelSectionDragPreview(props: {
    session: PanelSectionDragSession | null;
    renderTab?: (session: PanelSectionDragSession) => ReactNode;
}): ReactNode {
    const { session, renderTab } = props;

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
