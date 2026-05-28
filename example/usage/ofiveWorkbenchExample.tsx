/**
 * @module host/layout-v2/example/usage/ofiveWorkbenchExample
 * @description ofive workbench fixture for layout-v2 e2e coverage.
 *   This surface mirrors ofive's current layout integration while keeping
 *   business data, Tauri calls, and plugin stores out of the shared engine.
 */

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
    VSCodeWorkbench,
    type TabDragPreviewContentRenderContext,
    type WorkbenchActivityDefinition,
    type WorkbenchApi,
    type WorkbenchExternalTabDragResolver,
    type WorkbenchPanelContext,
    type WorkbenchPanelDefinition,
    type WorkbenchTabApi,
    type WorkbenchTabDefinition,
    type WorkbenchTabPayload,
    type WorkbenchSidebarState,
    type WorkbenchPanelLayoutSnapshot,
    type WorkbenchLayoutSnapshot,
    readWorkbenchTabPayload,
    type TabSectionTabDefinition,
} from "../../src";

const SETTINGS_ACTIVITY_ID = "__settings__";
const EXTERNAL_OFIVE_FILE_MIME = "application/x-layout-v2-ofive-file";
const EXTERNAL_OFIVE_FILE_FALLBACK = "text/plain";

const OFIVE_ACTIVITIES: WorkbenchActivityDefinition[] = [
    { id: "files", label: "Explorer", bar: "left", section: "top", activationMode: "focus", icon: "E" },
    { id: "search", label: "Search", bar: "left", section: "top", activationMode: "focus", icon: "S" },
    { id: "knowledge-graph", label: "Knowledge Graph", bar: "left", section: "top", activationMode: "action", icon: "G" },
    { id: "calendar", label: "Calendar", bar: "left", section: "top", activationMode: "action", icon: "C" },
    { id: "architecture-devtools", label: "Architecture Devtools", bar: "left", section: "top", activationMode: "action", icon: "A" },
    { id: "task-board", label: "Task Board", bar: "left", section: "top", activationMode: "action", icon: "T" },
    { id: "test-message", label: "Test Message", bar: "left", section: "bottom", activationMode: "action", icon: "M" },
    { id: SETTINGS_ACTIVITY_ID, label: "Settings", bar: "left", section: "bottom", activationMode: "action", icon: "*" },
    { id: "ai-chat", label: "AI Chat", bar: "right", section: "top", activationMode: "focus", icon: "AI" },
    { id: "outline", label: "Outline", bar: "right", section: "top", activationMode: "focus", icon: "O" },
];

const OFIVE_PANELS: WorkbenchPanelDefinition[] = [
    { id: "files", label: "Explorer", activityId: "files", position: "left", order: 1, icon: "E" },
    { id: "project-reader", label: "Project Reader", activityId: "files", position: "left", order: 2, icon: "P" },
    { id: "agent-skills", label: "Agent Skills", activityId: "files", position: "left", order: 3, icon: "K" },
    { id: "search", label: "Search", activityId: "search", position: "left", order: 1, icon: "S" },
    { id: "ai-chat", label: "AI Chat", activityId: "ai-chat", position: "right", order: 1, icon: "AI" },
    { id: "outline", label: "Outline", activityId: "outline", position: "right", order: 2, icon: "O" },
    { id: "backlinks", label: "Backlinks", activityId: "outline", position: "right", order: 3, icon: "B" },
    { id: "calendar-panel", label: "Calendar", activityId: "calendar", position: "right", order: 4, icon: "C" },
];

const INITIAL_TABS: WorkbenchTabDefinition[] = [
    {
        id: "file:notes/guide.md",
        title: "guide.md",
        component: "codemirror",
        params: {
            path: "notes/guide.md",
            heading: "Guide",
            body: "Pinned notes, backlinks, and current editing context.",
        },
    },
    {
        id: "file:notes/tasks.md",
        title: "tasks.md",
        component: "codemirror",
        params: {
            path: "notes/tasks.md",
            heading: "Tasks",
            body: "Task board source note with actionable markdown items.",
        },
    },
    {
        id: "canvas:roadmap.canvas",
        title: "roadmap.canvas",
        component: "canvas",
        params: {
            path: "roadmap.canvas",
        },
    },
];

