/**
 * @module host/layout-v2/section/Section
 * @description 叶子 section 的基础承载组件。
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