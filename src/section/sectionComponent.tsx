/**
 * @module host/layout-v2/section/sectionComponent
 * @description section component 抽象层。
 */

import { type ReactNode } from "react";
import { type SectionNode } from "./layoutModel";

export interface SectionComponentBinding<
    TType extends string = string,
    TProps = unknown,
> {
    type: TType;
    props: TProps;
}

export function createSectionComponentBinding<
    TType extends string,
    TProps,
>(type: TType, props: TProps): SectionComponentBinding<TType, TProps> {
    return {
        type,
        props,
    };
}

export function getSectionComponentBinding<
    TData extends SectionComponentData,
>(section: SectionNode<TData>): TData["component"] {
    return section.data.component;
}

export function getSectionComponentType<
    TData extends SectionComponentData,
>(section: SectionNode<TData>): TData["component"]["type"] {
    return getSectionComponentBinding(section).type;
}

export function isSectionComponentType<
    TData extends SectionComponentData,
    TType extends TData["component"]["type"],
>(section: SectionNode<TData>, type: TType): boolean {
    return getSectionComponentType(section) === type;
}

export interface SectionComponentData<
    TBinding extends SectionComponentBinding = SectionComponentBinding,
> {
    component: TBinding;
}

export interface SectionComponentRendererProps<
    TData extends SectionComponentData,
    TBinding extends SectionComponentBinding = TData["component"],
> {
    section: SectionNode<TData>;
    binding: TBinding;
}

type SectionComponentRenderer<TData extends SectionComponentData> = (
    props: SectionComponentRendererProps<TData>,
) => ReactNode;

export interface SectionComponentRegistry<TData extends SectionComponentData> {
    renderComponent: (section: SectionNode<TData>) => ReactNode;
}

export function createSectionComponentRegistry<TData extends SectionComponentData>(
    renderers: Record<string, SectionComponentRenderer<TData>>,
): SectionComponentRegistry<TData> {
    return {
        renderComponent: (section) => {
            const componentType = getSectionComponentType(section);
            const renderer = renderers[componentType];
            if (!renderer) {
                console.warn("[layout-v2] section component renderer missing", {
                    sectionId: section.id,
                    componentType,
                });
                return null;
            }

            return renderer({
                section,
                binding: section.data.component,
            });
        },
    };
}

export function SectionComponentHost<TData extends SectionComponentData>(props: {
    section: SectionNode<TData>;
    registry: SectionComponentRegistry<TData>;
}): ReactNode {
    return props.registry.renderComponent(props.section);
}