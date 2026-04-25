import { expect, test, type Locator, type Page } from "@playwright/test";

const LAYOUT_V2_EXAMPLE_URL = "/";
const LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS = 320;
const TAB_WELCOME = "Welcome";
const TAB_REVIEW = "Review";
const TAB_METRICS = "Metrics";

interface LayoutV2SectionSnapshot {
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

async function gotoLayoutV2Example(page: Page): Promise<void> {
    await page.goto(LAYOUT_V2_EXAMPLE_URL);
    await page.locator(".layout-v2-tab-section").first().waitFor({ state: "visible" });
}

async function waitForNextAnimationFrame(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    }));
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
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);
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
    await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);
}

async function readTabSections(page: Page): Promise<LayoutV2SectionSnapshot[]> {
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

async function dragTabToSectionContentSide(
    page: Page,
    tabTitle: string,
    targetSectionId: string,
    side: "right" | "bottom",
): Promise<void> {
    const sourceTab = page.locator(".layout-v2-tab-section__tab-main", {
        hasText: tabTitle,
    }).first();
    const targetContent = page.locator(`.layout-v2-tab-section[data-tab-section-id="${targetSectionId}"] .layout-v2-tab-section__content`).first();
    const bounds = await targetContent.boundingBox();
    if (!bounds) {
        throw new Error(`dragTabToSectionContentSide: target bounds missing for ${targetSectionId}`);
    }

    const targetX = side === "right" ? bounds.x + bounds.width - 14 : bounds.x + bounds.width / 2;
    const targetY = side === "bottom" ? bounds.y + bounds.height - 14 : bounds.y + bounds.height / 2;
    await dragLocatorToPoint(page, sourceTab, targetX, targetY);
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

async function createRightSideSplit(page: Page, tabTitle: string = TAB_WELCOME): Promise<void> {
    await dragTabToSectionContentSide(page, tabTitle, "main-tabs", "right");
}

async function createLeftSideSplit(page: Page, tabTitle: string = TAB_WELCOME): Promise<void> {
    const sourceTab = page.locator(".layout-v2-tab-section__tab-main", {
        hasText: tabTitle,
    }).first();
    const targetContent = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"] .layout-v2-tab-section__content').first();
    const bounds = await targetContent.boundingBox();
    if (!bounds) {
        throw new Error(`createLeftSideSplit: target bounds missing for main-tabs`);
    }

    await dragLocatorToPoint(page, sourceTab, bounds.x + 14, bounds.y + bounds.height / 2);
}

test.describe("tab workbench lifecycle", () => {
    test("preview split should render a preview tab section before drop", async ({ page }) => {
        await gotoLayoutV2Example(page);

        const sourceTab = page.locator(".layout-v2-tab-section__tab-main", { hasText: TAB_WELCOME }).first();
        const targetContent = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"] .layout-v2-tab-section__content').first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("preview split target bounds missing");
        }

        await movePointerWithoutDrop(
            page,
            sourceTab,
            targetBounds.x + targetBounds.width - 14,
            targetBounds.y + targetBounds.height / 2,
        );

        const previewSections = await readTabSections(page);
        expect(previewSections).toHaveLength(2);
        expect(previewSections.find((section) => section.id === "main-tabs")?.titles).toEqual([TAB_REVIEW, TAB_METRICS]);
        expect(previewSections.find((section) => (section.id ?? "").startsWith("preview-tab-section"))?.titles).toEqual([TAB_WELCOME]);

        await page.mouse.up();
    });

    test("split commit should create a second committed tab section", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await createRightSideSplit(page);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(2);
        expect(sections.find((section) => section.id === "main-tabs")?.titles).toEqual([TAB_REVIEW, TAB_METRICS]);
        expect(sections.find((section) => section.titles.includes(TAB_WELCOME))?.titles).toEqual([TAB_WELCOME]);
    });

    test("preview pre-destroy should collapse a lone source section before split preview", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await createRightSideSplit(page);

        const sourceTab = page.locator(".layout-v2-tab-section__tab-main", { hasText: TAB_WELCOME }).first();
        const targetContent = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"] .layout-v2-tab-section__content').first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("pre-destroy split target bounds missing");
        }

        await movePointerWithoutDrop(
            page,
            sourceTab,
            targetBounds.x + targetBounds.width - 14,
            targetBounds.y + targetBounds.height / 2,
        );

        const previewSections = await readTabSections(page);
        expect(previewSections.some((section) => section.titles.length === 0 && !(section.id ?? "").startsWith("preview-tab-section"))).toBe(false);
        expect(previewSections.find((section) => section.id === "main-tabs")?.titles).toEqual([TAB_REVIEW, TAB_METRICS]);
        expect(previewSections.find((section) => (section.id ?? "").startsWith("preview-tab-section"))?.titles).toEqual([TAB_WELCOME]);

        await page.mouse.up();
    });

    test("preview merge should project to a single merged section", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await createRightSideSplit(page);

        const sourceSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: TAB_WELCOME }),
        }).first();
        const targetSection = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]').first();
        const sourceTab = sourceSection.locator('.layout-v2-tab-section__tab-main', { hasText: TAB_WELCOME }).first();
        const mergeCenter = await getProjectedMergeCenter(sourceSection, targetSection);

        await movePointerWithoutDrop(page, sourceTab, mergeCenter.x, mergeCenter.y);

        const previewSections = await readTabSections(page);
        expect(previewSections).toHaveLength(1);
        expect(previewSections[0]?.titles).toEqual([TAB_REVIEW, TAB_METRICS, TAB_WELCOME]);

        await page.mouse.up();
    });

    test("merge commit should collapse back to a single section", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await createRightSideSplit(page);

        const sourceSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: TAB_WELCOME }),
        }).first();
        const targetSection = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]').first();
        const sourceTab = sourceSection.locator('.layout-v2-tab-section__tab-main', { hasText: TAB_WELCOME }).first();
        const mergeCenter = await getProjectedMergeCenter(sourceSection, targetSection);

        await dragLocatorToPoint(page, sourceTab, mergeCenter.x, mergeCenter.y);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.titles).toEqual([TAB_REVIEW, TAB_METRICS, TAB_WELCOME]);
    });

    test("closing the last tab in a split child section should destroy that section", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await createRightSideSplit(page);

        await page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: TAB_WELCOME }),
        }).first().locator('.layout-v2-tab-section__tab-close[aria-label="Close Welcome"]').click();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.titles).toEqual([TAB_REVIEW, TAB_METRICS]);
    });

    test("closing the lone left child after the first left split should destroy that section", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await createLeftSideSplit(page);

        await page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: TAB_WELCOME }),
        }).first().locator('.layout-v2-tab-section__tab-close[aria-label="Close Welcome"]').click();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.id).toBe("main-tabs");
        expect(sections[0]?.titles).toEqual([TAB_REVIEW, TAB_METRICS]);
    });

    test("closing the left main-tabs child after the first right split should destroy that section", async ({ page }) => {
        await gotoLayoutV2Example(page);
        await page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]')
            .locator('.layout-v2-tab-section__tab-close[aria-label="Close Metrics"]')
            .click();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        await createRightSideSplit(page, TAB_REVIEW);

        await page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]')
            .locator('.layout-v2-tab-section__tab-close[aria-label="Close Welcome"]')
            .click();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.id).not.toBe("main-tabs");
        expect(sections[0]?.titles).toEqual([TAB_REVIEW]);
    });

    test("preview should switch from right split to top split when a stronger vertical zone is entered", async ({ page }) => {
        await gotoLayoutV2Example(page);

        const sourceTab = page.locator(".layout-v2-tab-section__tab-main", { hasText: TAB_WELCOME }).first();
        const targetContent = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"] .layout-v2-tab-section__content').first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("preview switch target bounds missing");
        }

        const startBounds = await sourceTab.boundingBox();
        if (!startBounds) {
            throw new Error("preview switch source bounds missing");
        }

        await page.mouse.move(startBounds.x + startBounds.width / 2, startBounds.y + startBounds.height / 2);
        await page.mouse.down();

        await page.mouse.move(
            targetBounds.x + targetBounds.width * 0.78,
            targetBounds.y + targetBounds.height / 2,
            { steps: 12 },
        );
        await waitForNextAnimationFrame(page);

        const rightPreviewSections = await readTabSections(page);
        expect(rightPreviewSections).toHaveLength(2);
        const rightMainSection = rightPreviewSections.find((section) => section.id === "main-tabs");
        const rightPreviewSection = rightPreviewSections.find((section) => section.titles.includes(TAB_WELCOME));
        expect(rightMainSection).toBeTruthy();
        expect(rightPreviewSection).toBeTruthy();
        expect(rightPreviewSection!.rect.left).toBeGreaterThan((rightMainSection?.rect.left ?? 0) + 40);
        expect(Math.abs((rightPreviewSection?.rect.top ?? 0) - (rightMainSection?.rect.top ?? 9999))).toBeLessThan(12);

        await page.mouse.move(
            targetBounds.x + targetBounds.width * 0.78,
            targetBounds.y + targetBounds.height * 0.08,
            { steps: 12 },
        );
        await waitForNextAnimationFrame(page);

        const topPreviewSections = await readTabSections(page);
        expect(topPreviewSections).toHaveLength(2);
        const topMainSection = topPreviewSections.find((section) => section.id === "main-tabs");
        const topPreviewSection = topPreviewSections.find((section) => section.titles.includes(TAB_WELCOME));
        expect(topMainSection).toBeTruthy();
        expect(topPreviewSection).toBeTruthy();
        expect(Math.abs((topPreviewSection?.rect.left ?? 0) - (topMainSection?.rect.left ?? 9999))).toBeLessThan(12);
        expect((topPreviewSection?.rect.top ?? 0)).toBeLessThan((topMainSection?.rect.top ?? 0) + 20);
        expect((topMainSection?.rect.top ?? 0)).toBeGreaterThan((topPreviewSection?.rect.top ?? 0) + 40);

        await page.mouse.up();
    });

    test("nested partition commit should create a lower-right third section", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, TAB_WELCOME, "main-tabs", "bottom");
        await dragTabToSectionContentSide(page, TAB_REVIEW, "main-tabs", "bottom");

        const lowerSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: TAB_WELCOME }),
        }).first();
        const lowerContentBounds = await lowerSection.locator('.layout-v2-tab-section__content').boundingBox();
        if (!lowerContentBounds) {
            throw new Error("nested partition lower bounds missing");
        }

        await dragLocatorToPoint(
            page,
            page.locator('.layout-v2-tab-section__tab-main', { hasText: TAB_REVIEW }).first(),
            lowerContentBounds.x + lowerContentBounds.width - 14,
            lowerContentBounds.y + lowerContentBounds.height / 2,
        );

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(3);

        const topSection = sections.find((section) => section.titles.length === 1 && section.titles[0] === TAB_METRICS);
        const welcomeSection = sections.find((section) => section.titles.length === 1 && section.titles[0] === TAB_WELCOME);
        const reviewSection = sections.find((section) => section.titles.length === 1 && section.titles[0] === TAB_REVIEW);

        expect(topSection).toBeTruthy();
        expect(welcomeSection).toBeTruthy();
        expect(reviewSection).toBeTruthy();
        expect(Math.abs((welcomeSection?.rect.top ?? 0) - (reviewSection?.rect.top ?? 9999))).toBeLessThan(6);
        expect((welcomeSection?.rect.top ?? 0)).toBeGreaterThan((topSection?.rect.top ?? 0) + 40);
        expect(Math.abs((welcomeSection?.rect.width ?? 0) - (reviewSection?.rect.width ?? 0))).toBeLessThan(12);
    });
});