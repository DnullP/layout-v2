/**
 * @module host/layout-v2/example/usage/sectionLayoutViewExample
 * @description SectionLayoutView 的使用示例。
 *   这里把拆分后的 section/tree、activity bar、tab section、panel section 示例重新组合成一套基本的 VSCode 结构。
 *   拖拽指针跟踪由各组件自己维护，宿主只负责共享会话、预览布局和最终提交。
 */

import { useMemo, useState, type ReactNode } from "react";
import { ActivityBar } from "../../src/activity-bar/ActivityBar";
import { type ActivityBarDragSession } from "../../src/activity-bar/activityBarDrag";
import { findPanelInSectionsState, removePanelSectionPanel } from "../../src/panel-section/panelSectionModel";
import { removeActivityBarIcon } from "../../src/activity-bar/activityBarModel";
import { useActivityBarState } from "../../src/activity-bar/useActivityBarState";
import { PanelSection } from "../../src/panel-section/PanelSection";
import { type PanelSectionDragSession } from "../../src/panel-section/panelSectionDrag";
import { usePanelSectionState } from "../../src/panel-section/usePanelSectionState";
import { SectionLayoutView } from "../../src/vscode-layout/SectionLayoutView";
import {
    SectionComponentHost,
    createSectionComponentRegistry,
    type SectionComponentBinding,
} from "../../src/vscode-layout/sectionComponent";
import { TabSection } from "../../src/tab-section/TabSection";
import { TabSectionDragPreview } from "../../src/tab-section/TabSectionDragPreview";
import { type TabSectionDragSession } from "../../src/tab-section/tabSectionDrag";
import { useTabSectionState } from "../../src/tab-section/useTabSectionState";
import { useSectionLayout } from "../../src/vscode-layout/useSectionLayout";
import {
    PREVIEW_SECTION_ID_PREFIX,
    buildActivityToPanelPreviewState,
    buildActivityToContentPreviewState,
    buildCommittedTabLayoutState,
    buildPanelPreviewLayoutState,
    buildPanelToActivityPreviewState,
    buildPreviewLayoutState,
    closeTabInLayoutState,
    commitActivityToContentDrop,
} from "../exampleLayoutState";
import { createActivityBarExampleState } from "./activityBarExample";
import { createPanelSectionExampleState } from "./panelSectionExample";
import { createSectionTreeExample, type SectionTreeExampleData } from "./sectionTreeExample";
import { createTabSectionExampleState, tabContentRegistryExample } from "./tabSectionExample";

function resolveCommittedLeafSectionId(
    sectionId: string,
    anchorLeafSectionId?: string,
): string {
    if (sectionId.startsWith(PREVIEW_SECTION_ID_PREFIX) && anchorLeafSectionId) {
        return anchorLeafSectionId;
    }

    return sectionId;
}

function isInteractivePreviewLeaf(
    sectionId: string,
    isDragging: boolean,
): boolean {
    return isDragging && sectionId.startsWith(PREVIEW_SECTION_ID_PREFIX);
}

function findDraggedActivityIcon(
    session: ActivityBarDragSession | null,
    bars: ReturnType<typeof createActivityBarExampleState>,
) {
    if (!session) {
        return null;
    }

    for (const bar of Object.values(bars.bars)) {
        const icon = bar.icons.find((item) => item.id === session.iconId);
        if (icon) {
            return icon;
        }
    }

    return null;
}

/**
 * @function SectionLayoutViewUsageExample
 * @description 演示如何把 section 树、registry 和布局视图拼装到一起。
 * @returns SectionLayoutView React 示例。
 */
