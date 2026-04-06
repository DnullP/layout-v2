/**
 * @module host/layout-v2/example/usage/activityBarIconExample
 * @description ActivityBarIcon 子组件使用示例。
 */

import { useState, type ReactNode } from "react";
import { ActivityBarIcon } from "../../src/activity-bar/ActivityBarIcon";
import { type ActivityBarIconDefinition } from "../../src/activity-bar/activityBarModel";

/** 单个 activity icon 的最小数据示例。 */
export const activityBarIconExample: ActivityBarIconDefinition = {
    id: "explorer",
    label: "Explorer",
    symbol: "E",
};

/**
 * @function ActivityBarIconUsageExample
 * @description 演示如何单独渲染一个 activity icon。
 * @returns 单个 icon 的 React 示例。
 */
export function ActivityBarIconUsageExample(): ReactNode {
    const [selected, setSelected] = useState(true);

    return (
        <ActivityBarIcon
            barId="primary-activity-bar"
            index={0}
            icon={activityBarIconExample}
            selected={selected}
            dragging={false}
            onSelect={() => setSelected((current) => !current)}
            onPointerPress={() => { }}
        />
    );
}