const INITIAL_SIDEBAR_STATE: WorkbenchSidebarState = {
    left: {
        visible: true,
        activeActivityId: "files",
        activePanelId: "files",
    },
    right: {
        visible: true,
        activeActivityId: "outline",
        activePanelId: "outline",
    },
};

declare global {
    interface Window {
        __LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__?: {
            sidebar: number;
            sectionRatio: number;
            panelLayout: number;
            layoutSnapshot: number;
            activeTab: number;
            closedTab: number;
            activityBars: number;
            activityDrop: number;
            activatedActivity: number;
        };
        __LAYOUT_V2_OFIVE_LAST_SIDEBAR__?: WorkbenchSidebarState;
        __LAYOUT_V2_OFIVE_LAST_LAYOUT__?: WorkbenchLayoutSnapshot;
        __LAYOUT_V2_OFIVE_LAST_PANEL_LAYOUT__?: WorkbenchPanelLayoutSnapshot;
        __LAYOUT_V2_OFIVE_LAST_ACTIVE_TAB__?: string | null;
        __LAYOUT_V2_OFIVE_LAST_CLOSED_TAB__?: string;
        __LAYOUT_V2_OFIVE_LAST_ACTIVITY_DROP__?: { iconId: string; newPanelSectionId: string };
        __LAYOUT_V2_OFIVE_LAST_ACTIVITY__?: string;
        __LAYOUT_V2_OFIVE_API__?: WorkbenchApi | null;
    }
}

function ensureCounts(): NonNullable<Window["__LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__"]> {
    if (!window.__LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__) {
        window.__LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__ = {
            sidebar: 0,
            sectionRatio: 0,
            panelLayout: 0,
            layoutSnapshot: 0,
            activeTab: 0,
            closedTab: 0,
            activityBars: 0,
            activityDrop: 0,
            activatedActivity: 0,
        };
    }

    return window.__LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__;
}

