import { type ReactNode } from "react";
import { type TabSectionDragSession } from "./tabSectionDrag";
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
}): ReactNode {
    const { session } = props;

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