export function SectionLayoutViewUsageExample(): ReactNode {
    const initialRoot = useMemo(() => createSectionTreeExample(), []);
    const layout = useSectionLayout({ initialRoot });
    const activityBars = useActivityBarState({
        initialState: createActivityBarExampleState(),
    });
    const tabSections = useTabSectionState({
        initialState: createTabSectionExampleState(),
    });
    const panelSections = usePanelSectionState({
        initialState: createPanelSectionExampleState(),
    });
    const [activityDragSession, setActivityDragSession] = useState<ActivityBarDragSession | null>(null);
    const [tabDragSession, setTabDragSession] = useState<TabSectionDragSession | null>(null);
    const [panelDragSession, setPanelDragSession] = useState<PanelSectionDragSession | null>(null);

    const tabPreview = useMemo(
        () => buildPreviewLayoutState(layout.root, tabSections.state, tabDragSession),
        [layout.root, tabDragSession, tabSections.state],
    );
    const panelPreview = useMemo(
        () => buildPanelPreviewLayoutState(layout.root, panelSections.state, panelDragSession),
        [layout.root, panelDragSession, panelSections.state],
    );
    const activityToPanelPreview = useMemo(
        () => buildActivityToPanelPreviewState(
            panelSections.state,
            findDraggedActivityIcon(activityDragSession, activityBars.state),
            activityDragSession?.panelTarget?.panelSectionId ?? null,
            activityDragSession?.panelTarget?.targetIndex ?? null,
        ),
        [activityBars.state, activityDragSession, panelSections.state],
    );
    const activityContentPreview = useMemo(
        () => buildActivityToContentPreviewState(
            layout.root,
            panelSections.state,
            activityDragSession?.phase === "dragging" ? activityDragSession.contentTarget : null,
            findDraggedActivityIcon(activityDragSession, activityBars.state),
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [layout.root, panelSections.state, activityDragSession?.contentTarget, activityBars.state],
    );
    const panelToActivityPreview = useMemo(
        () => buildPanelToActivityPreviewState(
            activityBars.state,
            findPanelInSectionsState(panelSections.state, panelDragSession?.panelId ?? "")?.panel ?? null,
            panelDragSession?.activityTarget?.barId ?? null,
            panelDragSession?.activityTarget?.targetIndex ?? null,
        ),
        [activityBars.state, panelDragSession, panelSections.state],
    );

    const renderedRoot = tabPreview?.root ?? panelPreview?.root ?? activityContentPreview?.root ?? layout.root;
    const renderedActivityBars = panelToActivityPreview ?? activityBars.state;
    const renderedTabSections = tabPreview?.state ?? tabSections.state;
    const renderedPanelSections = activityToPanelPreview ?? panelPreview?.state ?? activityContentPreview?.state ?? panelSections.state;

    const registry = useMemo(
        () => createSectionComponentRegistry<SectionTreeExampleData>({
            empty: () => null,
            "activity-bar": ({ binding }) => {
                const activityBinding = binding as SectionComponentBinding<"activity-bar", { barId: string }>;
                return (
                    <ActivityBar
                        bar={renderedActivityBars.bars[activityBinding.props.barId] ?? null}
                        dragSession={activityDragSession}
                        panelDragSession={panelDragSession}
                        onDragSessionChange={setActivityDragSession}
                        onDragSessionEnd={(session) => {
                            setActivityDragSession(null);

                            // Activity icon → content area split
                            if (session.contentTarget?.splitSide) {
                                const icon = findDraggedActivityIcon(session, activityBars.state);
                                const committed = commitActivityToContentDrop(
                                    layout.root,
                                    panelSections.state,
                                    session.contentTarget,
                                    icon,
                                );
                                if (!committed) {
                                    return;
                                }

                                layout.resetLayout(committed.root);
                                panelSections.resetState(committed.state);
                                activityBars.resetState(removeActivityBarIcon(activityBars.state, session.currentBarId, session.iconId));
                                return;
                            }

                            // Activity icon → panel bar drop
                            if (!session.panelTarget) {
                                return;
                            }

                            const icon = findDraggedActivityIcon(session, activityBars.state);
                            const nextPanelSections = buildActivityToPanelPreviewState(
                                panelSections.state,
                                icon,
                                session.panelTarget.panelSectionId,
                                session.panelTarget.targetIndex,
                            );
                            if (!nextPanelSections) {
                                return;
                            }

                            panelSections.resetState(nextPanelSections);
                            activityBars.resetState(removeActivityBarIcon(activityBars.state, session.currentBarId, session.iconId));
                        }}
                        onPanelDragSessionChange={setPanelDragSession}
                        onActivateIcon={() => { }}
                        onSelectIcon={(iconId) => activityBars.selectIcon(activityBinding.props.barId, iconId)}
                        onMoveIcon={(move) => activityBars.moveIcon(move)}
                    />
                );
            },
            "panel-section": ({ section, binding }) => {
                const panelBinding = binding as SectionComponentBinding<"panel-section", { panelSectionId: string }>;
                const committedLeafSectionId = resolveCommittedLeafSectionId(
                    section.id,
                    panelDragSession?.hoverTarget?.anchorLeafSectionId ?? activityDragSession?.contentTarget?.anchorLeafSectionId,
                );
                return (
                    <PanelSection
                        leafSectionId={section.id}
                        committedLeafSectionId={committedLeafSectionId}
                        panelSectionId={panelBinding.props.panelSectionId}
                        panelSection={renderedPanelSections.sections[panelBinding.props.panelSectionId] ?? null}
                        dragSession={panelDragSession}
                        activityDragSession={activityDragSession}
                        interactive={!isInteractivePreviewLeaf(section.id, Boolean(panelDragSession || activityDragSession))}
                        allowContentPreview={isInteractivePreviewLeaf(section.id, Boolean(panelDragSession || activityDragSession))}
                        onDragSessionChange={setPanelDragSession}
                        onDragSessionEnd={(session) => {
                            setPanelDragSession(null);
                            if (session.activityTarget) {
                                const panel = findPanelInSectionsState(panelSections.state, session.panelId)?.panel ?? null;
                                const nextActivityBars = buildPanelToActivityPreviewState(
                                    activityBars.state,
                                    panel,
                                    session.activityTarget.barId,
                                    session.activityTarget.targetIndex,
                                );
                                if (!nextActivityBars) {
                                    return;
                                }

                                activityBars.resetState(nextActivityBars);
                                panelSections.resetState(removePanelSectionPanel(panelSections.state, session.currentPanelSectionId, session.panelId));
                                return;
                            }

                            if (session.hoverTarget?.area !== "content") {
                                return;
                            }

                            const preview = buildPanelPreviewLayoutState(layout.root, panelSections.state, session);
                            if (!preview) {
                                return;
                            }

                            layout.resetLayout(preview.root);
                            panelSections.resetState(preview.state);
                        }}
                        onActivityDragSessionChange={setActivityDragSession}
                        onActivatePanel={() => { }}
                        onFocusPanel={(panelId) => panelSections.focusPanel(panelBinding.props.panelSectionId, panelId)}
                        onToggleCollapsed={() => {
                            const current = panelSections.state.sections[panelBinding.props.panelSectionId] ?? null;
                            if (!current) {
                                return;
                            }

                            panelSections.setCollapsed(panelBinding.props.panelSectionId, !current.isCollapsed);
                        }}
                        onMovePanel={(move) => panelSections.movePanel(move)}
                    />
                );
            },
            "tab-section": ({ section, binding }) => {
                const tabBinding = binding as SectionComponentBinding<"tab-section", { tabSectionId: string }>;
                const committedLeafSectionId = resolveCommittedLeafSectionId(
                    section.id,
                    tabDragSession?.hoverTarget?.anchorLeafSectionId,
                );
                return (
                    <TabSection
                        leafSectionId={section.id}
                        committedLeafSectionId={committedLeafSectionId}
                        tabSectionId={tabBinding.props.tabSectionId}
                        tabSection={renderedTabSections.sections[tabBinding.props.tabSectionId] ?? null}
                        dragSession={tabDragSession}
                        interactive={!isInteractivePreviewLeaf(section.id, Boolean(tabDragSession))}
                        allowContentPreview={isInteractivePreviewLeaf(section.id, Boolean(tabDragSession))}
                        contentRegistry={tabContentRegistryExample}
                        onDragSessionChange={setTabDragSession}
                        onDragSessionEnd={(session) => {
                            setTabDragSession(null);
                            if (session.hoverTarget?.area !== "content") {
                                return;
                            }

                            const committed = buildCommittedTabLayoutState(layout.root, tabSections.state, session);
                            if (!committed) {
                                return;
                            }

                            layout.resetLayout(committed.root);
                            tabSections.resetState(committed.state);
                        }}
                        onFocusTab={(tabId) => tabSections.focusTab(tabBinding.props.tabSectionId, tabId)}
                        onCloseTab={(tabId) => {
                            const nextLayout = closeTabInLayoutState(
                                layout.root,
                                tabSections.state,
                                tabBinding.props.tabSectionId,
                                tabId,
                            );

                            if (nextLayout.root !== layout.root) {
                                layout.resetLayout(nextLayout.root);
                            }

                            if (nextLayout.state !== tabSections.state) {
                                tabSections.resetState(nextLayout.state);
                            }
                        }}
                        onMoveTab={(move) => tabSections.moveTab(move)}
                    />
                );
            },
        }),
        [
            activityBars,
            activityDragSession,
            layout,
            panelDragSession,
            panelPreview,
            panelSections,
            renderedActivityBars,
            renderedPanelSections,
            renderedTabSections,
            tabDragSession,
            tabSections,
        ],
    );

    return (
        <div className="layout-v2-example__app">
            <SectionLayoutView
                className="layout-v2-example__fullscreen-layout"
                root={renderedRoot}
                animationRoot={renderedRoot}
                onResizeSection={layout.resizeSection}
                renderSection={(section) => (
                    <SectionComponentHost
                        section={section}
                        registry={registry}
                    />
                )}
            />
            <TabSectionDragPreview session={tabDragSession} />
        </div>
    );
}