function asText(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function createFileTab(path: string): WorkbenchTabDefinition {
    const normalizedPath = path.trim().replace(/^\/+/, "") || "untitled.md";
    const title = normalizedPath.split("/").pop() ?? normalizedPath;

    if (normalizedPath.endsWith(".canvas")) {
        return {
            id: `canvas:${normalizedPath}`,
            title,
            component: "canvas",
            params: { path: normalizedPath },
        };
    }

    if (/\.(png|jpg|jpeg|webp)$/i.test(normalizedPath)) {
        return {
            id: `image:${normalizedPath}`,
            title,
            component: "imageviewer",
            params: { path: normalizedPath },
        };
    }

    return {
        id: `file:${normalizedPath}`,
        title,
        component: "codemirror",
        params: {
            path: normalizedPath,
            heading: title.replace(/\.(md|markdown)$/i, ""),
            body: `External file opened through ofive-style drag: ${normalizedPath}`,
        },
    };
}

function OfiveIcon(props: { value: ReactNode }): ReactNode {
    return <span className="ofive-workbench-fixture__icon">{props.value}</span>;
}

function PanelContent(props: { panelId: string; context: WorkbenchPanelContext }): ReactNode {
    const { panelId, context } = props;
    const openPanelTab = (): void => {
        context.openTab({
            id: `panel:${panelId}`,
            title: `${panelId}.panel`,
            component: "inspector",
            params: { panelId },
        });
    };

    return (
        <div className="ofive-workbench-fixture__panel-content" data-testid={`ofive-panel-content-${panelId}`}>
            <div className="ofive-workbench-fixture__panel-kicker">ofive panel</div>
            <strong>{panelId}</strong>
            <span>Active tab: {context.activeTabId ?? "none"}</span>
            <button type="button" onClick={openPanelTab}>Open panel tab</button>
        </div>
    );
}

function MarkdownTab(props: { params: Record<string, unknown>; api: WorkbenchTabApi }): ReactNode {
    const { params, api } = props;
    useEffect(() => {
        api.markContentReady();
    }, [api.id]);

    return (
        <div className="ofive-workbench-fixture__tab ofive-workbench-fixture__tab--markdown" data-testid={`ofive-tab-${api.id}`}>
            <header>
                <span>CodeMirror</span>
                <button type="button" onClick={() => api.setTitle(`${asText(params.heading) || "Note"} updated`)}>
                    Rename
                </button>
            </header>
            <h2>{asText(params.heading) || asText(params.path) || api.id}</h2>
            <p>{asText(params.body) || "Markdown editor content is represented by a light fixture."}</p>
            <pre>{asText(params.path)}</pre>
        </div>
    );
}

function CanvasTab(props: { params: Record<string, unknown>; api: WorkbenchTabApi }): ReactNode {
    return (
        <div className="ofive-workbench-fixture__tab ofive-workbench-fixture__tab--canvas" data-testid={`ofive-tab-${props.api.id}`}>
            <header>Canvas</header>
            <h2>{asText(props.params.path) || "Untitled canvas"}</h2>
            <div className="ofive-workbench-fixture__canvas-preview" />
        </div>
    );
}

function ImageViewerTab(props: { params: Record<string, unknown>; api: WorkbenchTabApi }): ReactNode {
    return (
        <div className="ofive-workbench-fixture__tab" data-testid={`ofive-tab-${props.api.id}`}>
            <header>Image Viewer</header>
            <h2>{asText(props.params.path) || "Image"}</h2>
        </div>
    );
}

function UtilityTab(props: { params: Record<string, unknown>; api: WorkbenchTabApi; label: string }): ReactNode {
    return (
        <div className="ofive-workbench-fixture__tab" data-testid={`ofive-tab-${props.api.id}`}>
            <header>{props.label}</header>
            <h2>{asText(props.params.panelId) || props.label}</h2>
            <p>{props.label} content in the ofive layout fixture.</p>
        </div>
    );
}

function renderPreviewMirror(
    tab: TabSectionTabDefinition,
    context: TabDragPreviewContentRenderContext,
): ReactNode | undefined {
    const payload = readWorkbenchTabPayload(tab) as WorkbenchTabPayload;
    if (payload.component !== "codemirror" || (context.renderMode !== "overlay" && !context.isPreviewTabSection)) {
        return undefined;
    }

    return (
        <div className="ofive-workbench-fixture__preview-mirror" data-testid="ofive-editor-preview-mirror">
            <span>Editor preview mirror</span>
            <strong>{tab.title}</strong>
        </div>
    );
}

function readExternalFilePath(event: DragEvent): string {
    const transfer = event.dataTransfer;
    if (!transfer) {
        return "";
    }

    return transfer.getData(EXTERNAL_OFIVE_FILE_MIME) || transfer.getData(EXTERNAL_OFIVE_FILE_FALLBACK);
}

const externalTabDragResolver: WorkbenchExternalTabDragResolver = {
    canAccept: (event) => {
        const types = Array.from(event.dataTransfer?.types ?? []);
        return types.includes(EXTERNAL_OFIVE_FILE_MIME) || types.includes(EXTERNAL_OFIVE_FILE_FALLBACK);
    },
    resolveTab: (event) => {
        const path = readExternalFilePath(event);
        return path ? createFileTab(path) : null;
    },
};

export function OfiveWorkbenchUsageExample(): ReactNode {
    const apiRef = useRef<WorkbenchApi | null>(null);
    const setApiRef = useCallback((api: WorkbenchApi | null): void => {
        apiRef.current = api;
        window.__LAYOUT_V2_OFIVE_API__ = api;
    }, []);

    const handleActivateActivity = useCallback((activityId: string, context: WorkbenchPanelContext): void => {
        const counts = ensureCounts();
        counts.activatedActivity += 1;
        window.__LAYOUT_V2_OFIVE_LAST_ACTIVITY__ = activityId;

        if (activityId === SETTINGS_ACTIVITY_ID) {
            context.openTab({ id: "settings", title: "Settings", component: "settings" });
            return;
        }

        const tabByActivity: Record<string, WorkbenchTabDefinition> = {
            "knowledge-graph": {
                id: "knowledge-graph",
                title: "Knowledge Graph",
                component: "knowledge-graph",
            },
            calendar: {
                id: "calendar",
                title: "Calendar",
                component: "calendar",
            },
            "architecture-devtools": {
                id: "architecture-devtools",
                title: "Architecture Devtools",
                component: "architecture-devtools",
            },
            "task-board": {
                id: "task-board",
                title: "Task Board",
                component: "task-board",
            },
        };

        const tab = tabByActivity[activityId];
        if (tab) {
            context.openTab(tab);
        }
    }, []);

    return (
        <div className="ofive-workbench-fixture" data-testid="ofive-workbench-example">
            <div
                className="ofive-workbench-fixture__file-source"
                data-testid="ofive-external-file-source"
                draggable
                onDragStart={(event) => {
                    event.dataTransfer.setData(EXTERNAL_OFIVE_FILE_MIME, "notes/external-drag.md");
                    event.dataTransfer.setData(EXTERNAL_OFIVE_FILE_FALLBACK, "notes/external-drag.md");
                    event.dataTransfer.effectAllowed = "copy";
                }}
            >
                external-drag.md
            </div>
            <VSCodeWorkbench
                activities={OFIVE_ACTIVITIES}
                panels={OFIVE_PANELS}
                initialTabs={INITIAL_TABS}
                hasRightSidebar
                initialSidebarState={INITIAL_SIDEBAR_STATE}
                hideEmptyPanelBar
                tabDragPreviewRenderMode="overlay"
                preserveActiveTabContentDuringDrag
                renderTabContentInDragPreviewLayout={false}
                renderPanelContentInDragPreviewLayout={false}
                renderTabDragPreviewContent={renderPreviewMirror}
                renderInactiveTabContent={(tab) => {
                    const payload = readWorkbenchTabPayload(tab);
                    return payload.component === "knowledge-graph";
                }}
                deferTabContentPresentation={(tab) => {
                    const payload = readWorkbenchTabPayload(tab);
                    return payload.component === "codemirror";
                }}
                externalTabDragResolver={externalTabDragResolver}
                emitSnapshotsOnSectionResize={false}
                sectionResizeStrategy="dom-flex"
                renderActivityIcon={(activity) => <OfiveIcon value={activity.icon} />}
                renderPanelContent={(panelId, context) => <PanelContent panelId={panelId} context={context} />}
                onActivateActivity={handleActivateActivity}
                onSidebarStateChange={(state) => {
                    const counts = ensureCounts();
                    counts.sidebar += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_SIDEBAR__ = state;
                }}
                onSectionRatioChange={() => {
                    ensureCounts().sectionRatio += 1;
                }}
                onPanelLayoutChange={(snapshot) => {
                    const counts = ensureCounts();
                    counts.panelLayout += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_PANEL_LAYOUT__ = snapshot;
                }}
                onLayoutSnapshotChange={(snapshot) => {
                    const counts = ensureCounts();
                    counts.layoutSnapshot += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_LAYOUT__ = snapshot;
                }}
                onActiveTabChange={(tabId) => {
                    const counts = ensureCounts();
                    counts.activeTab += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_ACTIVE_TAB__ = tabId;
                }}
                onCloseTab={(tabId) => {
                    const counts = ensureCounts();
                    counts.closedTab += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_CLOSED_TAB__ = tabId;
                }}
                onActivityBarsChange={() => {
                    ensureCounts().activityBars += 1;
                }}
                onActivityIconDrop={(iconId, newPanelSectionId) => {
                    const counts = ensureCounts();
                    counts.activityDrop += 1;
                    window.__LAYOUT_V2_OFIVE_LAST_ACTIVITY_DROP__ = { iconId, newPanelSectionId };
                }}
                apiRef={setApiRef}
                className="ofive-workbench-fixture__layout"
                tabComponents={{
                    codemirror: MarkdownTab,
                    canvas: CanvasTab,
                    imageviewer: ImageViewerTab,
                    settings: (props) => <UtilityTab {...props} label="Settings" />,
                    "knowledge-graph": (props) => <UtilityTab {...props} label="Knowledge Graph" />,
                    calendar: (props) => <UtilityTab {...props} label="Calendar" />,
                    "architecture-devtools": (props) => <UtilityTab {...props} label="Architecture Devtools" />,
                    "task-board": (props) => <UtilityTab {...props} label="Task Board" />,
                    inspector: (props) => <UtilityTab {...props} label="Inspector" />,
                }}
            />
        </div>
    );
}
