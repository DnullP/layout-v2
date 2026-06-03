/**
 * @module host/layout-v2/example/demo/DemoScenarios
 * @description Vercel-ready scenario gallery for the layout-v2 workbench demo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    VSCodeWorkbench,
    type WorkbenchActivityDefinition,
    type WorkbenchApi,
    type WorkbenchPanelContext,
    type WorkbenchPanelDefinition,
    type WorkbenchSidebarState,
    type WorkbenchTabApi,
    type WorkbenchTabDefinition,
} from "../../src";

type DemoScenarioId = "knowledge" | "api" | "ops";

interface DemoMetric {
    label: string;
    value: string;
}

interface DemoPanelView {
    eyebrow: string;
    title: string;
    rows: string[];
    openTab: WorkbenchTabDefinition;
}

interface DemoScenario {
    id: DemoScenarioId;
    label: string;
    title: string;
    tone: "leaf" | "signal" | "ember";
    activities: WorkbenchActivityDefinition[];
    panels: WorkbenchPanelDefinition[];
    initialTabs: WorkbenchTabDefinition[];
    quickTabs: WorkbenchTabDefinition[];
    panelViews: Record<string, DemoPanelView>;
    actionTabs: Record<string, WorkbenchTabDefinition>;
    initialSidebarState: WorkbenchSidebarState;
}

interface DemoTelemetry {
    activeTabId: string | null;
    layoutSnapshots: number;
    panelSnapshots: number;
    sidebarChanges: number;
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function readStringList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readMetrics(value: unknown): DemoMetric[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is DemoMetric => {
        if (!item || typeof item !== "object") {
            return false;
        }

        const metric = item as Record<string, unknown>;
        return typeof metric.label === "string" && typeof metric.value === "string";
    });
}

function icon(label: string): ReactNode {
    return <span className="layout-v2-demo-icon">{label}</span>;
}

const KNOWLEDGE_INITIAL_TABS: WorkbenchTabDefinition[] = [
    {
        id: "knowledge:daily-brief",
        title: "daily-brief.md",
        component: "document",
        params: {
            eyebrow: "Research note",
            title: "Daily brief",
            summary: "A writing surface with outline, backlinks, and contextual AI mounted around the main editor.",
            metrics: [
                { label: "links", value: "18" },
                { label: "tasks", value: "7" },
                { label: "mentions", value: "42" },
            ],
            items: ["Inbox triage", "Launch memo", "Follow-up questions", "Pinned references"],
        },
    },
    {
        id: "knowledge:graph",
        title: "graph.canvas",
        component: "canvas",
        params: {
            eyebrow: "Canvas",
            title: "Project graph",
            summary: "Canvas and markdown tabs can split, merge, close, and preserve focused content independently.",
            metrics: [
                { label: "nodes", value: "36" },
                { label: "clusters", value: "5" },
                { label: "stale", value: "3" },
            ],
            items: ["Ideas", "References", "Drafts", "Review"],
        },
    },
    {
        id: "knowledge:review",
        title: "review.queue",
        component: "board",
        params: {
            eyebrow: "Review queue",
            title: "Editorial passes",
            summary: "A secondary workflow tab for side-by-side review while the sidebars keep their own panel topology.",
            items: ["Needs source", "Ready for publish", "Needs diagram", "Waiting on owner"],
        },
    },
];

const API_INITIAL_TABS: WorkbenchTabDefinition[] = [
    {
        id: "api:get-customer",
        title: "GET /customers/:id",
        component: "request",
        params: {
            eyebrow: "REST request",
            method: "GET",
            endpoint: "/v1/customers/cus_2839",
            status: "200 OK",
            summary: "Request tabs can be dragged into new groups while collections and environment panels stay mounted.",
            metrics: [
                { label: "latency", value: "124ms" },
                { label: "size", value: "18kb" },
                { label: "env", value: "prod" },
            ],
            code: ["Authorization: Bearer sk_live_...", "Accept: application/json", "x-trace-id: req_81A"],
        },
    },
    {
        id: "api:graphql",
        title: "GraphQL search",
        component: "request",
        params: {
            eyebrow: "GraphQL",
            method: "POST",
            endpoint: "/graphql",
            status: "200 OK",
            summary: "The workbench treats REST, GraphQL, and RPC editors as host-owned tab components.",
            metrics: [
                { label: "fields", value: "12" },
                { label: "cache", value: "hit" },
                { label: "cost", value: "31" },
            ],
            code: ["query SearchCustomers($q: String!) {", "  customers(query: $q) { id name plan }", "}"],
        },
    },
    {
        id: "api:response",
        title: "response.json",
        component: "document",
        params: {
            eyebrow: "Response",
            title: "JSON viewer",
            summary: "Response inspectors can stay open beside request editors as regular layout-v2 tab groups.",
            items: ["customer.id", "customer.plan", "subscription.status", "invoice.total"],
        },
    },
];

const OPS_INITIAL_TABS: WorkbenchTabDefinition[] = [
    {
        id: "ops:service-health",
        title: "service-health",
        component: "metrics",
        params: {
            eyebrow: "Live metrics",
            title: "Checkout service",
            summary: "Dense operational surfaces can combine metrics, logs, deploy plans, and incident context.",
            metrics: [
                { label: "uptime", value: "99.98%" },
                { label: "p95", value: "312ms" },
                { label: "errors", value: "0.08%" },
            ],
            items: ["api-gateway", "checkout", "payments", "worker"],
        },
    },
    {
        id: "ops:logs",
        title: "live.log",
        component: "logs",
        params: {
            eyebrow: "Logs",
            title: "Deploy stream",
            summary: "Log viewers can be split away from dashboards without the host owning layout mechanics.",
            code: [
                "10:42:18 deploy checkout@8f12 promoted",
                "10:42:26 warmup passed in iad1",
                "10:42:29 canary traffic 25%",
                "10:42:41 alerts remain green",
            ],
        },
    },
    {
        id: "ops:rollout",
        title: "rollout.plan",
        component: "board",
        params: {
            eyebrow: "Release plan",
            title: "Feature flag rollout",
            summary: "Action activities can open host tabs while layout-v2 keeps section state and persistence callbacks isolated.",
            items: ["Canary", "Ramp", "Observe", "Finalize"],
        },
    },
];

const DEMO_SCENARIOS: DemoScenario[] = [
    {
        id: "knowledge",
        label: "Knowledge",
        title: "Knowledge Workbench",
        tone: "leaf",
        activities: [
            { id: "files", label: "Files", bar: "left", section: "top", icon: icon("F") },
            { id: "search", label: "Search", bar: "left", section: "top", icon: icon("S") },
            { id: "graph", label: "Graph", bar: "left", section: "top", activationMode: "action", icon: icon("G") },
            { id: "templates", label: "Templates", bar: "left", section: "bottom", activationMode: "action", icon: icon("T") },
            { id: "ai", label: "AI", bar: "right", section: "top", icon: icon("AI") },
            { id: "outline", label: "Outline", bar: "right", section: "top", icon: icon("O") },
        ],
        panels: [
            { id: "files", label: "Files", activityId: "files", position: "left", order: 1, icon: icon("F") },
            { id: "recent", label: "Recent", activityId: "files", position: "left", order: 2, icon: icon("R") },
            { id: "search", label: "Search", activityId: "search", position: "left", order: 1, icon: icon("S") },
            { id: "ai", label: "AI Chat", activityId: "ai", position: "right", order: 1, icon: icon("AI") },
            { id: "outline", label: "Outline", activityId: "outline", position: "right", order: 2, icon: icon("O") },
            { id: "backlinks", label: "Backlinks", activityId: "outline", position: "right", order: 3, icon: icon("B") },
        ],
        initialTabs: KNOWLEDGE_INITIAL_TABS,
        quickTabs: [
            {
                id: "knowledge:scratch",
                title: "scratch.md",
                component: "document",
                params: {
                    eyebrow: "Scratch",
                    title: "Scratch note",
                    summary: "A new host tab opened through the workbench API.",
                    items: ["Draft", "Tag", "Link"],
                },
            },
            {
                id: "knowledge:map",
                title: "map.canvas",
                component: "canvas",
                params: {
                    eyebrow: "Canvas",
                    title: "Idea map",
                    summary: "A second canvas tab for split-preview testing.",
                    items: ["Signals", "Questions", "Artifacts", "Owners"],
                },
            },
        ],
        panelViews: {
            files: {
                eyebrow: "Vault",
                title: "Project notes",
                rows: ["daily-brief.md", "launch-memo.md", "research/sources.md", "review.queue"],
                openTab: KNOWLEDGE_INITIAL_TABS[0],
            },
            recent: {
                eyebrow: "Recent",
                title: "Touched today",
                rows: ["graph.canvas", "interview-notes.md", "draft-outline.md"],
                openTab: KNOWLEDGE_INITIAL_TABS[1],
            },
            search: {
                eyebrow: "Search",
                title: "Semantic results",
                rows: ["layout persistence", "tab drag preview", "panel split state"],
                openTab: KNOWLEDGE_INITIAL_TABS[2],
            },
            ai: {
                eyebrow: "Assistant",
                title: "Context window",
                rows: ["Pinned note: daily-brief.md", "Selected block: Roadmap", "Suggested action: summarize"],
                openTab: {
                    id: "knowledge:assistant",
                    title: "assistant.thread",
                    component: "document",
                    params: {
                        eyebrow: "Assistant",
                        title: "Thread summary",
                        summary: "AI output is host-rendered content inside a layout-v2 tab.",
                        items: ["Open questions", "Relevant notes", "Next edits"],
                    },
                },
            },
            outline: {
                eyebrow: "Outline",
                title: "daily-brief.md",
                rows: ["Context", "Signals", "Risks", "Decisions"],
                openTab: KNOWLEDGE_INITIAL_TABS[0],
            },
            backlinks: {
                eyebrow: "Backlinks",
                title: "Incoming references",
                rows: ["launch-memo.md", "meeting-notes.md", "architecture.md"],
                openTab: KNOWLEDGE_INITIAL_TABS[2],
            },
        },
        actionTabs: {
            graph: KNOWLEDGE_INITIAL_TABS[1],
            templates: {
                id: "knowledge:templates",
                title: "templates",
                component: "board",
                params: {
                    eyebrow: "Templates",
                    title: "Reusable note kits",
                    summary: "Action activities can open domain tabs without coupling business behavior to layout state.",
                    items: ["Meeting", "Spec", "Review", "Daily"],
                },
            },
        },
        initialSidebarState: {
            left: { visible: true, activeActivityId: "files", activePanelId: "files" },
            right: { visible: true, activeActivityId: "outline", activePanelId: "outline" },
        },
    },
    {
        id: "api",
        label: "API",
        title: "API Client",
        tone: "signal",
        activities: [
            { id: "collections", label: "Collections", bar: "left", section: "top", icon: icon("C") },
            { id: "environments", label: "Environments", bar: "left", section: "top", icon: icon("E") },
            { id: "history", label: "History", bar: "left", section: "top", icon: icon("H") },
            { id: "new-request", label: "New Request", bar: "left", section: "bottom", activationMode: "action", icon: icon("+") },
            { id: "docs", label: "Docs", bar: "right", section: "top", icon: icon("D") },
            { id: "variables", label: "Variables", bar: "right", section: "top", icon: icon("V") },
        ],
        panels: [
            { id: "collections", label: "Collections", activityId: "collections", position: "left", order: 1, icon: icon("C") },
            { id: "schemas", label: "Schemas", activityId: "collections", position: "left", order: 2, icon: icon("S") },
            { id: "environments", label: "Environments", activityId: "environments", position: "left", order: 1, icon: icon("E") },
            { id: "history", label: "History", activityId: "history", position: "left", order: 1, icon: icon("H") },
            { id: "docs", label: "Docs", activityId: "docs", position: "right", order: 1, icon: icon("D") },
            { id: "variables", label: "Variables", activityId: "variables", position: "right", order: 2, icon: icon("V") },
            { id: "response", label: "Response", activityId: "docs", position: "right", order: 3, icon: icon("R") },
        ],
        initialTabs: API_INITIAL_TABS,
        quickTabs: [
            {
                id: "api:patch-plan",
                title: "PATCH /plans",
                component: "request",
                params: {
                    eyebrow: "REST request",
                    method: "PATCH",
                    endpoint: "/v1/plans/pro",
                    status: "204 No Content",
                    summary: "A newly opened request tab using the public workbench API.",
                    metrics: [
                        { label: "latency", value: "88ms" },
                        { label: "auth", value: "ok" },
                        { label: "env", value: "stage" },
                    ],
                    code: ["Content-Type: application/json", "{ \"price\": 49, \"currency\": \"USD\" }"],
                },
            },
        ],
        panelViews: {
            collections: {
                eyebrow: "Collections",
                title: "Customer API",
                rows: ["GET /customers/:id", "PATCH /plans", "POST /invoices", "GraphQL search"],
                openTab: API_INITIAL_TABS[0],
            },
            schemas: {
                eyebrow: "Schemas",
                title: "OpenAPI",
                rows: ["Customer", "Plan", "Invoice", "ErrorEnvelope"],
                openTab: API_INITIAL_TABS[2],
            },
            environments: {
                eyebrow: "Environment",
                title: "Production",
                rows: ["BASE_URL", "TOKEN", "TRACE_SAMPLE_RATE"],
                openTab: API_INITIAL_TABS[0],
            },
            history: {
                eyebrow: "History",
                title: "Recent calls",
                rows: ["200 GET customers", "204 PATCH plans", "500 POST invoice"],
                openTab: API_INITIAL_TABS[1],
            },
            docs: {
                eyebrow: "Docs",
                title: "Endpoint reference",
                rows: ["Authentication", "Pagination", "Error model"],
                openTab: API_INITIAL_TABS[2],
            },
            variables: {
                eyebrow: "Variables",
                title: "Current scope",
                rows: ["customer_id=cus_2839", "plan=pro", "region=iad1"],
                openTab: API_INITIAL_TABS[0],
            },
            response: {
                eyebrow: "Response",
                title: "Last exchange",
                rows: ["status: 200", "duration: 124ms", "content-type: json"],
                openTab: API_INITIAL_TABS[2],
            },
        },
        actionTabs: {
            "new-request": {
                id: "api:new-request",
                title: "Untitled request",
                component: "request",
                params: {
                    eyebrow: "REST request",
                    method: "POST",
                    endpoint: "/v1/endpoint",
                    status: "draft",
                    summary: "Action activity opened an untitled request editor.",
                    metrics: [
                        { label: "auth", value: "none" },
                        { label: "body", value: "json" },
                        { label: "env", value: "local" },
                    ],
                    code: ["Content-Type: application/json", "{ }"],
                },
            },
        },
        initialSidebarState: {
            left: { visible: true, activeActivityId: "collections", activePanelId: "collections" },
            right: { visible: true, activeActivityId: "docs", activePanelId: "docs" },
        },
    },
    {
        id: "ops",
        label: "Ops",
        title: "Operations Console",
        tone: "ember",
        activities: [
            { id: "services", label: "Services", bar: "left", section: "top", icon: icon("S") },
            { id: "incidents", label: "Incidents", bar: "left", section: "top", icon: icon("I") },
            { id: "deploys", label: "Deploys", bar: "left", section: "top", icon: icon("D") },
            { id: "runbook-action", label: "Runbook", bar: "left", section: "bottom", activationMode: "action", icon: icon("R") },
            { id: "metrics", label: "Metrics", bar: "right", section: "top", icon: icon("M") },
            { id: "alerts", label: "Alerts", bar: "right", section: "top", icon: icon("A") },
        ],
        panels: [
            { id: "services", label: "Services", activityId: "services", position: "left", order: 1, icon: icon("S") },
            { id: "owners", label: "Owners", activityId: "services", position: "left", order: 2, icon: icon("O") },
            { id: "incidents", label: "Incidents", activityId: "incidents", position: "left", order: 1, icon: icon("I") },
            { id: "deploys", label: "Deploys", activityId: "deploys", position: "left", order: 1, icon: icon("D") },
            { id: "metrics", label: "Metrics", activityId: "metrics", position: "right", order: 1, icon: icon("M") },
            { id: "alerts", label: "Alerts", activityId: "alerts", position: "right", order: 2, icon: icon("A") },
            { id: "runbook", label: "Runbook", activityId: "alerts", position: "right", order: 3, icon: icon("R") },
        ],
        initialTabs: OPS_INITIAL_TABS,
        quickTabs: [
            {
                id: "ops:incident",
                title: "incident-4821",
                component: "board",
                params: {
                    eyebrow: "Incident",
                    title: "Checkout latency",
                    summary: "A new incident workspace opened through the high-level API.",
                    items: ["Detect", "Assign", "Mitigate", "Resolve"],
                },
            },
        ],
        panelViews: {
            services: {
                eyebrow: "Services",
                title: "Production",
                rows: ["api-gateway", "checkout", "payments", "email-worker"],
                openTab: OPS_INITIAL_TABS[0],
            },
            owners: {
                eyebrow: "Owners",
                title: "On call",
                rows: ["Checkout: Mira", "Payments: Devon", "Infra: Kai"],
                openTab: OPS_INITIAL_TABS[2],
            },
            incidents: {
                eyebrow: "Incidents",
                title: "Open",
                rows: ["INC-4821 latency watch", "INC-4819 cache miss", "INC-4812 closed"],
                openTab: {
                    id: "ops:incident-4821",
                    title: "INC-4821",
                    component: "board",
                    params: {
                        eyebrow: "Incident",
                        title: "Checkout latency watch",
                        summary: "Incident state belongs to the host app; layout-v2 only manages the workspace surface.",
                        items: ["Triage", "Investigate", "Patch", "Review"],
                    },
                },
            },
            deploys: {
                eyebrow: "Deploys",
                title: "Recent",
                rows: ["checkout@8f12", "api-gateway@91ad", "worker@1de0"],
                openTab: OPS_INITIAL_TABS[1],
            },
            metrics: {
                eyebrow: "Metrics",
                title: "Golden signals",
                rows: ["Traffic", "Latency", "Errors", "Saturation"],
                openTab: OPS_INITIAL_TABS[0],
            },
            alerts: {
                eyebrow: "Alerts",
                title: "Routing",
                rows: ["checkout.latency.p95", "queue.depth", "payment.errors"],
                openTab: OPS_INITIAL_TABS[1],
            },
            runbook: {
                eyebrow: "Runbook",
                title: "Checkout",
                rows: ["Rollback", "Drain queue", "Disable flag"],
                openTab: OPS_INITIAL_TABS[2],
            },
        },
        actionTabs: {
            "runbook-action": OPS_INITIAL_TABS[2],
        },
        initialSidebarState: {
            left: { visible: true, activeActivityId: "services", activePanelId: "services" },
            right: { visible: true, activeActivityId: "metrics", activePanelId: "metrics" },
        },
    },
];

function getInitialScenarioId(): DemoScenarioId {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("scenario") ?? window.location.hash.replace(/^#/, "");
    return DEMO_SCENARIOS.some((scenario) => scenario.id === candidate)
        ? candidate as DemoScenarioId
        : "knowledge";
}

function createTelemetry(initialTabId: string | null): DemoTelemetry {
    return {
        activeTabId: initialTabId,
        layoutSnapshots: 0,
        panelSnapshots: 0,
        sidebarChanges: 0,
    };
}

function DemoPanelContent(props: {
    scenario: DemoScenario;
    panelId: string;
    context: WorkbenchPanelContext;
}): ReactNode {
    const view = props.scenario.panelViews[props.panelId] ?? {
        eyebrow: "Panel",
        title: props.panelId,
        rows: ["No host panel data"],
        openTab: props.scenario.initialTabs[0],
    };

    useEffect(() => {
        props.context.markContentReady();
    }, [props.context, props.panelId]);

    return (
        <div className="layout-v2-demo-panel" data-testid={`demo-panel-${props.panelId}`}>
            <div className="layout-v2-demo-panel__header">
                <span>{view.eyebrow}</span>
                <button type="button" onClick={() => props.context.openTab(view.openTab)}>
                    Open
                </button>
            </div>
            <strong>{view.title}</strong>
            <div className="layout-v2-demo-panel__rows">
                {view.rows.map((row) => (
                    <button
                        key={row}
                        type="button"
                        className="layout-v2-demo-panel__row"
                        onClick={() => props.context.openTab(view.openTab)}
                    >
                        {row}
                    </button>
                ))}
            </div>
            <small>Active tab: {props.context.activeTabId ?? "none"}</small>
        </div>
    );
}

function DemoTab(props: { params: Record<string, unknown>; api: WorkbenchTabApi }): ReactNode {
    const title = readString(props.params.title) || props.api.id;
    const eyebrow = readString(props.params.eyebrow) || "Tab";
    const summary = readString(props.params.summary);
    const method = readString(props.params.method);
    const endpoint = readString(props.params.endpoint);
    const status = readString(props.params.status);
    const items = readStringList(props.params.items);
    const code = readStringList(props.params.code);
    const metrics = readMetrics(props.params.metrics);

    useEffect(() => {
        props.api.markContentReady();
    }, [props.api]);

    return (
        <div className="layout-v2-demo-tab" data-testid={`demo-tab-${props.api.id}`}>
            <header className="layout-v2-demo-tab__header">
                <div>
                    <span>{eyebrow}</span>
                    <h2>{title}</h2>
                </div>
                <div className="layout-v2-demo-tab__actions">
                    <button type="button" onClick={() => props.api.setTitle(`${title} edited`)}>
                        Rename
                    </button>
                    <button type="button" onClick={props.api.close}>
                        Close
                    </button>
                </div>
            </header>

            {summary ? <p className="layout-v2-demo-tab__summary">{summary}</p> : null}

            {method || endpoint ? (
                <div className="layout-v2-demo-request">
                    <strong>{method || "GET"}</strong>
                    <code>{endpoint || "/"}</code>
                    <span>{status || "draft"}</span>
                </div>
            ) : null}

            {metrics.length > 0 ? (
                <div className="layout-v2-demo-metrics">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="layout-v2-demo-metric">
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                        </div>
                    ))}
                </div>
            ) : null}

            {items.length > 0 ? (
                <div className="layout-v2-demo-list">
                    {items.map((item) => (
                        <span key={item}>{item}</span>
                    ))}
                </div>
            ) : null}

            {code.length > 0 ? (
                <pre className="layout-v2-demo-code">{code.join("\n")}</pre>
            ) : null}
        </div>
    );
}

export function DemoScenarios(): ReactNode {
    const [scenarioId, setScenarioId] = useState<DemoScenarioId>(() => getInitialScenarioId());
    const scenario = useMemo(
        () => DEMO_SCENARIOS.find((item) => item.id === scenarioId) ?? DEMO_SCENARIOS[0],
        [scenarioId],
    );
    const workbenchApiRef = useRef<WorkbenchApi | null>(null);
    const quickTabIndexRef = useRef(1);
    const [telemetry, setTelemetry] = useState<DemoTelemetry>(() => createTelemetry(scenario.initialTabs[0]?.id ?? null));

    const setWorkbenchApi = useCallback((api: WorkbenchApi | null): void => {
        workbenchApiRef.current = api;
    }, []);

    useEffect(() => {
        setTelemetry(createTelemetry(scenario.initialTabs[0]?.id ?? null));
        quickTabIndexRef.current = 1;
    }, [scenario]);

    const handleScenarioChange = (nextScenarioId: DemoScenarioId): void => {
        setScenarioId(nextScenarioId);
        window.history.replaceState(null, "", `#${nextScenarioId}`);
    };

    const handleOpenQuickTab = (): void => {
        const api = workbenchApiRef.current;
        const source = scenario.quickTabs[(quickTabIndexRef.current - 1) % scenario.quickTabs.length];
        if (!api || !source) {
            return;
        }

        const index = quickTabIndexRef.current;
        quickTabIndexRef.current += 1;
        api.openTab({
            ...source,
            id: `${source.id}:${index}`,
            title: index === 1 ? source.title : `${source.title} ${index}`,
        });
    };

    const handleActivateActivity = useCallback((activityId: string, context: WorkbenchPanelContext): void => {
        const tab = scenario.actionTabs[activityId];
        if (tab) {
            context.openTab(tab);
        }
    }, [scenario]);

    const tabComponents = useMemo(
        () => ({
            board: DemoTab,
            canvas: DemoTab,
            document: DemoTab,
            logs: DemoTab,
            metrics: DemoTab,
            request: DemoTab,
        }),
        [],
    );

    return (
        <div className={`layout-v2-demo layout-v2-demo--${scenario.tone}`} data-testid="layout-v2-demo-shell">
            <header className="layout-v2-demo__toolbar">
                <div className="layout-v2-demo__brand">
                    <span>layout-v2</span>
                    <strong>{scenario.title}</strong>
                </div>

                <div className="layout-v2-demo__segments" role="tablist" aria-label="Demo scenarios">
                    {DEMO_SCENARIOS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={item.id === scenario.id}
                            className={item.id === scenario.id ? "layout-v2-demo__segment layout-v2-demo__segment--active" : "layout-v2-demo__segment"}
                            onClick={() => handleScenarioChange(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="layout-v2-demo__commands">
                    <button type="button" onClick={handleOpenQuickTab}>
                        New tab
                    </button>
                    <button type="button" onClick={() => workbenchApiRef.current?.toggleLeftSidebarVisible()}>
                        Left
                    </button>
                    <button type="button" onClick={() => workbenchApiRef.current?.toggleRightSidebarVisible()}>
                        Right
                    </button>
                </div>

                <div className="layout-v2-demo__telemetry" aria-label="Workbench state">
                    <span>{telemetry.activeTabId ?? "no tab"}</span>
                    <span>L{telemetry.layoutSnapshots}</span>
                    <span>P{telemetry.panelSnapshots}</span>
                    <span>S{telemetry.sidebarChanges}</span>
                </div>
            </header>

            <main className="layout-v2-demo__workspace">
                <VSCodeWorkbench
                    key={scenario.id}
                    workbenchId={`demo-${scenario.id}`}
                    windowLabel={scenario.title}
                    activities={scenario.activities}
                    panels={scenario.panels}
                    initialTabs={scenario.initialTabs}
                    initialSidebarState={scenario.initialSidebarState}
                    hasRightSidebar
                    tabComponents={tabComponents}
                    tabDragPreviewRenderMode="overlay"
                    preserveActiveTabContentDuringDrag
                    renderTabContentInDragPreviewLayout={false}
                    renderPanelContentInDragPreviewLayout={false}
                    deferPanelContentPresentation={() => true}
                    renderPanelContent={(panelId, context) => (
                        <DemoPanelContent scenario={scenario} panelId={panelId} context={context} />
                    )}
                    renderActivityIcon={(activity) => activity.icon}
                    onActivateActivity={handleActivateActivity}
                    onActiveTabChange={(activeTabId) => setTelemetry((current) => ({ ...current, activeTabId }))}
                    onLayoutSnapshotChange={() => {
                        setTelemetry((current) => ({ ...current, layoutSnapshots: current.layoutSnapshots + 1 }));
                    }}
                    onPanelLayoutChange={() => {
                        setTelemetry((current) => ({ ...current, panelSnapshots: current.panelSnapshots + 1 }));
                    }}
                    onSidebarStateChange={() => {
                        setTelemetry((current) => ({ ...current, sidebarChanges: current.sidebarChanges + 1 }));
                    }}
                    apiRef={setWorkbenchApi}
                    className="layout-v2-demo__workbench"
                />
            </main>
        </div>
    );
}
