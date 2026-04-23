import { describe, expect, test } from "bun:test";
import {
    WORKBENCH_MAIN_TAB_SECTION_ID,
    createWorkbenchLayoutState,
    findSectionNode,
} from "../src";
import { closeWorkbenchTabState } from "../src/vscode-layout/VSCodeWorkbench";

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
});