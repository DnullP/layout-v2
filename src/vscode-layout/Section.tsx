/**
 * @module host/layout-v2/vscode-layout/Section
 * @description 叶子 section 的基础承载组件。
 *   该组件只负责提供 section 壳层和内容容器，不附加任何业务逻辑或视觉装饰。
 */

import { type ReactNode } from "react";

export interface SectionProps {
    sectionId: string;
    children?: ReactNode;
}

export function Section(props: SectionProps): ReactNode {
    return (
        <div className="layout-v2__leaf-shell" data-section-id={props.sectionId}>
            <div className="layout-v2__leaf-content">{props.children}</div>
        </div>
    );
}