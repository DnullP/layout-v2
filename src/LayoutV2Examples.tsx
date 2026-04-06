/**
 * @module host/layout-v2/LayoutV2Examples
 * @description layout-v2 的示例入口。
 *   当前提供一个铺满窗口的 VS Code 风格四栏 mock，
 *   左侧为 activity bar，主区域为可拖拽分区的 tab section。
 * @dependencies
 *   - react
 *   - ./layoutModel
 *   - ./layoutV2ExampleMode
 *   - ./useSectionLayout
 *   - ./SectionLayoutView
 *   - ./layoutV2.css
 *   - ./activity-bar/*
 *   - ./tab-section/*
 *
 * @example
 *   http://127.0.0.1:4173/?layoutV2Example=vscode
 *
 * @exports
 *   - LayoutV2ExamplesApp       全屏示例应用
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityBar } from "./activity-bar/ActivityBar";
import { type ActivityBarDragSession } from "./activity-bar/ActivityBar";
import { type ActivityBarIconDefinition } from "./activity-bar/activityBarModel";
import { createActivityBarState, useActivityBarState } from "./activity-bar/useActivityBarState";
import {
  splitSectionTree,
} from "./layoutModel";
import {
  buildPreviewLayoutState,
  buildSectionDraftFromLeaf,
  cleanupEmptyTabSections,
  createExampleSectionDraft,
  createEmptyTabSectionStateItem,
  createVsCodeExample,
  findTabSectionLeaf,
  type ExampleSectionLayoutData,
  isPreviewTabSectionId,
  resolveSplitPlan,
  TEST_TABS,
} from "./exampleLayoutState";
import { SectionLayoutView } from "./SectionLayoutView";
import {
  createSectionComponentBinding,
  createSectionComponentRegistry,
  SectionComponentHost,
  type SectionComponentBinding,
} from "./sectionComponent";
import { TabSection, type TabSectionDragSession } from "./tab-section/TabSection";
import {
  closeTabSectionTab,
  createTabSectionsState,
  findTabInSectionsState,
  focusTabSectionTab,
  moveTabSectionTab,
  upsertTabSection,
} from "./tab-section/tabSectionModel";
import { useTabSectionState } from "./tab-section/useTabSectionState";
import { useSectionLayout } from "./useSectionLayout";
import "./layoutV2.css";

/**
 * @constant TEST_ACTIVITY_ICONS
 * @description activity bar 初始填充的 4 个测试 icon。
 */
const TEST_ACTIVITY_ICONS: ActivityBarIconDefinition[] = [
  { id: "explorer", label: "Explorer", symbol: "E" },
  { id: "search", label: "Search", symbol: "S" },
  { id: "git", label: "Source Control", symbol: "G" },
  { id: "extensions", label: "Extensions", symbol: "X" },
];

/**
 * @function buildPreviewDragSession
 * @description 基于当前 tab 拖拽会话提取仅影响 preview 布局的稳定快照。
 *   pointer 坐标会以高频率变化，但 preview 树只应在 hover 语义变更时重建。
 * @param session 当前完整拖拽会话。
 * @returns 仅用于 preview 计算的稳定拖拽快照；无会话时返回 null。
 */
function buildPreviewDragSession(
  session: TabSectionDragSession | null,
): TabSectionDragSession | null {
  if (!session) {
    return null;
  }

  return {
    ...session,
    hoverTarget: session.hoverTarget
      ? {
          ...session.hoverTarget,
          contentBounds: session.hoverTarget.contentBounds
            ? { ...session.hoverTarget.contentBounds }
            : undefined,
        }
      : null,
  };
}

/**
 * @function LayoutV2ExamplesApp
 * @description 铺满窗口的 VS Code 布局 mock。
 *   左侧 activity bar 通过 section component API 挂载，
 *   其余 section 暂时保持空白以验证底层拼装方式。
 * @returns 示例应用 React 节点。
 */
