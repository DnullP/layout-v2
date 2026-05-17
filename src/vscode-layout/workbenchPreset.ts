/**
 * @module host/layout-v2/vscode-layout/workbenchPreset
 * @description VSCode 风格的预设 section tree 布局构建器。
 *   将 section tree 构建从宿主代码下沉到 layout-v2 内部。
 */

import {
    createRootSection,
    findSectionNode,
    setSectionHidden,
    splitSectionTree,
    SECTION_FIXED_SIZE_META_KEY,
    type SectionDraft,
    type SectionNode,
} from "../section/layoutModel";
import {
    createSectionComponentBinding,
    getSectionComponentBinding,
    type SectionComponentBinding,
    type SectionComponentData,
} from "../section/sectionComponent";
import { createActivityBarState, type ActivityBarsState, type ActivityBarIconDefinition } from "../activity-bar/activityBarModel";
import { createVSCodeLayoutState, type VSCodeLayoutState } from "./store";
import { createPanelSectionsState } from "../panel-section/panelSectionModel";
import { applyPanelSectionCollapsedFixedSize } from "../panel-section/panelSectionLayout";
import { createTabSectionsState, type TabSectionStateItem, type TabSectionTabDefinition } from "../tab-section/tabSectionModel";
import type { PanelSectionPanelDefinition, PanelSectionStateItem } from "../panel-section/panelSectionModel";
import type { WorkbenchActivityDefinition, WorkbenchPanelDefinition, WorkbenchTabDefinition } from "./workbenchTypes";

export const WORKBENCH_MAIN_TAB_SECTION_ID = "main-tabs";
export const WORKBENCH_LEFT_ACTIVITY_BAR_ID = "left-activity-bar";
export const WORKBENCH_RIGHT_ACTIVITY_BAR_ID = "right-activity-bar";
export const WORKBENCH_LEFT_PANEL_SECTION_ID = "left-panel-section";
export const WORKBENCH_RIGHT_PANEL_SECTION_ID = "right-panel-section";

export type WorkbenchSectionRole = "root" | "container" | "activity-bar" | "sidebar" | "main";

export type WorkbenchSectionComponentBinding =
    | SectionComponentBinding<"empty", { label: string; description: string }>
    | SectionComponentBinding<"activity-rail", Record<string, never>>
    | SectionComponentBinding<"panel-section", { panelSectionId: string }>
    | SectionComponentBinding<"tab-section", { tabSectionId: string }>;

export interface WorkbenchSectionData extends SectionComponentData<WorkbenchSectionComponentBinding> {
    role: WorkbenchSectionRole;
}

function createWorkbenchSectionDraft(
    id: string,
    title: string,
    role: WorkbenchSectionRole,
    component: WorkbenchSectionComponentBinding,
    resizableEdges?: SectionDraft<WorkbenchSectionData>["resizableEdges"],
    meta?: SectionDraft<WorkbenchSectionData>["meta"],
): SectionDraft<WorkbenchSectionData> {
    return {
        id,
        title,
        data: { role, component },
        resizableEdges,
        meta,
    };
}

export function createWorkbenchRootLayout(hasRightSidebar: boolean): SectionNode<WorkbenchSectionData> {
    let root = createRootSection(
        createWorkbenchSectionDraft(
            "root",
            "Workbench Root",
            "root",
            createSectionComponentBinding("empty", { label: "Root", description: "workbench root" }),
        ),
    );

    root = splitSectionTree(root, "root", "horizontal", {
        ratio: 0.04,
        first: createWorkbenchSectionDraft(
            "left-activity-bar",
            "Left Activity Bar",
            "activity-bar",
            createSectionComponentBinding("activity-rail", {}),
            { right: false },
            { [SECTION_FIXED_SIZE_META_KEY]: 48 },
        ),
        second: createWorkbenchSectionDraft(
            "workbench-shell",
            "Workbench Shell",
            "container",
            createSectionComponentBinding("empty", { label: "Workbench", description: "workbench container" }),
        ),
    });

    root = splitSectionTree(root, "workbench-shell", "horizontal", {
        ratio: 0.22,
        first: createWorkbenchSectionDraft(
            "left-sidebar",
            "Left Sidebar",
            "sidebar",
            createSectionComponentBinding("panel-section", { panelSectionId: WORKBENCH_LEFT_PANEL_SECTION_ID }),
        ),
        second: createWorkbenchSectionDraft(
            hasRightSidebar ? "center-shell" : "main-tabs",
            hasRightSidebar ? "Center Shell" : "Main Tabs",
            hasRightSidebar ? "container" : "main",
            hasRightSidebar
                ? createSectionComponentBinding("empty", { label: "Center", description: "main region" })
                : createSectionComponentBinding("tab-section", { tabSectionId: WORKBENCH_MAIN_TAB_SECTION_ID }),
        ),
    });

    if (!hasRightSidebar) {
        return root;
    }

    root = splitSectionTree(root, "center-shell", "horizontal", {
        ratio: 0.78,
        first: createWorkbenchSectionDraft(
            "main-tabs",
            "Main Tabs",
            "main",
            createSectionComponentBinding("tab-section", { tabSectionId: WORKBENCH_MAIN_TAB_SECTION_ID }),
        ),
        second: createWorkbenchSectionDraft(
            "right-sidebar",
            "Right Sidebar",
            "sidebar",
            createSectionComponentBinding("panel-section", { panelSectionId: WORKBENCH_RIGHT_PANEL_SECTION_ID }),
        ),
    });

    return root;
}

