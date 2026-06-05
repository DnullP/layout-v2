import { describe, expect, test } from "bun:test";
import { createWorkbenchRegistry } from "../src";

describe("workbench registry", () => {
    test("projects registered contributions into VSCodeWorkbench definitions", () => {
        const registry = createWorkbenchRegistry();
        const disposeActivity = registry.registerActivity({
            id: "collections",
            label: "Collections",
            bar: "left",
            section: "top",
            order: 10,
            onActivate: () => { },
        });
        const disposePanel = registry.registerPanel({
            id: "collections-panel",
            label: "Collections",
            activityId: "collections",
            position: "left",
            order: 10,
            render: () => null,
        });
        const disposeTab = registry.registerTabComponent({
            id: "request-editor",
            render: () => null,
        });

        const snapshot = registry.getSnapshot();

        expect(snapshot.activities).toHaveLength(1);
        expect(snapshot.panels).toHaveLength(1);
        expect(snapshot.tabComponents).toHaveLength(1);
        expect(snapshot.activityDefinitions[0]).toEqual({
            id: "collections",
            label: "Collections",
            bar: "left",
            section: "top",
            activationMode: undefined,
            icon: undefined,
        });
        expect(snapshot.panelDefinitions[0]).toEqual({
            id: "collections-panel",
            label: "Collections",
            icon: undefined,
            activityId: "collections",
            position: "left",
            order: 10,
        });
        expect(snapshot.tabComponentRenderers["request-editor"]).toBeTypeOf("function");

        disposeTab();
        disposePanel();
        disposeActivity();
        expect(registry.getSnapshot().activityDefinitions).toEqual([]);
    });

    test("orders activities and panels by order then id", () => {
        const registry = createWorkbenchRegistry();
        const disposeLater = registry.registerActivity({
            id: "later",
            label: "Later",
            bar: "left",
            order: 20,
        });
        const disposeEarlier = registry.registerActivity({
            id: "earlier",
            label: "Earlier",
            bar: "left",
            order: 10,
        });
        const disposeAlpha = registry.registerPanel({
            id: "alpha",
            label: "Alpha",
            activityId: "earlier",
            position: "left",
            order: 1,
            render: () => null,
        });
        const disposeBeta = registry.registerPanel({
            id: "beta",
            label: "Beta",
            activityId: "earlier",
            position: "left",
            order: 1,
            render: () => null,
        });

        expect(registry.getActivitiesSnapshot().map((entry) => entry.id)).toEqual(["earlier", "later"]);
        expect(registry.getPanelsSnapshot().map((entry) => entry.id)).toEqual(["alpha", "beta"]);

        disposeLater();
        disposeEarlier();
        disposeAlpha();
        disposeBeta();
    });

    test("duplicate ids only allow the active contribution to dispose itself", () => {
        const registry = createWorkbenchRegistry();
        const disposeFirst = registry.registerActivity({
            id: "duplicate",
            label: "First",
            bar: "left",
        });
        const disposeSecond = registry.registerActivity({
            id: "duplicate",
            label: "Second",
            bar: "left",
        });

        expect(registry.getActivityById("duplicate")?.label).toBe("Second");
        disposeFirst();
        expect(registry.getActivityById("duplicate")?.label).toBe("Second");
        disposeSecond();
        expect(registry.getActivityById("duplicate")).toBeUndefined();
    });
});
