/**
 * @module host/layout-v2/example/usage/sectionComponentExample
 * @description section component registry 和 host 的使用示例。
 */

import { type ReactNode } from "react";
import { ActivityBarUsageExample } from "./activityBarExample";
import { findSectionNode } from "../../src/vscode-layout/layoutModel";
import {
    SectionComponentHost,
    createSectionComponentRegistry,
    type SectionComponentBinding,
} from "../../src/vscode-layout/sectionComponent";
import {
    createSectionTreeExample,
    type SectionTreeExampleData,
} from "./sectionTreeExample";

/**
 * @description 最小 registry 示例。
 *   这里直接把 ActivityBar / TabSection / PanelSection 都当成 section component 来挂载。
 */
export const sectionComponentRegistryExample = createSectionComponentRegistry<SectionTreeExampleData>({
    empty: () => <div>Empty Section</div>,
    "activity-bar": ({ binding }) => {
        const activityBinding = binding as SectionComponentBinding<"activity-bar", { barId: string }>;
        return (
            <div>
                <div>Activity Bar Section: {activityBinding.props.barId}</div>
                <ActivityBarUsageExample />
            </div>
        );
    },
    "tab-section": ({ binding }) => {
        const tabBinding = binding as SectionComponentBinding<"tab-section", { tabSectionId: string }>;
        return <div>Tab Section: {tabBinding.props.tabSectionId}</div>;
    },
    "panel-section": ({ binding }) => {
        const panelBinding = binding as SectionComponentBinding<"panel-section", { panelSectionId: string }>;
        return <div>Panel Section: {panelBinding.props.panelSectionId}</div>;
    },
});

/**
 * @function SectionComponentHostUsageExample
 * @description 演示如何把某个 leaf section 交给 registry 统一渲染。
 * @returns SectionComponentHost React 示例。
 */
export function SectionComponentHostUsageExample(): ReactNode {
    const root = createSectionTreeExample();
    const activityBarSection = findSectionNode(root, "activity-bar");
    if (!activityBarSection) {
        return null;
    }

    return (
        <SectionComponentHost
            section={activityBarSection}
            registry={sectionComponentRegistryExample}
        />
    );
}