function resolveSymbolFromLabel(label: string): string {
    return (label.trim()[0] ?? "?").toUpperCase();
}

export function buildWorkbenchActivityBars(
    activities: WorkbenchActivityDefinition[],
    selectedLeftActivityId: string | null,
    selectedRightActivityId: string | null,
): ActivityBarsState {
    const leftIcons: ActivityBarIconDefinition[] = activities
        .filter((a) => a.bar === "left")
        .map((a) => ({
            id: a.id,
            label: a.label,
            symbol: resolveSymbolFromLabel(a.label),
            activationMode: a.activationMode ?? "focus",
            meta: { icon: a.icon, section: a.section ?? "top" },
        }));

    const rightIcons: ActivityBarIconDefinition[] = activities
        .filter((a) => a.bar === "right")
        .map((a) => ({
            id: a.id,
            label: a.label,
            symbol: resolveSymbolFromLabel(a.label),
            activationMode: a.activationMode ?? "focus",
            meta: { icon: a.icon, section: a.section ?? "top" },
        }));

    return createActivityBarState([
        {
            id: WORKBENCH_LEFT_ACTIVITY_BAR_ID,
            icons: leftIcons,
            selectedIconId: selectedLeftActivityId,
        },
        {
            id: WORKBENCH_RIGHT_ACTIVITY_BAR_ID,
            icons: rightIcons,
            selectedIconId: selectedRightActivityId,
        },
    ]);
}

export function buildWorkbenchPanelSections(
    panels: WorkbenchPanelDefinition[],
    activities: WorkbenchActivityDefinition[],
    activeLeftActivityId: string | null,
    _activeRightActivityId: string | null,
    activeLeftPanelId: string | null,
    activeRightPanelId: string | null,
): PanelSectionStateItem[] {
    const activitiesById = new Map(activities.map((a) => [a.id, a]));

    const leftPanels = panels
        .filter((p) => p.position === "left" && (activeLeftActivityId === null || p.activityId === activeLeftActivityId))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Right sidebar shows ALL right panels as a flat icon rail (no activity filter).
    const rightPanels = panels
        .filter((p) => p.position === "right")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const mapPanel = (p: WorkbenchPanelDefinition): PanelSectionPanelDefinition => ({
        id: p.id,
        label: p.label,
        symbol: resolveSymbolFromLabel(p.label),
        content: p.label,
        tone: "neutral",
        meta: {
            activityId: p.activityId,
            icon: p.icon ?? activitiesById.get(p.activityId)?.icon ?? null,
        },
    });

    const leftPanelDefs = leftPanels.map(mapPanel);
    const rightPanelDefs = rightPanels.map(mapPanel);

    const leftFocused = leftPanelDefs.some((p) => p.id === activeLeftPanelId)
        ? activeLeftPanelId
        : (leftPanelDefs[0]?.id ?? null);

    const rightFocused = rightPanelDefs.some((p) => p.id === activeRightPanelId)
        ? activeRightPanelId
        : (rightPanelDefs[0]?.id ?? null);

    return [
        {
            id: WORKBENCH_LEFT_PANEL_SECTION_ID,
            panels: leftPanelDefs,
            focusedPanelId: leftFocused,
            isCollapsed: false,
            isRoot: true,
        },
        {
            id: WORKBENCH_RIGHT_PANEL_SECTION_ID,
            panels: rightPanelDefs,
            focusedPanelId: rightFocused,
            isCollapsed: false,
        },
    ];
}