export function LayoutV2ExamplesApp(): ReactNode {
  const initialRoot = useMemo(() => createVsCodeExample(), []);
  const layout = useSectionLayout({
    initialRoot,
  });
  const [activityDragSession, setActivityDragSession] = useState<ActivityBarDragSession | null>(null);
  const [tabDragSession, setTabDragSession] = useState<TabSectionDragSession | null>(null);
  const runtimeIdRef = useRef(0);
  const activityBars = useActivityBarState({
    initialState: createActivityBarState([
      {
        id: "primary-activity-bar",
        icons: TEST_ACTIVITY_ICONS,
        selectedIconId: TEST_ACTIVITY_ICONS[0]?.id ?? null,
      },
    ]),
  });
  const tabSections = useTabSectionState({
    initialState: createTabSectionsState([
      {
        id: "main-tabs",
        tabs: TEST_TABS,
        focusedTabId: TEST_TABS[0]?.id ?? null,
        isRoot: true,
      },
    ]),
  });
  const activityDragSessionRef = useRef<ActivityBarDragSession | null>(null);
  const tabDragSessionRef = useRef<TabSectionDragSession | null>(null);
  const layoutRef = useRef(layout);
  const tabSectionsRef = useRef(tabSections);
  const activityBarsRef = useRef(activityBars);
  const activityDragFrameRef = useRef<number | null>(null);
  const tabDragFrameRef = useRef<number | null>(null);
  const activityPendingPointerRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    phase: ActivityBarDragSession["phase"];
  } | null>(null);
  const tabPendingPointerRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    phase: TabSectionDragSession["phase"];
  } | null>(null);

  useEffect(() => {
    activityDragSessionRef.current = activityDragSession;
  }, [activityDragSession]);

  useEffect(() => {
    tabDragSessionRef.current = tabDragSession;
  }, [tabDragSession]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    tabSectionsRef.current = tabSections;
  }, [tabSections]);

  useEffect(() => {
    activityBarsRef.current = activityBars;
  }, [activityBars]);

  useEffect(() => {
    return () => {
      if (activityDragFrameRef.current !== null) {
        window.cancelAnimationFrame(activityDragFrameRef.current);
      }
      if (tabDragFrameRef.current !== null) {
        window.cancelAnimationFrame(tabDragFrameRef.current);
      }
    };
  }, []);

  /**
   * @function createScopedRuntimeId
   * @description 基于 ref 生成示例内部使用的 id。
   * @param prefix id 前缀。
   * @returns 自增 id。
   */
  function createScopedRuntimeId(prefix: string): string {
    runtimeIdRef.current += 1;
    return `${prefix}-${runtimeIdRef.current}`;
  }

  useEffect(() => {
    if (!activityDragSession) {
      return;
    }

    const activePointerId = activityDragSession.pointerId;

    const flushPointerUpdate = (): void => {
      activityDragFrameRef.current = null;
      const pendingPointer = activityPendingPointerRef.current;
      if (!pendingPointer || pendingPointer.pointerId !== activePointerId) {
        return;
      }

      setActivityDragSession((currentSession) => {
        if (!currentSession || currentSession.pointerId !== activePointerId) {
          return currentSession;
        }

        if (
          currentSession.pointerX === pendingPointer.pointerX &&
          currentSession.pointerY === pendingPointer.pointerY &&
          currentSession.phase === pendingPointer.phase
        ) {
          return currentSession;
        }

        return {
          ...currentSession,
          pointerX: pendingPointer.pointerX,
          pointerY: pendingPointer.pointerY,
          phase: pendingPointer.phase,
        };
      });
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const currentSession = activityDragSessionRef.current;
      if (!currentSession || currentSession.pointerId !== activePointerId) {
        return;
      }

      const nextPointerX = event.clientX;
      const nextPointerY = event.clientY;
      const deltaX = nextPointerX - currentSession.originX;
      const deltaY = nextPointerY - currentSession.originY;
      const nextPhase = currentSession.phase === "dragging" || Math.hypot(deltaX, deltaY) >= 4
        ? "dragging"
        : "pending";

      activityPendingPointerRef.current = {
        pointerId: activePointerId,
        pointerX: nextPointerX,
        pointerY: nextPointerY,
        phase: nextPhase,
      };

      if (activityDragFrameRef.current === null) {
        activityDragFrameRef.current = window.requestAnimationFrame(flushPointerUpdate);
      }
    };

    const finishSession = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      if (activityDragFrameRef.current !== null) {
        window.cancelAnimationFrame(activityDragFrameRef.current);
        activityDragFrameRef.current = null;
      }
      activityPendingPointerRef.current = null;

      setActivityDragSession((currentSession) => {
        if (!currentSession || currentSession.pointerId !== event.pointerId) {
          return currentSession;
        }

        if (currentSession.phase === "pending") {
          activityBarsRef.current.selectIcon(currentSession.sourceBarId, currentSession.iconId);
        }

        console.info("[layout-v2] activity bar pointer interaction finished", {
          iconId: currentSession.iconId,
          sourceBarId: currentSession.sourceBarId,
          currentBarId: currentSession.currentBarId,
          targetIndex: currentSession.targetIndex,
          phase: currentSession.phase,
        });
        return null;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishSession);
    window.addEventListener("pointercancel", finishSession);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishSession);
      window.removeEventListener("pointercancel", finishSession);
    };
  }, [activityDragSession?.pointerId]);

  useEffect(() => {
    if (!tabDragSession) {
      return;
    }

    const activePointerId = tabDragSession.pointerId;

    const flushPointerUpdate = (): void => {
      tabDragFrameRef.current = null;
      const pendingPointer = tabPendingPointerRef.current;
      if (!pendingPointer || pendingPointer.pointerId !== activePointerId) {
        return;
      }

      setTabDragSession((currentSession) => {
        if (!currentSession || currentSession.pointerId !== activePointerId) {
          return currentSession;
        }

        if (
          currentSession.pointerX === pendingPointer.pointerX &&
          currentSession.pointerY === pendingPointer.pointerY &&
          currentSession.phase === pendingPointer.phase
        ) {
          return currentSession;
        }

        return {
          ...currentSession,
          pointerX: pendingPointer.pointerX,
          pointerY: pendingPointer.pointerY,
          phase: pendingPointer.phase,
        };
      });
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const currentSession = tabDragSessionRef.current;
      if (!currentSession || currentSession.pointerId !== activePointerId) {
        return;
      }

      const nextPointerX = event.clientX;
      const nextPointerY = event.clientY;
      const deltaX = nextPointerX - currentSession.originX;
      const deltaY = nextPointerY - currentSession.originY;
      const nextPhase = currentSession.phase === "dragging" || Math.hypot(deltaX, deltaY) >= 5
        ? "dragging"
        : "pending";

      tabPendingPointerRef.current = {
        pointerId: activePointerId,
        pointerX: nextPointerX,
        pointerY: nextPointerY,
        phase: nextPhase,
      };

      if (tabDragFrameRef.current === null) {
        tabDragFrameRef.current = window.requestAnimationFrame(flushPointerUpdate);
      }
    };

    const finishSession = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      if (tabDragFrameRef.current !== null) {
        window.cancelAnimationFrame(tabDragFrameRef.current);
        tabDragFrameRef.current = null;
      }
      tabPendingPointerRef.current = null;

      setTabDragSession((currentSession) => {
        if (!currentSession || currentSession.pointerId !== event.pointerId) {
          return currentSession;
        }

        let nextRoot = layoutRef.current.root;
        let nextTabState = tabSectionsRef.current.state;

        if (
          currentSession.phase === "pending"
        ) {
          nextTabState = focusTabSectionTab(
            nextTabState,
            currentSession.currentTabSectionId,
            currentSession.tabId,
          );
        }

        if (
          currentSession.phase === "dragging" &&
          currentSession.hoverTarget?.area === "content"
        ) {
          if (!currentSession.hoverTarget.splitSide) {
            const targetSection = nextTabState.sections[currentSession.hoverTarget.tabSectionId];
            if (
              targetSection &&
              currentSession.hoverTarget.tabSectionId !== currentSession.currentTabSectionId
            ) {
              nextTabState = moveTabSectionTab(nextTabState, {
                sourceSectionId: currentSession.currentTabSectionId,
                targetSectionId: currentSession.hoverTarget.tabSectionId,
                tabId: currentSession.tabId,
                targetIndex: targetSection.tabs.length,
              });
            }
          } else {
            const targetLeaf = layoutRef.current.getSection(
              currentSession.hoverTarget.anchorLeafSectionId ?? currentSession.hoverTarget.leafSectionId,
            );
            if (
              targetLeaf &&
              targetLeaf.data.component.type === "tab-section"
            ) {
            const nextTabSectionId = createScopedRuntimeId("tab-section");
            const originalChildSectionId = createScopedRuntimeId("section");
            const newChildSectionId = createScopedRuntimeId("section");
            const splitPlan = resolveSplitPlan(currentSession.hoverTarget.splitSide);
            const originalDraft = buildSectionDraftFromLeaf(targetLeaf, originalChildSectionId);
            const newDraft = createExampleSectionDraft(
              newChildSectionId,
              currentSession.title,
              targetLeaf.data.role,
              createSectionComponentBinding("tab-section", {
                tabSectionId: nextTabSectionId,
              }),
            );

            nextRoot = splitSectionTree(
              nextRoot,
              targetLeaf.id,
              splitPlan.direction,
              splitPlan.originalAt === "first"
                ? {
                    ratio: splitPlan.ratio,
                    first: originalDraft,
                    second: newDraft,
                  }
                : {
                    ratio: splitPlan.ratio,
                    first: newDraft,
                    second: originalDraft,
                  },
            );

            nextTabState = upsertTabSection(
              nextTabState,
              createEmptyTabSectionStateItem(nextTabSectionId),
            );
            nextTabState = moveTabSectionTab(nextTabState, {
              sourceSectionId: currentSession.currentTabSectionId,
              targetSectionId: nextTabSectionId,
              tabId: currentSession.tabId,
              targetIndex: 0,
            });
            }
          }
        }

        const cleaned = cleanupEmptyTabSections(nextRoot, nextTabState);
        if (cleaned.root !== layoutRef.current.root) {
          layoutRef.current.resetLayout(cleaned.root);
        }
        if (cleaned.state !== tabSectionsRef.current.state) {
          tabSectionsRef.current.resetState(cleaned.state);
        }

        console.info("[layout-v2] tab section pointer interaction finished", {
          tabId: currentSession.tabId,
          sourceTabSectionId: currentSession.sourceTabSectionId,
          currentTabSectionId: currentSession.currentTabSectionId,
          hoverArea: currentSession.hoverTarget?.area ?? null,
          splitSide: currentSession.hoverTarget?.splitSide ?? null,
        });
        return null;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishSession);
    window.addEventListener("pointercancel", finishSession);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishSession);
      window.removeEventListener("pointercancel", finishSession);
    };
  }, [tabDragSession?.pointerId]);

  const activeDragIcon = activityDragSession
    ? Object.values(activityBars.state.bars)
        .flatMap((bar) => bar.icons)
        .find((icon) => icon.id === activityDragSession.iconId) ?? null
    : null;

  const activeDraggedTab = tabDragSession
    ? findTabInSectionsState(tabSections.state, tabDragSession.tabId)?.tab ?? {
        id: tabDragSession.tabId,
        title: tabDragSession.title,
        content: tabDragSession.content,
        tone: tabDragSession.tone,
      }
    : null;

  const tabPreviewSession = useMemo(
    () => buildPreviewDragSession(tabDragSession),
    [
      tabDragSession?.sourceTabSectionId,
      tabDragSession?.currentTabSectionId,
      tabDragSession?.sourceLeafSectionId,
      tabDragSession?.currentLeafSectionId,
      tabDragSession?.tabId,
      tabDragSession?.title,
      tabDragSession?.content,
      tabDragSession?.tone,
      tabDragSession?.pointerId,
      tabDragSession?.phase,
      tabDragSession?.hoverTarget?.area,
      tabDragSession?.hoverTarget?.leafSectionId,
      tabDragSession?.hoverTarget?.anchorLeafSectionId,
      tabDragSession?.hoverTarget?.tabSectionId,
      tabDragSession?.hoverTarget?.targetIndex,
      tabDragSession?.hoverTarget?.splitSide,
      tabDragSession?.hoverTarget?.contentBounds?.left,
      tabDragSession?.hoverTarget?.contentBounds?.top,
      tabDragSession?.hoverTarget?.contentBounds?.right,
      tabDragSession?.hoverTarget?.contentBounds?.bottom,
      tabDragSession?.hoverTarget?.contentBounds?.width,
      tabDragSession?.hoverTarget?.contentBounds?.height,
    ],
  );

  const previewLayoutState = useMemo(
    () => buildPreviewLayoutState(layout.root, tabSections.state, tabPreviewSession),
    [layout.root, tabSections.state, tabPreviewSession],
  );
  const renderedRoot = previewLayoutState?.root ?? layout.root;
  const renderedTabSectionsState = previewLayoutState?.state ?? tabSections.state;

  const componentRegistry = useMemo(
    () => createSectionComponentRegistry<ExampleSectionLayoutData>({
      empty: () => null,
      "activity-bar": ({ binding }) => (
        (() => {
          const activityBinding = binding as SectionComponentBinding<"activity-bar", { barId: string }>;
          return (
        <ActivityBar
          bar={activityBars.getBar(activityBinding.props.barId)}
          dragSession={activityDragSession}
          onDragSessionChange={setActivityDragSession}
          onSelectIcon={(iconId) => activityBars.selectIcon(activityBinding.props.barId, iconId)}
          onMoveIcon={(move) => activityBars.moveIcon(move)}
        />
          );
        })()
      ),
      "tab-section": ({ section, binding }) => (
        (() => {
          const tabBinding = binding as SectionComponentBinding<"tab-section", { tabSectionId: string }>;
          return (
        <TabSection
          leafSectionId={section.id}
          committedLeafSectionId={findTabSectionLeaf(layout.root, tabBinding.props.tabSectionId)?.id ?? section.id}
          tabSectionId={tabBinding.props.tabSectionId}
          tabSection={renderedTabSectionsState.sections[tabBinding.props.tabSectionId] ?? null}
          dragSession={tabDragSession}
          interactive={!isPreviewTabSectionId(tabBinding.props.tabSectionId)}
          onDragSessionChange={setTabDragSession}
          onFocusTab={(tabId) => tabSections.focusTab(tabBinding.props.tabSectionId, tabId)}
          onCloseTab={(tabId) => {
            let nextState = closeTabSectionTab(tabSections.state, tabBinding.props.tabSectionId, tabId);
            const cleaned = cleanupEmptyTabSections(layout.root, nextState);
            nextState = cleaned.state;
            if (cleaned.root !== layout.root) {
              layout.resetLayout(cleaned.root);
            }
            tabSections.resetState(nextState);
          }}
          onMoveTab={(move) => {
            tabSections.moveTab(move);
            setTabDragSession((currentSession) => {
              if (!currentSession) {
                return currentSession;
              }
              if (currentSession.tabId !== move.tabId) {
                return currentSession;
              }

              const targetLeaf = findTabSectionLeaf(layout.root, move.targetSectionId);
              return {
                ...currentSession,
                currentTabSectionId: move.targetSectionId,
                currentLeafSectionId: targetLeaf?.id ?? currentSession.currentLeafSectionId,
              };
            });
          }}
        />
          );
        })()
      ),
    }),
    [activityBars, activityDragSession, layout, renderedTabSectionsState, tabDragSession, tabSections],
  );

  return (
    <div className="layout-v2-example__app">
      {/* 全屏布局舞台：仅挂载四栏布局本身，不渲染任何额外测试控件。 */}
      <SectionLayoutView
        root={renderedRoot}
        animationRoot={renderedRoot}
        onResizeSection={layout.resizeSection}
        renderSection={(section) => (
          <SectionComponentHost
            section={section}
            registry={componentRegistry}
          />
        )}
        className="layout-v2-example__fullscreen-layout"
      />
      {activityDragSession?.phase === "dragging" && activeDragIcon ? (
        <div
          className="layout-v2-activity-bar-drag-preview"
          style={{
            transform: `translate(${activityDragSession.pointerX + 14}px, ${activityDragSession.pointerY - 10}px)`,
          }}
        >
          {activeDragIcon.symbol}
        </div>
      ) : null}
      {tabDragSession?.phase === "dragging" && activeDraggedTab ? (
        <div
          className="layout-v2-activity-bar-drag-preview"
          style={{
            transform: `translate(${tabDragSession.pointerX + 16}px, ${tabDragSession.pointerY - 12}px)`,
          }}
        >
          <div
            className={
              tabDragSession.hoverTarget?.area === "content"
                ? "layout-v2-tab-section-drag-preview--card"
                : "layout-v2-tab-section-drag-preview--tab"
            }
          >
            {tabDragSession.hoverTarget?.area === "content" ? (
              <>
                <div className="layout-v2-tab-section-drag-preview__card-title">{activeDraggedTab.title}</div>
                <div className="layout-v2-tab-section-drag-preview__card-body">{activeDraggedTab.content}</div>
              </>
            ) : (
              <>
                <span className="layout-v2-tab-section-drag-preview__tab-title">{activeDraggedTab.title}</span>
                <span className="layout-v2-tab-section-drag-preview__tab-close">×</span>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
