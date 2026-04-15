/**
 * @module tests/layoutPerformance.test
 * @description 布局引擎性能测试：验证 tab split、panel split、section resize 等核心操作
 *   在大规模数据下的性能表现。每个 benchmark 运行多次取中位数，断言不超过合理阈值。
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
    buildTabWorkbenchPreviewState,
    commitTabWorkbenchDrop,
    cleanupEmptyTabWorkbenchSections,
    buildPanelWorkbenchPreviewState,
    commitPanelWorkbenchDrop,
    cleanupEmptyPanelWorkbenchSections,
    createRootSection,
    createSectionComponentBinding,
    createTabSectionsState,
    createPanelSectionsState,
    findSectionNode,
    resizeSectionSplit,
    splitSectionTree,
    resetSectionSequenceForTest,
    type SectionComponentData,
    type SectionDraft,
    type SectionNode,
    type TabSectionDragSession,
    type TabSectionStateItem,
    type PanelSectionDragSession,
    type PanelSectionStateItem,
    type PanelSectionPanelDefinition,
    type TabSectionTabDefinition,
} from "../src";

// ─────────────────────────────────────────────────────────────────────────────
// Test-local binding data
// ─────────────────────────────────────────────────────────────────────────────

interface PerfBindingData extends SectionComponentData {
    role: "root" | "container" | "tab-leaf" | "panel-leaf";
}

function createDraft(
    id: string,
    title: string,
    role: PerfBindingData["role"],
    component: PerfBindingData["component"],
): SectionDraft<PerfBindingData> {
    return { id, title, data: { role, component } };
}

const tabAdapter = {
    createTabSectionDraft: ({ sourceLeaf, nextSectionId, nextTabSectionId, title }: {
        sourceLeaf: SectionNode<PerfBindingData>;
        nextSectionId: string;
        nextTabSectionId: string;
        title: string;
    }): SectionDraft<PerfBindingData> => ({
        id: nextSectionId,
        title,
        data: {
            role: sourceLeaf.data.role,
            component: createSectionComponentBinding("tab-section", { tabSectionId: nextTabSectionId }),
        },
        resizableEdges: sourceLeaf.resizableEdges,
    }),
};

const panelAdapter = {
    createPanelSectionDraft: ({ sourceLeaf, nextSectionId, nextPanelSectionId, title }: {
        sourceLeaf: SectionNode<PerfBindingData>;
        nextSectionId: string;
        nextPanelSectionId: string;
        title: string;
    }): SectionDraft<PerfBindingData> => ({
        id: nextSectionId,
        title,
        data: {
            role: sourceLeaf.data.role,
            component: createSectionComponentBinding("panel-section", { panelSectionId: nextPanelSectionId }),
        },
        resizableEdges: sourceLeaf.resizableEdges,
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Data factories
// ─────────────────────────────────────────────────────────────────────────────

function generateTabs(count: number): TabSectionTabDefinition[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `tab-${i}`,
        title: `Tab ${i}`,
        content: `Content body for tab ${i}. `.repeat(5),
        type: i % 3 === 0 ? "markdown" : i % 3 === 1 ? "settings" : "preview",
        payload: { index: i, path: `notes/section-${Math.floor(i / 10)}/note-${i}.md` },
    }));
}

function generatePanels(count: number): PanelSectionPanelDefinition[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `panel-${i}`,
        label: `Panel ${i}`,
        symbol: String.fromCharCode(65 + (i % 26)),
        content: `Panel content for panel ${i}. `.repeat(3),
    }));
}

/**
 * Build a wide section tree: a flat list of N leaf sections under a series of
 * horizontal splits starting from the root. Structure:
 *
 *   root ─H→ [leaf-0, rest-1 ─H→ [leaf-1, rest-2 ─H→ [..., leaf-N-1]]]
 *
 * Returns root and the array of leaf section IDs.
 */