export interface WorkbenchTabPayload {
    component: string;
    params: Record<string, unknown>;
}

export function buildWorkbenchTabs(tabs?: WorkbenchTabDefinition[]): TabSectionTabDefinition[] {
    if (!tabs || tabs.length === 0) {
        return [];
    }

    return tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        type: "workbench-tab",
        payload: {
            component: tab.component,
            params: tab.params ?? {},
        } satisfies WorkbenchTabPayload,
        content: `Component: ${tab.component}`,
        tone: "neutral" as const,
    }));
}

export function readWorkbenchTabPayload(tab: TabSectionTabDefinition): WorkbenchTabPayload {
    const payload = tab.payload as WorkbenchTabPayload | undefined;
    return {
        component: payload?.component ?? "unknown",
        params: payload?.params ?? {},
    };
}

export interface CreateWorkbenchLayoutOptions {
    activities?: WorkbenchActivityDefinition[];
    panels?: WorkbenchPanelDefinition[];
    initialTabs?: WorkbenchTabDefinition[];
    hasRightSidebar?: boolean;
    initialSidebarState?: {
        left?: { visible?: boolean; activeActivityId?: string | null; activePanelId?: string | null };
        right?: { visible?: boolean; activeActivityId?: string | null; activePanelId?: string | null };
    };
}

/**
 * @interface WorkbenchPanelSectionLayoutSnapshot
 * @description 可序列化的 panel section 拓扑快照；只保存 panel id，不保存 React icon / content 节点。
 * @field id panel section 标识。
 * @field panelIds 当前 section 内 panel 顺序。
 * @field focusedPanelId 当前聚焦 panel。
 * @field isCollapsed 当前 section 是否折叠。
 * @field isRoot 是否为 root panel section。
 */
export interface WorkbenchPanelSectionLayoutSnapshot {
    /** panel section 标识。 */
    id: string;
    /** 当前 section 内 panel 顺序。 */
    panelIds: string[];
    /** 当前聚焦 panel。 */
    focusedPanelId: string | null;
    /** 当前 section 是否折叠。 */
    isCollapsed: boolean;
    /** 是否为 root panel section。 */
    isRoot?: boolean;
}

/**
 * @interface WorkbenchPanelLayoutSnapshot
 * @description 可序列化的 panel split 布局快照，用于恢复侧栏 panel icon split 拓扑。
 * @field root section tree 根节点。
 * @field sections panel section 拓扑与 panel 顺序。
 */
export interface WorkbenchPanelLayoutSnapshot {
    /** section tree 根节点。 */
    root: SectionNode<WorkbenchSectionData>;
    /** panel section 拓扑与 panel 顺序。 */
    sections: WorkbenchPanelSectionLayoutSnapshot[];
}

/**
 * @interface WorkbenchTabSectionLayoutSnapshot
 * @description 可序列化的主工作区 tab section 快照。
 */
export interface WorkbenchTabSectionLayoutSnapshot {
    /** tab section 标识。 */
    id: string;
    /** 当前 section 内 tab 顺序。 */
    tabs: WorkbenchTabDefinition[];
    /** 当前聚焦 tab。 */
    focusedTabId: string | null;
    /** 是否为 root tab section。 */
    isRoot?: boolean;
}

/**
 * @interface WorkbenchLayoutSnapshot
 * @description 可序列化的工作区主布局快照，覆盖主编辑区 tab 拓扑与打开的 tab。
 */
export interface WorkbenchLayoutSnapshot {
    /** 快照版本。 */
    version: 1;
    /** section tree 根节点。 */
    root: SectionNode<WorkbenchSectionData>;
    /** 主编辑区 tab section 拓扑与 tab 顺序。 */
    tabSections: WorkbenchTabSectionLayoutSnapshot[];
    /** 当前活跃 tab section。 */
    activeGroupId: string | null;
}

/**
 * @function clonePanelLayoutSectionNode
 * @description 克隆 panel layout 快照用 section tree，并折叠 tab-section split，避免 panelLayout 持久化主编辑区 tab 拓扑。
 * @param node 待克隆 section 节点。
 * @returns 仅保留 panel 拓扑语义的 section tree 节点。
 */
