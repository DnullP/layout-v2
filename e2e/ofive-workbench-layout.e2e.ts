/**
 * @module e2e/ofive-workbench-layout
 * @description ofive-shaped workbench e2e coverage for the shared layout-v2 engine.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

const OFIVE_WORKBENCH_URL = "/?surface=ofive-workbench";
const SPLIT_ANIMATION_WAIT_MS = 320;
const MAIN_TAB_SECTION_ID = "main-tabs";
const LEFT_PANEL_SECTION_ID = "left-panel-section";
const RIGHT_PANEL_SECTION_ID = "right-panel-section";

interface SectionSnapshot {
    id: string | null;
    titles: string[];
    rect: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

interface PanelSnapshot {
    id: string | null;
    focusedPanelId: string | null;
    titles: string[];
    paneTitle: string | null;
    rect: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

interface OfiveCallbackCounts {
    sidebar: number;
    sectionRatio: number;
    panelLayout: number;
    layoutSnapshot: number;
    activeTab: number;
    closedTab: number;
    activityBars: number;
    activityDrop: number;
    activatedActivity: number;
}

declare global {
    interface Window {
        __LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__?: OfiveCallbackCounts;
        __LAYOUT_V2_OFIVE_API__?: {
            openTab: (tab: {
                id: string;
                title: string;
                component: string;
                params?: Record<string, unknown>;
            }) => void;
            activatePanel: (panelId: string) => void;
        } | null;
    }
}

async function gotoOfiveWorkbench(page: Page): Promise<void> {
    await page.goto(OFIVE_WORKBENCH_URL);
    await page.locator('[data-testid="ofive-workbench-example"]').waitFor({ state: "visible" });
    await page.locator(".layout-v2-tab-section").first().waitFor({ state: "visible" });
    await page.locator(`.layout-v2-panel-section[data-panel-section-id="${LEFT_PANEL_SECTION_ID}"]`).waitFor({ state: "visible" });
    await page.locator(`.layout-v2-panel-section[data-panel-section-id="${RIGHT_PANEL_SECTION_ID}"]`).waitFor({ state: "visible" });
}

async function waitForAnimationFrames(page: Page, frameCount = 1): Promise<void> {
    await page.evaluate(async (count) => {
        for (let index = 0; index < count; index += 1) {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });
        }
    }, frameCount);
}

async function dragLocatorToPoint(
    page: Page,
    locator: Locator,
    targetX: number,
    targetY: number,
): Promise<void> {
    await locator.waitFor({ state: "visible" });
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error("dragLocatorToPoint: source bounds missing");
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.waitForTimeout(20);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 12 });
    await waitForAnimationFrames(page, 2);
    await page.mouse.up();
    await page.waitForTimeout(SPLIT_ANIMATION_WAIT_MS);
}

async function movePointerWithoutDrop(
    page: Page,
    locator: Locator,
    targetX: number,
    targetY: number,
): Promise<void> {
    await locator.waitFor({ state: "visible" });
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error("movePointerWithoutDrop: source bounds missing");
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.waitForTimeout(20);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 12 });
    await waitForAnimationFrames(page, 2);
}

async function readTabSections(page: Page): Promise<SectionSnapshot[]> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>(".layout-v2-tab-section")).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                id: node.getAttribute("data-tab-section-id"),
                titles: Array.from(node.querySelectorAll<HTMLElement>(".layout-v2-tab-section__tab-title")).map((title) => title.textContent ?? ""),
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                },
            };
        });
    });
}

async function readCommittedTabSections(page: Page): Promise<SectionSnapshot[]> {
    return page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('[data-testid="main-dockview-host"]');
        const committedRoot = host?.querySelector<HTMLElement>(':scope > .layout-v2__root') ?? null;
        if (!committedRoot) {
            return [];
        }

        return Array.from(committedRoot.querySelectorAll<HTMLElement>(".layout-v2-tab-section")).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                id: node.getAttribute("data-tab-section-id"),
                titles: Array.from(node.querySelectorAll<HTMLElement>(".layout-v2-tab-section__tab-title")).map((title) => title.textContent ?? ""),
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                },
            };
        });
    });
}

async function readPanelSections(page: Page): Promise<PanelSnapshot[]> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>(".layout-v2-panel-section")).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                id: node.getAttribute("data-panel-section-id"),
                focusedPanelId: node.querySelector<HTMLElement>("[data-layout-role='panel-content']")?.getAttribute("data-layout-panel-id") ?? null,
                titles: Array.from(node.querySelectorAll<HTMLElement>(".layout-v2-panel-section__panel-tab"))
                    .map((tab) => tab.getAttribute("aria-label") ?? ""),
                paneTitle: node.querySelector<HTMLElement>(".layout-v2-panel-section__pane-title")?.textContent ?? null,
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                },
            };
        });
    });
}

async function readActivityOrder(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>("[data-layout-role='activity-icon']"))
            .map((icon) => icon.getAttribute("data-layout-icon-id") ?? "");
    });
}

async function readCounts(page: Page): Promise<OfiveCallbackCounts> {
    return page.evaluate(() => {
        return window.__LAYOUT_V2_OFIVE_EXAMPLE_COUNTS__ ?? {
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
    });
}

async function getProjectedMergeCenter(
    sourceSection: Locator,
    targetSection: Locator,
): Promise<{ x: number; y: number }> {
    const sourceBounds = await sourceSection.boundingBox();
    const targetBounds = await targetSection.boundingBox();
    if (!sourceBounds || !targetBounds) {
        throw new Error("getProjectedMergeCenter: section bounds missing");
    }

    return {
        x: (Math.min(sourceBounds.x, targetBounds.x) + Math.max(sourceBounds.x + sourceBounds.width, targetBounds.x + targetBounds.width)) / 2,
        y: (Math.min(sourceBounds.y, targetBounds.y) + Math.max(sourceBounds.y + sourceBounds.height, targetBounds.y + targetBounds.height)) / 2,
    };
}

test.describe("ofive workbench layout fixture", () => {
    test.beforeEach(async ({ page }) => {
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await gotoOfiveWorkbench(page);

        test.info().annotations.push({
            type: "layout-errors",
            description: JSON.stringify({ pageErrors, consoleErrors }),
        });
        (page as Page & { __layoutErrors?: { pageErrors: string[]; consoleErrors: string[] } }).__layoutErrors = {
            pageErrors,
            consoleErrors,
        };
    });

    test.afterEach(async ({ page }) => {
        const errors = (page as Page & { __layoutErrors?: { pageErrors: string[]; consoleErrors: string[] } }).__layoutErrors;
        expect(errors?.pageErrors ?? []).toEqual([]);
        expect(errors?.consoleErrors ?? []).toEqual([]);
    });

    test("renders ofive current workbench shell with left and right layout surfaces", async ({ page }) => {
        await expect(page.locator('[data-testid="activity-bar-item-files"]')).toBeVisible();
        await expect(page.locator('[data-testid="activity-bar-item-search"]')).toBeVisible();
        await expect(page.locator('[data-testid="activity-bar-item-__settings__"]')).toBeVisible();
        await expect(page.locator('[data-testid="sidebar-left"] .layout-v2-panel-section__pane-title')).toHaveText("Explorer");
        await expect(page.locator('[data-testid="sidebar-right"] .layout-v2-panel-section__pane-title')).toHaveText("Outline");

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.id).toBe(MAIN_TAB_SECTION_ID);
        expect(sections[0]?.titles).toEqual(["guide.md", "tasks.md", "roadmap.canvas"]);

        const rightPanels = page.locator('[data-testid="sidebar-right"] .layout-v2-panel-section__panel-tab');
        await expect(rightPanels).toHaveCount(4);
        await expect(rightPanels.nth(0)).toHaveAttribute("aria-label", "AI Chat");
        await expect(rightPanels.nth(1)).toHaveAttribute("aria-label", "Outline");
        await expect(rightPanels.nth(2)).toHaveAttribute("aria-label", "Backlinks");
        await expect(rightPanels.nth(3)).toHaveAttribute("aria-label", "Calendar");
    });

    test("switches panel-container activities and callback activities open tabs", async ({ page }) => {
        await page.locator('[data-testid="activity-bar-item-search"]').click();
        await expect(page.locator('[data-testid="sidebar-left"] .layout-v2-panel-section__pane-title')).toHaveText("Search");
        await expect(page.locator('[data-testid="sidebar-left"] .layout-v2-panel-section__panel-tab')).toHaveCount(1);

        await page.locator('[data-testid="activity-bar-item-calendar"]').click();
        await expect(page.locator(".layout-v2-tab-section__tab-title", { hasText: "Calendar" })).toBeVisible();
        await expect(page.locator('[data-testid="ofive-tab-calendar"]')).toBeVisible();

        await page.locator('[data-testid="activity-bar-item-__settings__"]').click();
        await expect(page.locator(".layout-v2-tab-section__tab-title", { hasText: "Settings" })).toBeVisible();

        const counts = await readCounts(page);
        expect(counts.sidebar).toBeGreaterThan(0);
        expect(counts.activatedActivity).toBeGreaterThanOrEqual(2);
    });

    test("splits, previews, merges, and closes ofive editor tabs with overlay preview", async ({ page }) => {
        const sourceTab = page.locator(".layout-v2-tab-section__tab-main", { hasText: "guide.md" }).first();
        const targetContent = page.locator(`.layout-v2-tab-section[data-tab-section-id="${MAIN_TAB_SECTION_ID}"] .layout-v2-tab-section__content`).first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("ofive tab preview bounds missing");
        }

        await movePointerWithoutDrop(
            page,
            sourceTab,
            targetBounds.x + targetBounds.width - 14,
            targetBounds.y + targetBounds.height / 2,
        );

        await expect(page.locator('[data-layout-tab-preview-overlay="true"]')).toBeVisible();
        await expect(page.locator('[data-testid="ofive-editor-preview-mirror"]').first()).toBeVisible();
        const duringDragCommitted = await readCommittedTabSections(page);
        expect(duringDragCommitted).toHaveLength(1);
        expect(duringDragCommitted[0]?.titles).toEqual(["guide.md", "tasks.md", "roadmap.canvas"]);

        await page.mouse.up();
        await page.waitForTimeout(SPLIT_ANIMATION_WAIT_MS);

        const splitSections = await readTabSections(page);
        expect(splitSections).toHaveLength(2);
        expect(splitSections.find((section) => section.id === MAIN_TAB_SECTION_ID)?.titles).toEqual(["tasks.md", "roadmap.canvas"]);
        expect(splitSections.find((section) => section.titles.includes("guide.md"))?.titles).toEqual(["guide.md"]);

        const sourceSection = page.locator(".layout-v2-tab-section", {
            has: page.locator(".layout-v2-tab-section__tab-title", { hasText: "guide.md" }),
        }).first();
        const targetSection = page.locator(`.layout-v2-tab-section[data-tab-section-id="${MAIN_TAB_SECTION_ID}"]`).first();
        const mergeCenter = await getProjectedMergeCenter(sourceSection, targetSection);
        await dragLocatorToPoint(page, sourceSection.locator(".layout-v2-tab-section__tab-main", { hasText: "guide.md" }), mergeCenter.x, mergeCenter.y);

        const mergedSections = await readTabSections(page);
        expect(mergedSections).toHaveLength(1);
        expect(mergedSections[0]?.titles).toEqual(["tasks.md", "roadmap.canvas", "guide.md"]);

        await page.locator('.layout-v2-tab-section__tab-close[aria-label="Close guide.md"]').click();
        await page.waitForTimeout(SPLIT_ANIMATION_WAIT_MS);
        await expect(page.locator(".layout-v2-tab-section__tab-title", { hasText: "guide.md" })).toHaveCount(0);

        const counts = await readCounts(page);
        expect(counts.closedTab).toBeGreaterThanOrEqual(1);
        expect(counts.layoutSnapshot).toBeGreaterThan(0);
    });

    test("resizes sidebars with dom-flex and reports only ratio callbacks", async ({ page }) => {
        const before = await readCounts(page);
        const divider = page
            .locator(".layout-v2__divider--horizontal:not(.layout-v2__divider--disabled)[aria-label='Resize sections']")
            .nth(1);
        await divider.waitFor({ state: "visible" });
        const dividerBox = await divider.boundingBox();
        const mainBefore = await page.locator(`.layout-v2-tab-section[data-tab-section-id="${MAIN_TAB_SECTION_ID}"]`).boundingBox();
        if (!dividerBox || !mainBefore) {
            throw new Error("ofive resize bounds missing");
        }

        await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dividerBox.x + dividerBox.width / 2 + 72, dividerBox.y + dividerBox.height / 2, { steps: 8 });
        await waitForAnimationFrames(page, 2);
        await page.mouse.up();
        await waitForAnimationFrames(page, 2);

        const mainAfter = await page.locator(`.layout-v2-tab-section[data-tab-section-id="${MAIN_TAB_SECTION_ID}"]`).boundingBox();
        if (!mainAfter) {
            throw new Error("ofive resized main bounds missing");
        }

        const after = await readCounts(page);
        expect(Math.abs(mainAfter.width - mainBefore.width)).toBeGreaterThan(40);
        expect(after.sectionRatio).toBeGreaterThan(before.sectionRatio);
        expect(after.layoutSnapshot).toBe(before.layoutSnapshot);
        expect(after.panelLayout).toBe(before.panelLayout);
    });

    test("splits and collapses right panel sections while keeping ofive panels focused", async ({ page }) => {
        const source = page.locator(`.layout-v2-panel-section[data-panel-section-id="${RIGHT_PANEL_SECTION_ID}"] .layout-v2-panel-section__panel-tab[aria-label="Backlinks"]`);
        const content = page.locator(`.layout-v2-panel-section[data-panel-section-id="${RIGHT_PANEL_SECTION_ID}"] .layout-v2-panel-section__content`);
        const bounds = await content.boundingBox();
        if (!bounds) {
            throw new Error("ofive panel split bounds missing");
        }

        await dragLocatorToPoint(page, source, bounds.x + bounds.width / 2, bounds.y + 14);

        const panelSections = await readPanelSections(page);
        expect(panelSections.length).toBeGreaterThanOrEqual(3);
        expect(panelSections.some((section) => section.paneTitle === "Backlinks")).toBe(true);
        expect(panelSections.some((section) => section.titles.includes("Outline"))).toBe(true);
        expect(panelSections.every((section) => section.titles.length > 0 || section.id === LEFT_PANEL_SECTION_ID)).toBe(true);

        const backlinksSection = page.locator(".layout-v2-panel-section", {
            has: page.locator(".layout-v2-panel-section__pane-title", { hasText: "Backlinks" }),
        }).first();
        const toggle = backlinksSection.locator(".layout-v2-panel-section__toggle");
        const contentNode = backlinksSection.locator(".layout-v2-panel-section__content");
        await toggle.click();
        await waitForAnimationFrames(page, 2);
        await expect(contentNode).toHaveClass(/layout-v2-panel-section__content--collapsed/);
        await backlinksSection.locator('.layout-v2-panel-section__panel-tab[aria-label="Backlinks"]').click();
        await waitForAnimationFrames(page, 2);
        await expect(contentNode).not.toHaveClass(/layout-v2-panel-section__content--collapsed/);

        const counts = await readCounts(page);
        expect(counts.panelLayout).toBeGreaterThan(0);
    });

    test("reorders activity icons without losing selected panel activity", async ({ page }) => {
        await page.locator('[data-testid="activity-bar-item-search"]').click();
        const initialOrder = await readActivityOrder(page);
        expect(initialOrder.slice(0, 6)).toEqual(["files", "search", "knowledge-graph", "calendar", "architecture-devtools", "task-board"]);

        const source = page.locator('[data-testid="activity-bar-item-calendar"]');
        const target = page.locator('[data-testid="activity-bar-item-files"]');
        const targetBox = await target.boundingBox();
        if (!targetBox) {
            throw new Error("ofive activity reorder target bounds missing");
        }

        await dragLocatorToPoint(page, source, targetBox.x + targetBox.width / 2, targetBox.y + 2);

        await expect.poll(() => readActivityOrder(page)).toEqual([
            "calendar",
            "files",
            "search",
            "knowledge-graph",
            "architecture-devtools",
            "task-board",
            "test-message",
            "__settings__",
        ]);
        await expect(page.locator('[data-testid="sidebar-left"] .layout-v2-panel-section__pane-title')).toHaveText("Search");

        const counts = await readCounts(page);
        expect(counts.activityBars).toBeGreaterThan(0);
    });

    test("opens an external ofive file drag as a split editor tab", async ({ page }) => {
        const source = page.locator('[data-testid="ofive-external-file-source"]');
        const targetContent = page.locator(`.layout-v2-tab-section[data-tab-section-id="${MAIN_TAB_SECTION_ID}"] .layout-v2-tab-section__content`).first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("ofive external drag target bounds missing");
        }

        await source.dragTo(targetContent, {
            sourcePosition: { x: 20, y: 8 },
            targetPosition: { x: targetBounds.width - 14, y: targetBounds.height / 2 },
        });
        await page.waitForTimeout(SPLIT_ANIMATION_WAIT_MS);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(2);
        expect(sections.some((section) => section.titles.includes("external-drag.md"))).toBe(true);
        await expect(page.locator('[data-testid="ofive-tab-file:notes/external-drag.md"]')).toBeVisible();
    });

    test("can open tabs through the public workbench API and activate panels imperatively", async ({ page }) => {
        await page.evaluate(() => {
            window.__LAYOUT_V2_OFIVE_API__?.openTab({
                id: "file:notes/api-open.md",
                title: "api-open.md",
                component: "codemirror",
                params: {
                    path: "notes/api-open.md",
                    heading: "API Open",
                    body: "Opened via public workbench api",
                },
            });
            window.__LAYOUT_V2_OFIVE_API__?.activatePanel("agent-skills");
        });

        await expect(page.locator(".layout-v2-tab-section__tab-title", { hasText: "api-open.md" })).toBeVisible();
        await expect(page.locator('[data-testid="sidebar-left"] .layout-v2-panel-section__pane-title')).toHaveText("Agent Skills");
    });
});
