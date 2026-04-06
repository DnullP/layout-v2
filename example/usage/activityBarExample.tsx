/**
 * @module host/layout-v2/example/usage/activityBarExample
 * @description ActivityBar 组件和状态创建示例。
 */

import { type ReactNode } from "react";
import { ActivityBar } from "../../src/activity-bar/ActivityBar";
import {
    createActivityBarState,
    type ActivityBarIconDefinition,
    type ActivityBarsState,
} from "../../src/activity-bar/activityBarModel";
import { useActivityBarState } from "../../src/activity-bar/useActivityBarState";

/** activity bar 中常见的导航图标示例。 */
export const activityBarExampleIcons: ActivityBarIconDefinition[] = [
    { id: "explorer", label: "Explorer", symbol: "E", activationMode: "action" },
    { id: "search", label: "Search", symbol: "S", activationMode: "action" },
    { id: "git", label: "Source Control", symbol: "G", activationMode: "action" },
];

/**
 * @function createActivityBarExampleState
 * @description 创建一个最小 activity bar 状态。
 * @returns activity bar 状态示例。
 */
export function createActivityBarExampleState(): ActivityBarsState {
    return createActivityBarState([
        {
            id: "primary-activity-bar",
            icons: activityBarExampleIcons,
            selectedIconId: activityBarExampleIcons[0]?.id ?? null,
        },
    ]);
}

/**
 * @function ActivityBarUsageExample
 * @description 演示如何在 React 中挂载一个完整的 ActivityBar 组件。
 *   这是组件本体的最小用法；当它被放进 section.data.component 并交给 registry 渲染时，
 *   它就以 section component 的身份参与整个布局系统。
 * @returns ActivityBar React 示例。
 */
export function ActivityBarUsageExample(): ReactNode {
    const activityBars = useActivityBarState({
        initialState: createActivityBarExampleState(),
    });

    return (
        <ActivityBar
            bar={activityBars.getBar("primary-activity-bar")}
            onActivateIcon={() => {}}
            onSelectIcon={(iconId) => activityBars.selectIcon("primary-activity-bar", iconId)}
            onMoveIcon={(move) => activityBars.moveIcon(move)}
        />
    );
}