function clonePanelLayoutSectionNode(node: SectionNode<WorkbenchSectionData>): SectionNode<WorkbenchSectionData> {
    const binding = getSectionComponentBinding(node);
    const clonedNode: SectionNode<WorkbenchSectionData> = {
        ...node,
        data: { ...node.data },
        resizableEdges: { ...node.resizableEdges },
        meta: node.meta ? { ...node.meta } : undefined,
        split: null,
    };

    if (binding.type === "tab-section") {
        return clonedNode;
    }

    if (!node.split) {
        return clonedNode;
    }

    return {
        ...clonedNode,
        split: {
            direction: node.split.direction,
            ratio: node.split.ratio,
            children: [
                clonePanelLayoutSectionNode(node.split.children[0]),
                clonePanelLayoutSectionNode(node.split.children[1]),
            ],
        },
    };
}

function cloneWorkbenchLayoutSectionNode(node: SectionNode<WorkbenchSectionData>): SectionNode<WorkbenchSectionData> {
    const binding = getSectionComponentBinding(node);
    const clonedNode: SectionNode<WorkbenchSectionData> = {
        ...node,
        data: {
            ...node.data,
            component: {
                type: node.data.component.type,
                props: { ...node.data.component.props },
            } as WorkbenchSectionData["component"],
        },
        resizableEdges: { ...node.resizableEdges },
        meta: node.meta ? { ...node.meta } : undefined,
        split: null,
    };

    if (!node.split || binding.type === "panel-section") {
        return clonedNode;
    }

    return {
        ...clonedNode,
        split: {
            direction: node.split.direction,
            ratio: node.split.ratio,
            children: [
                cloneWorkbenchLayoutSectionNode(node.split.children[0]),
                cloneWorkbenchLayoutSectionNode(node.split.children[1]),
            ],
        },
    };
}

function restoreWorkbenchTabSubtrees(
    panelRoot: SectionNode<WorkbenchSectionData>,
    currentRoot: SectionNode<WorkbenchSectionData>,
): SectionNode<WorkbenchSectionData> {
    const binding = getSectionComponentBinding(panelRoot);
    if (binding.type === "tab-section") {
        const currentNode = findSectionNode(currentRoot, panelRoot.id);
        return currentNode ? cloneWorkbenchLayoutSectionNode(currentNode) : panelRoot;
    }

    if (!panelRoot.split) {
        return panelRoot;
    }

    return {
        ...panelRoot,
        split: {
            ...panelRoot.split,
            children: [
                restoreWorkbenchTabSubtrees(panelRoot.split.children[0], currentRoot),
                restoreWorkbenchTabSubtrees(panelRoot.split.children[1], currentRoot),
            ],
        },
    };
}

function collectPanelSectionIds(root: SectionNode<WorkbenchSectionData>): Set<string> {
    return new Set(collectPanelSectionLeafIds(root).keys());
}

function collectPanelSectionLeafIds(root: SectionNode<WorkbenchSectionData>): Map<string, string> {
    const ids = new Map<string, string>();
    const queue: SectionNode<WorkbenchSectionData>[] = [root];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        if (current.split) {
            queue.push(current.split.children[0], current.split.children[1]);
            continue;
        }

        const binding = getSectionComponentBinding(current);
        if (binding.type !== "panel-section") {
            continue;
        }

        const panelSectionId = (binding.props as { panelSectionId?: unknown }).panelSectionId;
        if (typeof panelSectionId === "string" && panelSectionId.trim()) {
            ids.set(panelSectionId, current.id);
        }
    }

    return ids;
}

function normalizePanelSectionCollapsedFixedSizes(
    root: SectionNode<WorkbenchSectionData>,
    sections: Iterable<Pick<PanelSectionStateItem, "id" | "isCollapsed">>,
): SectionNode<WorkbenchSectionData> {
    const panelSectionLeafIds = collectPanelSectionLeafIds(root);
    let nextRoot = root;

    for (const section of sections) {
        const leafSectionId = panelSectionLeafIds.get(section.id);
        if (!leafSectionId) {
            continue;
        }

        nextRoot = applyPanelSectionCollapsedFixedSize(nextRoot, leafSectionId, section.isCollapsed);
    }

    return nextRoot;
}

/**
 * @function collectTabSectionIds
 * @description 收集 section tree 中承载的 tab section id，用于拒绝污染进 panelLayout 的主编辑区 split 拓扑。
 * @param root section tree 根节点。
 * @returns tab section id 集合。
 */
