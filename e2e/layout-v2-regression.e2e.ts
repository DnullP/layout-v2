/**
 * @module e2e/layout-v2-regression
 * @description layout-v2 示例页回归测试：覆盖 activity bar 重排、tab split 命中与 preview 空壳清理。
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

const LAYOUT_V2_EXAMPLE_URL = "/";
const LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS = 320;

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
    emptyCardText: string | null;
}

/**
 * @function gotoLayoutV2Example
 * @description 打开 layout-v2 示例页并等待初始布局渲染完成。
 * @param page Playwright 页面对象。
 */
async function gotoLayoutV2Example(page: Page): Promise<void> {
    await page.goto(LAYOUT_V2_EXAMPLE_URL);
    await page.locator(".layout-v2-activity-bar__icon").first().waitFor({ state: "visible" });
    await page.locator(".layout-v2-tab-section").first().waitFor({ state: "visible" });
}

/**
 * @function dragLocatorToPoint
 * @description 以真实鼠标事件将指定 locator 拖到页面坐标点。
 * @param page Playwright 页面对象。
 * @param locator 拖拽源 locator。
 * @param targetX 目标横坐标。
 * @param targetY 目标纵坐标。
 */
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

/**
 * @function readActivityBarOrder
 * @description 读取当前 activity bar 图标顺序。
 * @param page Playwright 页面对象。
 * @returns icon label 顺序。
 */
async function readActivityBarOrder(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLButtonElement>(".layout-v2-activity-bar__icon"))
            .map((button) => button.getAttribute("aria-label") ?? "");
    });
}

/**
 * @function readTabSections
 * @description 读取当前 tab section 布局快照。
 * @param page Playwright 页面对象。
 * @returns section 快照列表。
 */
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
                emptyCardText: node.querySelector<HTMLElement>(".layout-v2-tab-section__empty-card")?.textContent ?? null,
            };
        });
    });
}

/**
 * @function dragTabToSectionContentSide
 * @description 将指定 tab 拖到目标 section content 的分区边缘。
 * @param page Playwright 页面对象。
 * @param tabTitle 拖拽源 tab 文本。
 * @param targetSectionId 目标 section id。
 * @param side 目标分区方向。
 */
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

/**
 * @function movePointerWithoutDrop
 * @description 将指定 tab 拖到目标坐标，但保持鼠标按下以观察 preview 状态。
 * @param page Playwright 页面对象。
 * @param locator 拖拽源 locator。
 * @param targetX 目标横坐标。
 * @param targetY 目标纵坐标。
 */