function buildWideTabTree(leafCount: number): {
    root: SectionNode<PerfBindingData>;
    leafIds: string[];
    tabSections: TabSectionStateItem[];
} {
    const leafIds: string[] = [];
    const tabSections: TabSectionStateItem[] = [];

    let root = createRootSection<PerfBindingData>(
        createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    if (leafCount === 1) {
        const leafId = "leaf-0";
        const tabSectionId = "tabs-0";
        root = splitSectionTree(root, "root", "horizontal", {
            first: createDraft(leafId, `Leaf 0`, "tab-leaf", createSectionComponentBinding("tab-section", { tabSectionId })),
            second: createDraft("placeholder", "Placeholder", "container", createSectionComponentBinding("empty", {})),
        });
        leafIds.push(leafId);
        tabSections.push({
            id: tabSectionId,
            tabs: generateTabs(20),
            focusedTabId: "tab-0",
            isRoot: true,
        });
        return { root, leafIds, tabSections };
    }

    // First split
    root = splitSectionTree(root, "root", "horizontal", {
        ratio: 1 / leafCount,
        first: createDraft("leaf-0", "Leaf 0", "tab-leaf", createSectionComponentBinding("tab-section", { tabSectionId: "tabs-0" })),
        second: createDraft("rest-1", "Rest 1", "container", createSectionComponentBinding("empty", {})),
    });
    leafIds.push("leaf-0");
    tabSections.push({
        id: "tabs-0",
        tabs: generateTabs(20),
        focusedTabId: "tab-0",
        isRoot: false,
    });

    for (let i = 1; i < leafCount - 1; i++) {
        const leafId = `leaf-${i}`;
        const tabSectionId = `tabs-${i}`;
        const restId = `rest-${i + 1}`;
        root = splitSectionTree(root, `rest-${i}`, "horizontal", {
            ratio: 1 / (leafCount - i),
            first: createDraft(leafId, `Leaf ${i}`, "tab-leaf", createSectionComponentBinding("tab-section", { tabSectionId })),
            second: createDraft(restId, `Rest ${i + 1}`, "container", createSectionComponentBinding("empty", {})),
        });
        leafIds.push(leafId);
        tabSections.push({
            id: tabSectionId,
            tabs: generateTabs(20),
            focusedTabId: "tab-0",
            isRoot: false,
        });
    }

    // Last leaf replaces the final rest node via update
    const lastLeafId = `leaf-${leafCount - 1}`;
    const lastTabSectionId = `tabs-${leafCount - 1}`;
    const lastRestId = `rest-${leafCount - 1}`;
    const lastRestNode = findSectionNode(root, lastRestId);
    if (lastRestNode) {
        // Mutate-on-copy: just re-split isn't needed, the rest node IS the last leaf
        leafIds.push(lastRestId);
        tabSections.push({
            id: lastTabSectionId,
            tabs: generateTabs(20),
            focusedTabId: "tab-0",
            isRoot: true,
        });
    } else {
        leafIds.push(lastLeafId);
        tabSections.push({
            id: lastTabSectionId,
            tabs: generateTabs(20),
            focusedTabId: "tab-0",
            isRoot: true,
        });
    }

    return { root, leafIds, tabSections };
}

/**
 * Build a deep binary section tree: alternating horizontal/vertical splits
 * creating 2^depth leaf nodes.
 */
function buildDeepTree(depth: number): {
    root: SectionNode<PerfBindingData>;
    leafIds: string[];
} {
    let root = createRootSection<PerfBindingData>(
        createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    const leafIds: string[] = [];

    // BFS: maintain a queue of section IDs to split
    const queue: string[] = ["root"];
    let currentDepth = 0;

    while (currentDepth < depth && queue.length > 0) {
        const nextQueue: string[] = [];
        const direction = currentDepth % 2 === 0 ? "horizontal" : "vertical";

        for (const parentId of queue) {
            const firstId = `${parentId}-L${currentDepth}`;
            const secondId = `${parentId}-R${currentDepth}`;
            root = splitSectionTree(root, parentId, direction as "horizontal" | "vertical", {
                first: createDraft(firstId, firstId, "container", createSectionComponentBinding("empty", {})),
                second: createDraft(secondId, secondId, "container", createSectionComponentBinding("empty", {})),
            });
            nextQueue.push(firstId, secondId);
        }

        queue.length = 0;
        queue.push(...nextQueue);
        currentDepth++;
    }

    leafIds.push(...queue);
    return { root, leafIds };
}

/**
 * Build a panel section tree similar to the wide tab tree but for panel sections.
 */
function buildWidePanelTree(leafCount: number): {
    root: SectionNode<PerfBindingData>;
    leafIds: string[];
    panelSections: PanelSectionStateItem[];
} {
    const leafIds: string[] = [];
    const panelSections: PanelSectionStateItem[] = [];

    let root = createRootSection<PerfBindingData>(
        createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
    );

    if (leafCount === 1) {
        const sectionId = "panel-section-0";
        root = splitSectionTree(root, "root", "vertical", {
            first: createDraft("panel-leaf-0", "Panel Leaf 0", "panel-leaf",
                createSectionComponentBinding("panel-section", { panelSectionId: sectionId })),
            second: createDraft("placeholder", "Placeholder", "container",
                createSectionComponentBinding("empty", {})),
        });
        leafIds.push("panel-leaf-0");
        panelSections.push({
            id: sectionId,
            panels: generatePanels(10),
            focusedPanelId: "panel-0",
            isCollapsed: false,
            isRoot: true,
        });
        return { root, leafIds, panelSections };
    }

    // First split
    root = splitSectionTree(root, "root", "vertical", {
        ratio: 1 / leafCount,
        first: createDraft("panel-leaf-0", "Panel Leaf 0", "panel-leaf",
            createSectionComponentBinding("panel-section", { panelSectionId: "panel-section-0" })),
        second: createDraft("panel-rest-1", "Rest 1", "container",
            createSectionComponentBinding("empty", {})),
    });
    leafIds.push("panel-leaf-0");
    panelSections.push({
        id: "panel-section-0",
        panels: generatePanels(10),
        focusedPanelId: "panel-0",
        isCollapsed: false,
        isRoot: false,
    });

    for (let i = 1; i < leafCount - 1; i++) {
        root = splitSectionTree(root, `panel-rest-${i}`, "vertical", {
            ratio: 1 / (leafCount - i),
            first: createDraft(`panel-leaf-${i}`, `Panel Leaf ${i}`, "panel-leaf",
                createSectionComponentBinding("panel-section", { panelSectionId: `panel-section-${i}` })),
            second: createDraft(`panel-rest-${i + 1}`, `Rest ${i + 1}`, "container",
                createSectionComponentBinding("empty", {})),
        });
        leafIds.push(`panel-leaf-${i}`);
        panelSections.push({
            id: `panel-section-${i}`,
            panels: generatePanels(10),
            focusedPanelId: "panel-0",
            isCollapsed: false,
            isRoot: false,
        });
    }

    // Last leaf
    const lastRestId = `panel-rest-${leafCount - 1}`;
    leafIds.push(lastRestId);
    panelSections.push({
        id: `panel-section-${leafCount - 1}`,
        panels: generatePanels(10),
        focusedPanelId: "panel-0",
        isCollapsed: false,
        isRoot: true,
    });

    return { root, leafIds, panelSections };
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmark harness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run `fn` `iterations` times, return median duration in ms.
 * Each iteration gets a fresh setup via `setupFn`.
 */
function benchmark<TSetup>(
    setupFn: () => TSetup,
    fn: (setup: TSetup) => void,
    iterations: number = 50,
): { median: number; p95: number; min: number } {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const setup = setupFn();
        const start = performance.now();
        fn(setup);
        durations.push(performance.now() - start);
    }

    durations.sort((a, b) => a - b);
    return {
        median: durations[Math.floor(durations.length / 2)]!,
        p95: durations[Math.floor(durations.length * 0.95)]!,
        min: durations[0]!,
    };
}

afterEach(() => {
    resetSectionSequenceForTest();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab split performance
// ─────────────────────────────────────────────────────────────────────────────

describe("tab split 性能", () => {
    test("preview: 4 leaf sections × 20 tabs each, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, leafIds, tabSections } = buildWideTabTree(4);
                const state = createTabSectionsState(tabSections);
                const session: TabSectionDragSession = {
                    sourceTabSectionId: tabSections[0]!.id,
                    currentTabSectionId: tabSections[0]!.id,
                    sourceLeafSectionId: leafIds[0]!,
                    currentLeafSectionId: leafIds[0]!,
                    tabId: "tab-0",
                    title: "Tab 0",
                    content: "Content body for tab 0",
                    pointerId: 1,
                    originX: 10, originY: 10,
                    pointerX: 400, pointerY: 200,
                    phase: "dragging",
                    hoverTarget: {
                        area: "content",
                        leafSectionId: leafIds[1]!,
                        anchorLeafSectionId: leafIds[1]!,
                        tabSectionId: tabSections[1]!.id,
                        splitSide: "right",
                        contentBounds: { left: 200, top: 0, right: 500, bottom: 400, width: 300, height: 400 },
                    },
                };
                return { root, state, session };
            },
            ({ root, state, session }) => {
                const preview = buildTabWorkbenchPreviewState(root, state, session, tabAdapter);
                if (!preview) throw new Error("preview should not be null");
            },
        );

        console.info(`[perf] tab preview (4 leaves × 20 tabs): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("commit: 4 leaf sections × 20 tabs each, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, leafIds, tabSections } = buildWideTabTree(4);
                const state = createTabSectionsState(tabSections);
                const session: TabSectionDragSession = {
                    sourceTabSectionId: tabSections[0]!.id,
                    currentTabSectionId: tabSections[0]!.id,
                    sourceLeafSectionId: leafIds[0]!,
                    currentLeafSectionId: leafIds[0]!,
                    tabId: "tab-0",
                    title: "Tab 0",
                    content: "Content body for tab 0",
                    pointerId: 1,
                    originX: 10, originY: 10,
                    pointerX: 400, pointerY: 200,
                    phase: "dragging",
                    hoverTarget: {
                        area: "content",
                        leafSectionId: leafIds[1]!,
                        anchorLeafSectionId: leafIds[1]!,
                        tabSectionId: tabSections[1]!.id,
                        splitSide: "bottom",
                        contentBounds: { left: 200, top: 0, right: 500, bottom: 400, width: 300, height: 400 },
                    },
                };
                return { root, state, session };
            },
            ({ root, state, session }) => {
                const committed = commitTabWorkbenchDrop(root, state, session, tabAdapter);
                if (!committed) throw new Error("commit should not be null");
            },
        );

        console.info(`[perf] tab commit (4 leaves × 20 tabs): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("preview: 10 leaf sections × 50 tabs each (大规模), 中位数 < 10ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const leafCount = 10;
                const tabsPerSection = 50;
                const leafIds: string[] = [];
                const tabSections: TabSectionStateItem[] = [];

                let root = createRootSection<PerfBindingData>(
                    createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
                );

                root = splitSectionTree(root, "root", "horizontal", {
                    ratio: 1 / leafCount,
                    first: createDraft("leaf-0", "Leaf 0", "tab-leaf",
                        createSectionComponentBinding("tab-section", { tabSectionId: "tabs-0" })),
                    second: createDraft("rest-1", "Rest 1", "container",
                        createSectionComponentBinding("empty", {})),
                });
                leafIds.push("leaf-0");
                tabSections.push({
                    id: "tabs-0",
                    tabs: generateTabs(tabsPerSection),
                    focusedTabId: "tab-0",
                    isRoot: false,
                });

                for (let i = 1; i < leafCount - 1; i++) {
                    root = splitSectionTree(root, `rest-${i}`, "horizontal", {
                        ratio: 1 / (leafCount - i),
                        first: createDraft(`leaf-${i}`, `Leaf ${i}`, "tab-leaf",
                            createSectionComponentBinding("tab-section", { tabSectionId: `tabs-${i}` })),
                        second: createDraft(`rest-${i + 1}`, `Rest ${i + 1}`, "container",
                            createSectionComponentBinding("empty", {})),
                    });
                    leafIds.push(`leaf-${i}`);
                    tabSections.push({
                        id: `tabs-${i}`,
                        tabs: generateTabs(tabsPerSection),
                        focusedTabId: "tab-0",
                        isRoot: false,
                    });
                }
                leafIds.push(`rest-${leafCount - 1}`);
                tabSections.push({
                    id: `tabs-${leafCount - 1}`,
                    tabs: generateTabs(tabsPerSection),
                    focusedTabId: "tab-0",
                    isRoot: true,
                });

                const state = createTabSectionsState(tabSections);
                const session: TabSectionDragSession = {
                    sourceTabSectionId: "tabs-0",
                    currentTabSectionId: "tabs-0",
                    sourceLeafSectionId: "leaf-0",
                    currentLeafSectionId: "leaf-0",
                    tabId: "tab-0",
                    title: "Tab 0",
                    content: "Content body for tab 0",
                    pointerId: 1,
                    originX: 10, originY: 10,
                    pointerX: 600, pointerY: 300,
                    phase: "dragging",
                    hoverTarget: {
                        area: "content",
                        leafSectionId: leafIds[5]!,
                        anchorLeafSectionId: leafIds[5]!,
                        tabSectionId: `tabs-5`,
                        splitSide: "left",
                        contentBounds: { left: 300, top: 0, right: 600, bottom: 500, width: 300, height: 500 },
                    },
                };
                return { root, state, session };
            },
            ({ root, state, session }) => {
                const preview = buildTabWorkbenchPreviewState(root, state, session, tabAdapter);
                if (!preview) throw new Error("preview should not be null");
            },
        );

        console.info(`[perf] tab preview (10 leaves × 50 tabs): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(10);
    });

    test("cleanup: 8 leaf sections 其中 4 个为空, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, tabSections } = buildWideTabTree(8);
                // Make half the sections empty
                const modified = tabSections.map((section, i) =>
                    i % 2 === 0
                        ? { ...section, tabs: [], focusedTabId: null }
                        : section,
                );
                const state = createTabSectionsState(modified);
                return { root, state };
            },
            ({ root, state }) => {
                cleanupEmptyTabWorkbenchSections(root, state, tabAdapter);
            },
        );

        console.info(`[perf] tab cleanup (8 leaves, 4 empty): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Panel split performance
// ─────────────────────────────────────────────────────────────────────────────

describe("panel split 性能", () => {
    test("preview: 4 panel sections × 10 panels each, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, leafIds, panelSections } = buildWidePanelTree(4);
                const state = createPanelSectionsState(panelSections);
                const session: PanelSectionDragSession = {
                    sourcePanelSectionId: panelSections[0]!.id,
                    currentPanelSectionId: panelSections[0]!.id,
                    sourceLeafSectionId: leafIds[0]!,
                    currentLeafSectionId: leafIds[0]!,
                    activityTarget: null,
                    panelId: "panel-0",
                    label: "Panel 0",
                    symbol: "A",
                    content: "Panel content for panel 0",
                    pointerId: 1,
                    originX: 50, originY: 50,
                    pointerX: 200, pointerY: 300,
                    phase: "dragging",
                    hoverTarget: {
                        area: "content",
                        leafSectionId: leafIds[1]!,
                        anchorLeafSectionId: leafIds[1]!,
                        panelSectionId: panelSections[1]!.id,
                        splitSide: "bottom",
                        contentBounds: { left: 0, top: 200, right: 400, bottom: 600, width: 400, height: 400 },
                    },
                };
                return { root, state, session };
            },
            ({ root, state, session }) => {
                const preview = buildPanelWorkbenchPreviewState(root, state, session, panelAdapter);
                if (!preview) throw new Error("preview should not be null");
            },
        );

        console.info(`[perf] panel preview (4 leaves × 10 panels): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("commit: 4 panel sections × 10 panels each, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, leafIds, panelSections } = buildWidePanelTree(4);
                const state = createPanelSectionsState(panelSections);
                const session: PanelSectionDragSession = {
                    sourcePanelSectionId: panelSections[0]!.id,
                    currentPanelSectionId: panelSections[0]!.id,
                    sourceLeafSectionId: leafIds[0]!,
                    currentLeafSectionId: leafIds[0]!,
                    activityTarget: null,
                    panelId: "panel-0",
                    label: "Panel 0",
                    symbol: "A",
                    content: "Panel content for panel 0",
                    pointerId: 1,
                    originX: 50, originY: 50,
                    pointerX: 200, pointerY: 450,
                    phase: "dragging",
                    hoverTarget: {
                        area: "content",
                        leafSectionId: leafIds[1]!,
                        anchorLeafSectionId: leafIds[1]!,
                        panelSectionId: panelSections[1]!.id,
                        splitSide: "top",
                        contentBounds: { left: 0, top: 200, right: 400, bottom: 600, width: 400, height: 400 },
                    },
                };
                return { root, state, session };
            },
            ({ root, state, session }) => {
                const committed = commitPanelWorkbenchDrop(root, state, session, panelAdapter);
                if (!committed) throw new Error("commit should not be null");
            },
        );

        console.info(`[perf] panel commit (4 leaves × 10 panels): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("cleanup: 6 panel sections 其中 3 个为空, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, panelSections } = buildWidePanelTree(6);
                const modified = panelSections.map((section, i) =>
                    i % 2 === 0
                        ? { ...section, panels: [], focusedPanelId: null }
                        : section,
                );
                const state = createPanelSectionsState(modified);
                return { root, state };
            },
            ({ root, state }) => {
                cleanupEmptyPanelWorkbenchSections(root, state, panelAdapter);
            },
        );

        console.info(`[perf] panel cleanup (6 leaves, 3 empty): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section resize (divider drag) performance
// ─────────────────────────────────────────────────────────────────────────────

describe("section resize 性能", () => {
    test("单次 resizeSectionSplit: 8 节点宽树, 中位数 < 1ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root } = buildWideTabTree(8);
                return { root };
            },
            ({ root }) => {
                // Resize the root split
                resizeSectionSplit(root, "root", 0.35);
            },
            200,
        );

        console.info(`[perf] resize single (8-node wide tree): median=${result.median.toFixed(4)}ms p95=${result.p95.toFixed(4)}ms`);
        expect(result.median).toBeLessThan(1);
    });

    test("连续 60 次 resize 模拟拖拽: 8 节点宽树, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root } = buildWideTabTree(8);
                return { root };
            },
            ({ root }) => {
                let current = root;
                // Simulate a 60-frame drag from ratio 0.3 to 0.7
                for (let frame = 0; frame < 60; frame++) {
                    const ratio = 0.3 + (0.4 * frame) / 59;
                    current = resizeSectionSplit(current, "root", ratio);
                }
            },
            50,
        );

        console.info(`[perf] resize 60-frame drag (8-node wide tree): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("深度 6 的二叉树 resize (64 leaf nodes), 中位数 < 1ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root } = buildDeepTree(6);
                return { root };
            },
            ({ root }) => {
                resizeSectionSplit(root, "root", 0.4);
            },
            200,
        );

        console.info(`[perf] resize single (depth-6 tree, 64 leaves): median=${result.median.toFixed(4)}ms p95=${result.p95.toFixed(4)}ms`);
        expect(result.median).toBeLessThan(1);
    });

    test("连续 60 次 resize 模拟拖拽: 深度 6 二叉树, 中位数 < 10ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root } = buildDeepTree(6);
                return { root };
            },
            ({ root }) => {
                let current = root;
                for (let frame = 0; frame < 60; frame++) {
                    const ratio = 0.25 + (0.5 * frame) / 59;
                    current = resizeSectionSplit(current, "root", ratio);
                }
            },
            50,
        );

        console.info(`[perf] resize 60-frame drag (depth-6 tree): median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(10);
    });

    test("嵌套节点 resize: 深度 6 二叉树中间层, 中位数 < 1ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root } = buildDeepTree(6);
                // Resize a node at depth 3 (root-L0-R1-L2)
                const midNodeId = "root-L0-R1-L2";
                return { root, midNodeId };
            },
            ({ root, midNodeId }) => {
                resizeSectionSplit(root, midNodeId, 0.6);
            },
            200,
        );

        console.info(`[perf] resize nested node (depth-6 tree): median=${result.median.toFixed(4)}ms p95=${result.p95.toFixed(4)}ms`);
        expect(result.median).toBeLessThan(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section tree construction & traversal
// ─────────────────────────────────────────────────────────────────────────────

describe("section tree 操作性能", () => {
    test("splitSectionTree: 连续 20 次切割, 中位数 < 5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const root = createRootSection<PerfBindingData>(
                    createDraft("root", "Root", "root", createSectionComponentBinding("empty", {})),
                );
                return { root };
            },
            ({ root }) => {
                let current = root;
                let nextId = "root";
                for (let i = 0; i < 20; i++) {
                    const direction = i % 2 === 0 ? "horizontal" : "vertical";
                    current = splitSectionTree(current, nextId, direction as "horizontal" | "vertical", {
                        first: createDraft(`split-first-${i}`, `First ${i}`, "container",
                            createSectionComponentBinding("empty", {})),
                        second: createDraft(`split-second-${i}`, `Second ${i}`, "container",
                            createSectionComponentBinding("empty", {})),
                    });
                    nextId = `split-second-${i}`;
                }
            },
            50,
        );

        console.info(`[perf] 20 consecutive splits: median=${result.median.toFixed(3)}ms p95=${result.p95.toFixed(3)}ms`);
        expect(result.median).toBeLessThan(5);
    });

    test("findSectionNode: 深度 8 二叉树查找最深叶节点, 中位数 < 0.5ms", () => {
        const result = benchmark(
            () => {
                resetSectionSequenceForTest();
                const { root, leafIds } = buildDeepTree(8);
                // Pick the last leaf (deepest right path)
                const targetId = leafIds[leafIds.length - 1]!;
                return { root, targetId };
            },
            ({ root, targetId }) => {
                const found = findSectionNode(root, targetId);
                if (!found) throw new Error(`leaf ${targetId} not found`);
            },
            200,
        );

        console.info(`[perf] findSectionNode (depth-8 tree, 256 leaves): median=${result.median.toFixed(4)}ms p95=${result.p95.toFixed(4)}ms`);
        expect(result.median).toBeLessThan(0.5);
    });
});