function collectTabSectionIds(root: SectionNode<WorkbenchSectionData>): Set<string> {
    const ids = new Set<string>();
    const queue: SectionNode<WorkbenchSectionData>[] = [root];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        if (current.split) {
            queue.push(current.split.children[0], current.split.children[1]);
        }

        const binding = getSectionComponentBinding(current);
        if (binding.type !== "tab-section") {
            continue;
        }

        const tabSectionId = (binding.props as { tabSectionId?: unknown }).tabSectionId;
        if (typeof tabSectionId === "string" && tabSectionId.trim()) {
            ids.add(tabSectionId);
        }
    }

    return ids;
}

function buildPanelDefinitionById(
    state: VSCodeLayoutState<WorkbenchSectionData>,
): Map<string, PanelSectionPanelDefinition> {
    const definitions = new Map<string, PanelSectionPanelDefinition>();
    for (const section of Object.values(state.panelSections.sections)) {
        for (const panel of section.panels) {
            definitions.set(panel.id, panel);
        }
    }
    return definitions;
}

function toWorkbenchTabDefinition(tab: TabSectionTabDefinition): WorkbenchTabDefinition {
    const payload = readWorkbenchTabPayload(tab);
    return {
        id: tab.id,
        title: tab.title,
        component: payload.component,
        params: { ...payload.params },
    };
}

function normalizeWorkbenchLayoutTab(value: unknown): WorkbenchTabDefinition | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const tab = value as Partial<WorkbenchTabDefinition>;
    const id = typeof tab.id === "string" ? tab.id.trim() : "";
    const title = typeof tab.title === "string" ? tab.title : id;
    const component = typeof tab.component === "string" ? tab.component.trim() : "";
    const params = tab.params && typeof tab.params === "object" && !Array.isArray(tab.params)
        ? tab.params as Record<string, unknown>
        : undefined;

    if (!id || !component) {
        return null;
    }

    return {
        id,
        title,
        component,
        params,
    };
}

/**
 * @function exportWorkbenchPanelLayoutSnapshot
 * @description 从当前 workbench 状态导出可序列化 panel split 快照。
 * @param state 当前 workbench 布局状态。
 * @returns panel split 快照。
 */
export function exportWorkbenchPanelLayoutSnapshot(
    state: VSCodeLayoutState<WorkbenchSectionData>,
): WorkbenchPanelLayoutSnapshot {
    const panelRoot = clonePanelLayoutSectionNode(state.root);
    const panelSectionIds = collectPanelSectionIds(panelRoot);
    const sections = Object.values(state.panelSections.sections)
        .filter((section) => panelSectionIds.has(section.id))
        .map((section) => ({
            id: section.id,
            panelIds: section.panels.map((panel) => panel.id),
            focusedPanelId: section.focusedPanelId,
            isCollapsed: section.isCollapsed,
            isRoot: section.isRoot,
        }));

    return {
        root: normalizePanelSectionCollapsedFixedSizes(panelRoot, sections),
        sections,
    };
}

/**
 * @function exportWorkbenchLayoutSnapshot
 * @description 从当前 workbench 状态导出主工作区布局快照。
 */
export function exportWorkbenchLayoutSnapshot(
    state: VSCodeLayoutState<WorkbenchSectionData>,
): WorkbenchLayoutSnapshot {
    return {
        version: 1,
        root: cloneWorkbenchLayoutSectionNode(state.root),
        tabSections: Object.values(state.tabSections.sections).map((section) => ({
            id: section.id,
            tabs: section.tabs.map(toWorkbenchTabDefinition),
            focusedTabId: section.focusedTabId,
            isRoot: section.isRoot,
        })),
        activeGroupId: state.workbench?.activeGroupId ?? null,
    };
}

/**
 * @function applyWorkbenchPanelLayoutSnapshot
 * @description 将持久化 panel split 快照套用到当前声明式 workbench 状态。
 * @param state 当前声明式 workbench 状态，提供最新 panel 定义与 icon 元数据。
 * @param snapshot 待恢复的 panel split 快照。
 * @returns 恢复后的 workbench 状态；快照非法时返回原状态。
 */