async function movePointerWithoutDrop(
    page: Page,
    locator: Locator,
    targetX: number,
    targetY: number,
): Promise<void> {
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

/**
 * @function getProjectedMergeCenter
 * @description 基于 source section 与 target section 的联合区域，计算预折叠后的几何中心。
 * @param sourceSection 拖拽源 section locator。
 * @param targetSection 目标 section locator。
 * @returns 预期 merge 命中的几何中心点。
 */
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

/**
 * @function readTabSlotTransforms
 * @description 读取指定 tab section 下各 tab slot 的 transform，用于确认拖拽预览期间没有把 tab 平移出可视区。
 * @param page Playwright 页面对象。
 * @param tabSectionId 目标 tab section id。
 * @returns 每个 slot 的标题和 transform。
 */
async function readTabSlotTransforms(page: Page, tabSectionId: string): Promise<Array<{ title: string; transform: string }>> {
    return page.evaluate((sectionId) => {
        return Array.from(document.querySelectorAll<HTMLElement>(`.layout-v2-tab-section[data-tab-section-id="${sectionId}"] .layout-v2-tab-section__tab-slot`)).map((slot) => ({
            title: slot.querySelector<HTMLElement>('.layout-v2-tab-section__tab-title')?.textContent ?? '',
            transform: window.getComputedStyle(slot).transform,
        }));
    }, tabSectionId);
}

test.describe("layout-v2 regressions", () => {
    test("clicking a tab should switch focus and visible card content", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Daily Notes' }).click();

        await expect(page.locator('.layout-v2-tab-section__tab--focused .layout-v2-tab-section__tab-title')).toHaveText('Daily Notes');
        await expect(page.locator('.layout-v2-tab-section__card-title')).toHaveText('Daily Notes');
    });

    test("activity bar dragging should reorder icons without losing selection", async ({ page }) => {
        await gotoLayoutV2Example(page);

        const initialOrder = await readActivityBarOrder(page);
        expect(initialOrder).toEqual(["Explorer", "Search", "Source Control", "Extensions"]);

        const source = page.locator('.layout-v2-activity-bar__icon[aria-label="Explorer"]');
        const target = page.locator('.layout-v2-activity-bar__icon[aria-label="Extensions"]');
        const targetBox = await target.boundingBox();
        if (!targetBox) {
            throw new Error("activity bar target bounds missing");
        }

        await dragLocatorToPoint(
            page,
            source,
            targetBox.x + targetBox.width / 2,
            targetBox.y + targetBox.height + 8,
        );

        await expect.poll(() => readActivityBarOrder(page)).toEqual([
            "Search",
            "Source Control",
            "Extensions",
            "Explorer",
        ]);
        await expect(page.locator('.layout-v2-activity-bar__icon[aria-label="Explorer"]')).toHaveClass(/selected/);
    });

    test("dragging the middle section tab to the lower content right edge should create a lower right split", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Welcome", "main-tabs", "bottom");
        await dragTabToSectionContentSide(page, "Daily Notes", "main-tabs", "bottom");

        const lowerSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first();
        const lowerContentBounds = await lowerSection.locator('.layout-v2-tab-section__content').boundingBox();
        if (!lowerContentBounds) {
            throw new Error("lower content bounds missing");
        }

        await dragLocatorToPoint(
            page,
            page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Daily Notes' }).first(),
            lowerContentBounds.x + lowerContentBounds.width - 14,
            lowerContentBounds.y + lowerContentBounds.height / 2,
        );

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(3);

        const topSection = sections.find((section) => section.titles.includes("Outline") && section.titles.includes("Review Queue"));
        const welcomeSection = sections.find((section) => section.titles.length === 1 && section.titles[0] === "Welcome");
        const dailyNotesSection = sections.find((section) => section.titles.length === 1 && section.titles[0] === "Daily Notes");

        expect(topSection).toBeTruthy();
        expect(welcomeSection).toBeTruthy();
        expect(dailyNotesSection).toBeTruthy();
        expect(Math.abs((welcomeSection?.rect.top ?? 0) - (dailyNotesSection?.rect.top ?? 9999))).toBeLessThan(6);
        expect((welcomeSection?.rect.top ?? 0)).toBeGreaterThan((topSection?.rect.top ?? 0) + 40);
        expect(Math.abs((welcomeSection?.rect.width ?? 0) - (dailyNotesSection?.rect.width ?? 0))).toBeLessThan(12);
    });

    test("dragging inside strip should only reorder tabs and must not trigger split", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragLocatorToPoint(
            page,
            page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Review Queue' }).first(),
            (await page.locator('.layout-v2-tab-section__strip').first().boundingBox())!.x + 4,
            (await page.locator('.layout-v2-tab-section__strip').first().boundingBox())!.y + 12,
        );

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.titles).toEqual(["Review Queue", "Welcome", "Daily Notes", "Outline"]);
    });

    test("dragging a lone right-side tab within its strip should not translate left strip tabs out of view", async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 832 });
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Welcome", "main-tabs", "right");

        const sourceTab = page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Welcome' }).first();
        const rightStrip = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first().locator('.layout-v2-tab-section__strip');
        const stripBounds = await rightStrip.boundingBox();
        if (!stripBounds) {
            throw new Error('right strip bounds missing');
        }

        await movePointerWithoutDrop(
            page,
            sourceTab,
            stripBounds.x + stripBounds.width / 2,
            stripBounds.y + stripBounds.height / 2,
        );

        const transforms = await readTabSlotTransforms(page, 'main-tabs');
        expect(transforms.map((entry) => entry.title)).toEqual(["Daily Notes", "Outline", "Review Queue"]);
        expect(transforms.every((entry) => entry.transform === 'none' || entry.transform === 'matrix(1, 0, 0, 1, 0, 0)')).toBe(true);

        await page.mouse.up();
    });

    test("split preview should collapse empty source sections instead of rendering an empty shell", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Welcome", "main-tabs", "bottom");
        await dragTabToSectionContentSide(page, "Daily Notes", "main-tabs", "bottom");

        const sourceTab = page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Daily Notes' }).first();
        const targetSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first();
        const targetContent = targetSection.locator('.layout-v2-tab-section__content').first();
        const targetBounds = await targetContent.boundingBox();
        if (!targetBounds) {
            throw new Error("target content bounds missing");
        }

        await movePointerWithoutDrop(
            page,
            sourceTab,
            targetBounds.x + targetBounds.width - 14,
            targetBounds.y + targetBounds.height / 2,
        );

        const previewSections = await readTabSections(page);
        expect(previewSections.some((section) => section.titles.length === 0 && !(section.id ?? "").startsWith("preview-tab-section"))).toBe(false);

        const previewSection = previewSections.find((section) => (section.id ?? "").startsWith("preview-tab-section"));
        expect(previewSection?.titles).toEqual(["Daily Notes"]);

        await page.mouse.up();
    });

    test("dragging a lone tab into another section projected center should preview-merge and commit into a single target section", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Welcome", "main-tabs", "right");

        const sourceSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first();
        const targetSection = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]').first();
        const sourceTab = sourceSection.locator('.layout-v2-tab-section__tab-main', { hasText: 'Welcome' }).first();
        const mergeCenter = await getProjectedMergeCenter(sourceSection, targetSection);

        await movePointerWithoutDrop(
            page,
            sourceTab,
            mergeCenter.x,
            mergeCenter.y,
        );

        const previewSections = await readTabSections(page);
        expect(previewSections).toHaveLength(1);
        expect(previewSections[0]?.titles).toEqual(["Daily Notes", "Outline", "Review Queue", "Welcome"]);

        await page.mouse.up();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        const committedSections = await readTabSections(page);
        expect(committedSections).toHaveLength(1);
        expect(committedSections[0]?.titles).toEqual(["Daily Notes", "Outline", "Review Queue", "Welcome"]);
    });

    test("a lone source section should collapse at drag start so merge can trigger from the projected full-width center", async ({ page }) => {
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Welcome", "main-tabs", "right");

        const sourceSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first();
        const sourceTab = sourceSection.locator('.layout-v2-tab-section__tab-main', { hasText: 'Welcome' }).first();
        const targetSection = page.locator('.layout-v2-tab-section[data-tab-section-id="main-tabs"]').first();
        const projectedCenter = await getProjectedMergeCenter(sourceSection, targetSection);

        await movePointerWithoutDrop(page, sourceTab, projectedCenter.x, projectedCenter.y);

        const previewSections = await readTabSections(page);
        expect(previewSections).toHaveLength(1);
        expect(previewSections[0]?.titles).toEqual(["Daily Notes", "Outline", "Review Queue", "Welcome"]);

        await page.mouse.up();
        await page.waitForTimeout(LAYOUT_V2_SPLIT_ANIMATION_WAIT_MS);

        const committedSections = await readTabSections(page);
        expect(committedSections).toHaveLength(1);
        expect(committedSections[0]?.titles).toEqual(["Daily Notes", "Outline", "Review Queue", "Welcome"]);
    });

    test("on a narrow viewport, dragging the upper-right lone tab to the left section center should merge into the left section", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 832 });
        await gotoLayoutV2Example(page);

        await dragTabToSectionContentSide(page, "Outline", "main-tabs", "right");

        const outlineSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Outline' }),
        }).first();
        const outlineBounds = await outlineSection.locator('.layout-v2-tab-section__content').boundingBox();
        if (!outlineBounds) {
            throw new Error('outline target bounds missing');
        }

        await dragLocatorToPoint(
            page,
            page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Daily Notes' }).first(),
            outlineBounds.x + outlineBounds.width / 2,
            outlineBounds.y + outlineBounds.height - 14,
        );

        const leftSection = page.locator('.layout-v2-tab-section', {
            has: page.locator('.layout-v2-tab-section__tab-title', { hasText: 'Welcome' }),
        }).first();
        const leftBounds = await leftSection.locator('.layout-v2-tab-section__content').boundingBox();
        if (!leftBounds) {
            throw new Error('left merge target bounds missing');
        }

        await dragLocatorToPoint(
            page,
            page.locator('.layout-v2-tab-section__tab-main', { hasText: 'Outline' }).first(),
            leftBounds.x + leftBounds.width / 2,
            leftBounds.y + leftBounds.height / 2,
        );

        const sections = await readTabSections(page);
        expect(sections).toHaveLength(2);
        expect(sections.find((section) => section.titles.join('|') === 'Welcome|Review Queue|Outline')).toBeTruthy();
        expect(sections.find((section) => section.titles.join('|') === 'Daily Notes')).toBeTruthy();
    });
});