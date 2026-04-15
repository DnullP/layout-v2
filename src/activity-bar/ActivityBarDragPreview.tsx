import { type ReactNode } from "react";
import { type ActivityBarDragSession } from "./activityBarDrag";
import { type ActivityBarStateItem } from "./activityBarModel";
import "./activityBar.css";

export function ActivityBarDragPreview(props: {
    session: ActivityBarDragSession | null;
    bar: ActivityBarStateItem | null;
    renderIcon?: (icon: ActivityBarStateItem["icons"][number]) => ReactNode;
}): ReactNode {
    const { session, bar, renderIcon } = props;

    if (!session || session.phase !== "dragging" || !bar) {
        return null;
    }

    const icon = bar.icons.find((i) => i.id === session.iconId);
    if (!icon) {
        return null;
    }

    return (
        <div
            className="layout-v2-activity-bar-drag-preview"
            style={{
                transform: `translate3d(${session.pointerX - 20}px, ${session.pointerY - 20}px, 0)`,
            }}
            aria-hidden="true"
        >
            {renderIcon ? renderIcon(icon) : icon.symbol}
        </div>
    );
}