export function applyWorkbenchPanelLayoutSnapshot(
    state: VSCodeLayoutState<WorkbenchSectionData>,
    snapshot: WorkbenchPanelLayoutSnapshot | null | undefined,
): VSCodeLayoutState<WorkbenchSectionData> {
    if (!snapshot) {
        return state;
    }

    const root = clonePanelLayoutSectionNode(snapshot.root);
    if (!findSectionNode(root, WORKBENCH_LEFT_PANEL_SECTION_ID) && !findSectionNode(root, "left-sidebar")) {
        return state;
    }

    const tabSectionIds = collectTabSectionIds(root);
    if (tabSectionIds.size !== 1 || !tabSectionIds.has(WORKBENCH_MAIN_TAB_SECTION_ID)) {
        return state;
    }

    const panelSectionIds = collectPanelSectionIds(root);
    if (!panelSectionIds.has(WORKBENCH_LEFT_PANEL_SECTION_ID)) {
        return state;
    }

    const panelDefinitionById = buildPanelDefinitionById(state);
    const usedPanelIds = new Set<string>();
    const restoredSections = new Map<string, PanelSectionStateItem>();

    for (const sectionSnapshot of snapshot.sections) {
        if (!panelSectionIds.has(sectionSnapshot.id)) {
            continue;
        }

        const panels = sectionSnapshot.panelIds
            .map((panelId) => panelDefinitionById.get(panelId) ?? null)
            .filter((panel): panel is PanelSectionPanelDefinition => panel !== null);

        panels.forEach((panel) => usedPanelIds.add(panel.id));
        restoredSections.set(sectionSnapshot.id, {
            id: sectionSnapshot.id,
            panels,
            focusedPanelId: panels.some((panel) => panel.id === sectionSnapshot.focusedPanelId)
                ? sectionSnapshot.focusedPanelId
                : (panels[0]?.id ?? null),
            isCollapsed: sectionSnapshot.isCollapsed,
            isRoot: sectionSnapshot.isRoot,
        });
    }

    for (const [sectionId, baseSection] of Object.entries(state.panelSections.sections)) {
        if (!panelSectionIds.has(sectionId)) {
            continue;
        }

        const missingPanels = baseSection.panels.filter((panel) => !usedPanelIds.has(panel.id));
        const restoredSection = restoredSections.get(sectionId);
        if (!restoredSection) {
            restoredSections.set(sectionId, {
                ...baseSection,
                panels: missingPanels,
                focusedPanelId: missingPanels.some((panel) => panel.id === baseSection.focusedPanelId)
                    ? baseSection.focusedPanelId
                    : (missingPanels[0]?.id ?? null),
            });
            missingPanels.forEach((panel) => usedPanelIds.add(panel.id));
            continue;
        }

        if (missingPanels.length > 0) {
            const panels = [...restoredSection.panels, ...missingPanels];
            restoredSections.set(sectionId, {
                ...restoredSection,
                panels,
                focusedPanelId: panels.some((panel) => panel.id === restoredSection.focusedPanelId)
                    ? restoredSection.focusedPanelId
                    : (panels[0]?.id ?? null),
            });
            missingPanels.forEach((panel) => usedPanelIds.add(panel.id));
        }
    }

    for (const panelSectionId of panelSectionIds) {
        if (!restoredSections.has(panelSectionId)) {
            restoredSections.set(panelSectionId, {
                id: panelSectionId,
                panels: [],
                focusedPanelId: null,
                isCollapsed: false,
                isRoot: panelSectionId === WORKBENCH_LEFT_PANEL_SECTION_ID,
            });
        }
    }

    const restoredRoot = normalizePanelSectionCollapsedFixedSizes(root, restoredSections.values());

    return {
        ...state,
        root: restoreWorkbenchTabSubtrees(restoredRoot, state.root),
        panelSections: createPanelSectionsState(Array.from(restoredSections.values())),
    };
}

/**
 * @function applyWorkbenchLayoutSnapshot
 * @description 将持久化工作区主布局快照套用到当前声明式 workbench 状态。
 */
