/**
 * @module host/layout-v2/example/usage/vscodeWorkbenchOverlayExample
 * @description VSCodeWorkbench overlay tab drag preview 示例，用于锚定重型宿主的预销毁交互命中。
 */

import { type ReactNode } from "react";
import { VSCodeWorkbench } from "../../src/vscode-layout/VSCodeWorkbench";

function renderTabContent(title: string): ReactNode {
    return (
        <div style={{ padding: 16 }}>
            <strong>{title}</strong>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
                Overlay drag preview fixture
            </p>
        </div>
    );
}

export function VSCodeWorkbenchOverlayUsageExample(): ReactNode {
    return (
        <div className="layout-v2-example__app" data-testid="vscode-workbench-overlay-example">
            <VSCodeWorkbench
                initialTabs={[
                    { id: "welcome", title: "Welcome", component: "welcome" },
                    { id: "review", title: "Review", component: "review" },
                    { id: "metrics", title: "Metrics", component: "metrics" },
                ]}
                tabComponents={{
                    welcome: () => renderTabContent("Welcome"),
                    review: () => renderTabContent("Review"),
                    metrics: () => renderTabContent("Metrics"),
                }}
                tabDragPreviewRenderMode="overlay"
                preserveActiveTabContentDuringDrag
                renderTabContentInDragPreviewLayout={false}
                className="layout-v2-example__fullscreen-layout"
            />
        </div>
    );
}
