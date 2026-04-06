/**
 * @module host/layout-v2/sectionComponent
 * @description section component 抽象层。
 *   该模块为 section 提供组件绑定、组件注册表与统一挂载入口，
 *   让 activity bar、tab section、panel 等组件都能通过 API 装配进 section，
 *   而不需要在插件或示例页面里写死布局细节。
 * @dependencies
 *   - react
 *   - ./layoutModel
 *
 * @example
 *   const registry = createSectionComponentRegistry<ExampleSectionData>({
 *     empty: () => null,
 *     "activity-bar": ({ binding }) => <ActivityBar barId={binding.props.barId} />,
 *   });
 *
 *   <SectionComponentHost section={section} registry={registry} />
 *
 * @exports
 *   - SectionComponentBinding     section 组件绑定描述
 *   - SectionComponentData        可承载组件绑定的数据约束
 *   - SectionComponentRendererProps 组件渲染上下文
 *   - SectionComponentRegistry    section 组件注册表
 *   - createSectionComponentBinding 创建组件绑定
 *   - getSectionComponentBinding  获取 section 当前绑定的组件描述
 *   - getSectionComponentType     获取 section 当前绑定的组件类型
 *   - isSectionComponentType      判断 section 是否绑定到指定组件类型
 *   - createSectionComponentRegistry 创建组件注册表
 *   - SectionComponentHost        统一 section 组件挂载入口
 */

import { type ReactNode } from "react";
import { type SectionNode } from "./layoutModel";

/**
 * @interface SectionComponentBinding
 * @description section 上绑定的组件描述。
 * @template TType 组件类型标识。
 * @template TProps 组件属性类型。
 * @field type  - 组件类型标识。
 * @field props - 组件属性。
 */
export interface SectionComponentBinding<
  TType extends string = string,
  TProps = unknown,
> {
  /** 组件类型标识。 */
  type: TType;
  /** 组件属性。 */
  props: TProps;
}

/**
 * @function createSectionComponentBinding
 * @description 创建 section component 绑定。
 * @param type 组件类型标识。
 * @param props 组件属性。
 * @returns section component 绑定对象。
 */
export function createSectionComponentBinding<
  TType extends string,
  TProps,
>(type: TType, props: TProps): SectionComponentBinding<TType, TProps> {
  return {
    type,
    props,
  };
}

/**
 * @function getSectionComponentBinding
 * @description 获取 section 当前绑定的组件描述。
 * @param section 目标 section 节点。
 * @returns 当前 section 绑定的组件描述。
 */
export function getSectionComponentBinding<
  TData extends SectionComponentData,
>(section: SectionNode<TData>): TData["component"] {
  return section.data.component;
}

/**
 * @function getSectionComponentType
 * @description 获取 section 当前绑定的组件类型。
 * @param section 目标 section 节点。
 * @returns 当前 section 绑定的组件类型标识。
 */
export function getSectionComponentType<
  TData extends SectionComponentData,
>(section: SectionNode<TData>): TData["component"]["type"] {
  return getSectionComponentBinding(section).type;
}

/**
 * @function isSectionComponentType
 * @description 判断 section 是否绑定到指定组件类型。
 * @param section 目标 section 节点。
 * @param type 待判断的组件类型标识。
 * @returns 命中指定组件类型时返回 true。
 */
export function isSectionComponentType<
  TData extends SectionComponentData,
  TType extends TData["component"]["type"],
>(section: SectionNode<TData>, type: TType): boolean {
  return getSectionComponentType(section) === type;
}

/**
 * @interface SectionComponentData
 * @description 可承载 section component 的数据约束。
 * @template TBinding 组件绑定类型。
 * @field component - 当前 section 绑定的组件描述。
 */
export interface SectionComponentData<
  TBinding extends SectionComponentBinding = SectionComponentBinding,
> {
  /** 当前 section 绑定的组件描述。 */
  component: TBinding;
}

/**
 * @interface SectionComponentRendererProps
 * @description 注册组件渲染函数时可获取的上下文。
 * @template TData section 数据类型。
 * @template TBinding 当前组件绑定类型。
 * @field section - 当前 section 节点。
 * @field binding - 当前 section 绑定的组件描述。
 */
export interface SectionComponentRendererProps<
  TData extends SectionComponentData,
  TBinding extends SectionComponentBinding = TData["component"],
> {
  /** 当前 section 节点。 */
  section: SectionNode<TData>;
  /** 当前 section 绑定的组件描述。 */
  binding: TBinding;
}

/**
 * @type SectionComponentRenderer
 * @description section component 的渲染函数签名。
 */
type SectionComponentRenderer<TData extends SectionComponentData> = (
  props: SectionComponentRendererProps<TData>,
) => ReactNode;

/**
 * @interface SectionComponentRegistry
 * @description section component 注册表。
 * @template TData section 数据类型。
 * @field renderComponent - 根据 section 节点渲染对应组件。
 */
export interface SectionComponentRegistry<TData extends SectionComponentData> {
  /** 根据 section 节点渲染对应组件。 */
  renderComponent: (section: SectionNode<TData>) => ReactNode;
}

/**
 * @function createSectionComponentRegistry
 * @description 基于组件渲染字典创建 section component 注册表。
 * @param renderers 组件渲染字典。
 * @returns section component 注册表。
 */
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

/**
 * @function SectionComponentHost
 * @description section component 的统一挂载入口。
 * @param props 组件挂载参数。
 * @returns 对应 section component 的 React 节点。
 */
export function SectionComponentHost<TData extends SectionComponentData>(props: {
  section: SectionNode<TData>;
  registry: SectionComponentRegistry<TData>;
}): ReactNode {
  return props.registry.renderComponent(props.section);
}