export function applyWorkbenchLayoutSnapshot(
    state: VSCodeLayoutState<WorkbenchSectionData>,
    snapshot: WorkbenchLayoutSnapshot | null | undefined,
): VSCodeLayoutState<WorkbenchSectionData> {
    if (!snapshot || snapshot.version !== 1) {
        return state;
    }

    const root = cloneWorkbenchLayoutSectionNode(snapshot.root);
    const currentHasRightSidebar = Boolean(findSectionNode(state.root, "right-sidebar"));
    const snapshotHasRightSidebar = Boolean(findSectionNode(root, "right-sidebar"));
    if (currentHasRightSidebar !== snapshotHasRightSidebar) {
        return state;
    }

    if (!findSectionNode(root, WORKBENCH_LEFT_ACTIVITY_BAR_ID) || !findSectionNode(root, "left-sidebar")) {
        return state;
    }

    const tabSectionIds = collectTabSectionIds(root);
    if (!tabSectionIds.has(WORKBENCH_MAIN_TAB_SECTION_ID)) {
        return state;
    }

    const restoredSections: TabSectionStateItem[] = [];
    const seenSectionIds = new Set<string>();
    const tabSectionSnapshots = Array.isArray(snapshot.tabSections) ? snapshot.tabSections : [];
    for (const sectionSnapshot of tabSectionSnapshots) {
        const id = typeof sectionSnapshot.id === "string" ? sectionSnapshot.id.trim() : "";
        if (!id || !tabSectionIds.has(id) || seenSectionIds.has(id)) {
            continue;
        }

        const tabs = Array.isArray(sectionSnapshot.tabs)
            ? sectionSnapshot.tabs
                  .map((tab) => normalizeWorkbenchLayoutTab(tab))
                  .filter((tab): tab is WorkbenchTabDefinition => tab !== null)
            : [];
        const focusedTabId = typeof sectionSnapshot.focusedTabId === "string" &&
            tabs.some((tab) => tab.id === sectionSnapshot.focusedTabId)
            ? sectionSnapshot.focusedTabId
            : (tabs[0]?.id ?? null);

        restoredSections.push({
            id,
            tabs: buildWorkbenchTabs(tabs),
            focusedTabId,
            isRoot: sectionSnapshot.isRoot === true || id === WORKBENCH_MAIN_TAB_SECTION_ID,
        });
        seenSectionIds.add(id);
    }

    for (const tabSectionId of tabSectionIds) {
        if (seenSectionIds.has(tabSectionId)) {
            continue;
        }

        restoredSections.push({
            id: tabSectionId,
            tabs: [],
            focusedTabId: null,
            isRoot: tabSectionId === WORKBENCH_MAIN_TAB_SECTION_ID,
        });
    }

    const activeGroupId = typeof snapshot.activeGroupId === "string" &&
        tabSectionIds.has(snapshot.activeGroupId)
        ? snapshot.activeGroupId
        : WORKBENCH_MAIN_TAB_SECTION_ID;

    return {
        ...state,
        root,
        tabSections: createTabSectionsState(restoredSections),
        workbench: { activeGroupId },
    };
}

export function createWorkbenchLayoutState(
    options: CreateWorkbenchLayoutOptions = {},
): VSCodeLayoutState<WorkbenchSectionData> {
    const {
        activities = [],
        panels = [],
        initialTabs = [],
        hasRightSidebar = false,
        initialSidebarState,
    } = options;

    const leftActivityId = initialSidebarState?.left?.activeActivityId ?? null;
    const rightActivityId = initialSidebarState?.right?.activeActivityId ?? null;
    const leftPanelId = initialSidebarState?.left?.activePanelId ?? null;
    const rightPanelId = initialSidebarState?.right?.activePanelId ?? null;
    const leftSidebarVisible = initialSidebarState?.left?.visible ?? true;
    const rightSidebarVisible = initialSidebarState?.right?.visible ?? true;

    const mainTabs = buildWorkbenchTabs(initialTabs);
    let root = createWorkbenchRootLayout(hasRightSidebar);
    root = setSectionHidden(root, "left-sidebar", !leftSidebarVisible);
    if (hasRightSidebar) {
        root = setSectionHidden(root, "right-sidebar", !rightSidebarVisible);
    }

    return createVSCodeLayoutState({
        root,
        activityBars: buildWorkbenchActivityBars(activities, leftActivityId, rightActivityId),
        panelSections: buildWorkbenchPanelSections(panels, activities, leftActivityId, rightActivityId, leftPanelId, rightPanelId),
        tabSections: {
            sections: {
                [WORKBENCH_MAIN_TAB_SECTION_ID]: {
                    id: WORKBENCH_MAIN_TAB_SECTION_ID,
                    tabs: mainTabs,
                    focusedTabId: mainTabs[0]?.id ?? null,
                    isRoot: true,
                },
            },
        },
        workbench: { activeGroupId: WORKBENCH_MAIN_TAB_SECTION_ID },
    });
}
