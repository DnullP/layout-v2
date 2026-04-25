import { describe, expect, test } from "bun:test";
import {
    WORKBENCH_MAIN_TAB_SECTION_ID,
    commitTabWorkbenchDrop,
    createSectionComponentBinding,
    createWorkbenchLayoutState,
    findSectionNode,
    isSectionHidden,
    type SectionDraft,
    type SectionNode,
    type TabWorkbenchAdapter,
} from "../src";
import { closeWorkbenchTabState } from "../src/vscode-layout/VSCodeWorkbench";
import type { WorkbenchSectionData } from "../src/vscode-layout/workbenchPreset";

const workbenchTabAdapter: TabWorkbenchAdapter<WorkbenchSectionData> = {
    createTabSectionDraft: ({ sourceLeaf, nextSectionId, nextTabSectionId, title }: {
        sourceLeaf: SectionNode<WorkbenchSectionData>;
        nextSectionId: string;
        nextTabSectionId: string;
        title: string;
    }): SectionDraft<WorkbenchSectionData> => ({
        id: nextSectionId,
        title,
        data: {
            role: sourceLeaf.data.role,
            component: createSectionComponentBinding("tab-section", {
                tabSectionId: nextTabSectionId,
            }),
        },
        resizableEdges: sourceLeaf.resizableEdges,
    }),
};

describe("closeWorkbenchTabState", () => {
    test("closing the last main workbench tab should keep the root main tab section", () => {
        const initialState = createWorkbenchLayoutState({
            initialTabs: [
                {
                    id: "welcome",
                    title: "Welcome",
                    component: "welcome-page",
                },
            ],
        });

        const result = closeWorkbenchTabState(initialState, "welcome");

        expect(result.didClose).toBe(true);
        expect(findSectionNode(result.nextState.root, WORKBENCH_MAIN_TAB_SECTION_ID)).not.toBeNull();
        expect(result.nextState.tabSections.sections[WORKBENCH_MAIN_TAB_SECTION_ID]?.isRoot).toBe(true);
        expect(result.nextState.tabSections.sections[WORKBENCH_MAIN_TAB_SECTION_ID]?.tabs).toEqual([]);
        expect(result.nextState.tabSections.sections[WORKBENCH_MAIN_TAB_SECTION_ID]?.focusedTabId).toBeNull();
        expect(result.nextState.workbench?.activeGroupId).toBe(WORKBENCH_MAIN_TAB_SECTION_ID);
    });

    test("initial sidebar visibility should be reflected in the root layout state", () => {
        const initialState = createWorkbenchLayoutState({
            initialSidebarState: {
                left: {
                    visible: false,
                },
            },
        });

        const leftSidebar = findSectionNode(initialState.root, "left-sidebar");

        expect(leftSidebar).not.toBeNull();
        expect(isSectionHidden(leftSidebar!)).toBe(true);
    });

    test("closing the lone left child after the first left split should destroy that section", () => {
        const initialState = createWorkbenchLayoutState({
            initialTabs: [
                {
                    id: "welcome",
                    title: "Welcome",
                    component: "welcome-page",
                },
                {
                    id: "review",
                    title: "Review",
                    component: "review-page",
                },
            ],
        });

        const committed = commitTabWorkbenchDrop(
            initialState.root,
            initialState.tabSections,
            {
                sourceTabSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                currentTabSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                sourceLeafSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                currentLeafSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                tabId: "welcome",
                title: "Welcome",
                content: "Component: welcome-page",
                pointerId: 1,
                originX: 0,
                originY: 0,
                pointerX: 10,
                pointerY: 10,
                phase: "dragging",
                hoverTarget: {
                    area: "content",
                    leafSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                    anchorLeafSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                    tabSectionId: WORKBENCH_MAIN_TAB_SECTION_ID,
                    splitSide: "left",
                    contentBounds: {
                        left: 0,
                        top: 0,
                        right: 300,
                        bottom: 200,
                        width: 300,
                        height: 200,
                    },
                },
            },
            workbenchTabAdapter,
        );

        expect(committed).not.toBeNull();
        const leftSectionId = Object.values(committed!.state.sections).find((section) =>
            section.tabs.some((tab) => tab.id === "welcome"),
        )?.id;
        expect(leftSectionId).toBeTruthy();

        const result = closeWorkbenchTabState({
            ...initialState,
            root: committed!.root,
            tabSections: committed!.state,
            workbench: { activeGroupId: leftSectionId ?? null },
        }, "welcome");

        expect(result.didClose).toBe(true);
        expect(Object.keys(result.nextState.tabSections.sections)).toEqual([WORKBENCH_MAIN_TAB_SECTION_ID]);
        expect(result.nextState.tabSections.sections[WORKBENCH_MAIN_TAB_SECTION_ID]?.tabs.map((tab) => tab.id)).toEqual(["review"]);
        expect(result.nextState.workbench?.activeGroupId).toBe(WORKBENCH_MAIN_TAB_SECTION_ID);
    });
});