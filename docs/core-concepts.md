# layout-v2 Core Concepts

面向希望接入、扩展或维护 `layout-v2` 的宿主应用与开发者。

本文档使用纯 Markdown 编写，可直接用于仓库 wiki、静态站点或文档构建流程。

本文档聚焦三个问题：

1. `layout-v2` 到底在解决什么问题。
2. 布局中的核心对象分别是什么。
3. 渲染、交互、拖拽和持久化是如何协同工作的。

## Contents

- [1. What layout-v2 Is](#1-what-layout-v2-is)
- [2. Mental Model](#2-mental-model)
- [3. Core Elements](#3-core-elements)
- [4. Public API Layers](#4-public-api-layers)
- [5. Core Mechanisms](#5-core-mechanisms)
- [6. Host Responsibilities](#6-host-responsibilities)
- [7. Recommended Integration Pattern](#7-recommended-integration-pattern)
- [8. What layout-v2 Does Not Own](#8-what-layout-v2-does-not-own)
- [9. Glossary](#9-glossary)
- [10. Reading Order](#10-reading-order)

## 1. What layout-v2 Is

`layout-v2` 是一个偏 VSCode 风格的 React 布局引擎。它不承载业务数据本身，而是负责管理“业务内容如何被组织、展示、切分、拖拽、聚焦和持久化”。

从职责边界上看，它更像一个“工作台骨架”而不是完整应用框架：

- 它负责布局树、活动栏、面板区、标签区、拖拽预览、焦点切换等通用能力。
- 宿主负责真正的业务对象，例如请求、对话、文件、搜索结果、图谱节点、环境配置等。
- 宿主还负责业务渲染器、业务状态源、持久化策略、权限和副作用。

一句话理解：

> `layout-v2` 决定“内容放在哪里、怎么移动、怎么展示”；宿主决定“内容是什么、如何取数、如何保存”。

## 2. Mental Model

可以把整个系统理解成三层：

| 层级 | 作用 | 典型对象 |
| --- | --- | --- |
| 布局骨架层 | 决定区域如何切分和嵌套 | `SectionNode`, section tree |
| 工作台部件层 | 决定不同区域里展示什么容器 | `ActivityBar`, `PanelSection`, `TabSection` |
| 宿主集成层 | 把业务数据投影到布局引擎 | `VSCodeWorkbench`, `Workbench*Definition`, host adapters |

对应到状态模型，大致是：

```ts
VSCodeLayoutState<T> = {
  root: SectionNode<T>;
  activityBars: ActivityBarsState;
  tabSections: TabSectionsState;
  panelSections: PanelSectionsState;
  workbench?: { activeGroupId: string | null };
}
```

这里最关键的一点是：**布局树和内容容器是分离的**。

- `root` 负责空间结构。
- `tabSections` / `panelSections` / `activityBars` 负责容器内容。
- `SectionNode.data` 只负责声明“这个 section 绑定哪一种组件、组件实例 ID 是什么”。

这种分层让布局引擎既能支持固定工作台，也能支持复杂的拆分、预览和拖拽提交。

## 3. Core Elements

## 3.1 Section

`Section` 是布局引擎最底层、最重要的概念。可以把它理解为“屏幕中的一个布局区域节点”。

每个 `SectionNode` 至少包含：

- `id`: 节点唯一标识。
- `title`: 节点名称，主要用于语义与调试。
- `data`: 宿主定义的数据载荷。
- `split`: 当前节点是否被继续切分。
- `resizableEdges`: 边缘是否允许拖拽调整。
- `meta`: 扩展元数据。

`Section` 有两种形态：

- 叶子节点：真正承载一个布局组件，比如 `tab-section` 或 `panel-section`。
- 分裂节点：通过 `split` 保存两个子节点及比例，形成二叉布局树。

### 为什么 section tree 是二叉树

因为布局引擎的核心动作本质上是：

- 把一个区域横向或纵向切成两块。
- 调整两个子区域的比例。
- 删除某个区域后把剩余区域回收合并。

这三个动作都天然适合二叉树表达，且实现简单、状态可预测、便于做拖拽预览和回滚。

## 3.2 Section Component Binding

`Section` 自己只描述空间，不直接决定渲染什么。真正的渲染绑定由 `SectionComponentBinding` 决定。

例如：

```ts
createSectionComponentBinding("tab-section", { tabSectionId: "main-tabs" })
```

它表达的是：

- 当前 section 的渲染类型是 `tab-section`。
- 这个 section 对应的内容实例 ID 是 `main-tabs`。

这一步把“布局位置”和“容器状态”关联起来，但仍不耦合具体业务组件。

## 3.3 Activity Bar

`ActivityBar` 表示活动栏，用于承载一组可激活的入口图标。常见用途是左侧或右侧竖向 icon rail。

它解决的问题不是内容承载，而是“导航和筛选”：

- 某个 icon 是否被选中。
- icon 的顺序如何调整。
- icon 元数据如何维护。
- 某个 icon 被聚焦后，宿主要映射出哪组 panel 或视图。

`ActivityBar` 本身通常不存放复杂业务对象，而是作为工作台的入口层。

## 3.4 Panel Section

`PanelSection` 表示一个面板容器，通常带有 icon bar 或 panel bar，并承载一组 panel。

适合放在侧边栏，常见特点包括：

- 一次展示一组 panel 中的一个焦点面板。
- 支持 panel 顺序变更。
- 支持 panel 拖拽、拆分、合并、回收。
- 可以折叠或在为空时隐藏 bar。

在语义上，`PanelSection` 更偏“工具面板区域”，而不是“文档工作区”。

## 3.5 Tab Section

`TabSection` 表示标签式内容容器，更适合主工作区。

典型行为包括：

- 标签聚焦、关闭、排序。
- 在不同 group 之间拖拽移动。
- 拖出后拆分成新的标签组。
- 空 group 自动销毁。

`TabSection` 通常与 workbench 的“active group”语义耦合，是多标签工作区的核心容器。

## 3.6 Workbench Preset

`layout-v2` 提供了一个高层预设：`VSCodeWorkbench` 及其相关 preset helpers。

它的价值在于把常见的 VSCode 风格结构内建出来，例如：

- 左侧 activity bar
- 左侧 sidebar panel section
- 中央 main tab section
- 可选右侧 sidebar panel section

对应的 helper 包括：

- `createWorkbenchRootLayout(...)`
- `createWorkbenchLayoutState(...)`
- `buildWorkbenchActivityBars(...)`
- `buildWorkbenchPanelSections(...)`
- `buildWorkbenchTabs(...)`

如果宿主只是要一个标准工作台，而不是完全自定义拓扑，这一层通常是接入成本最低的方式。

## 3.7 Store

`VSCodeLayoutStore` 是布局引擎的统一状态入口。它把布局的所有核心对象收敛到一个命令式 store 中。

可以把它理解成：

- 一个集中式状态容器。
- 一个布局命令总线。
- 一个生命周期观测点。

常见能力包括：

- `getState()` / `subscribe()`
- `splitSection()` / `destroySection()` / `resizeSection()`
- `insertActivityIcon()` / `moveActivityIcon()`
- `focusTab()` / `moveTab()` / `moveTabAcrossGroups()`
- `insertPanel()` / `movePanel()` / `setPanelCollapsed()`
- `exportSnapshot()` / `importSnapshot()`

这意味着宿主不需要直接拼 reducer，也不需要自己维持多个局部 store 之间的一致性。

## 3.8 Snapshot

Snapshot 是布局状态的可导入、可导出表示形式。

它的目的主要有三个：

- 布局持久化
- 跨版本迁移
- 调试与回放

由于 `layout-v2` 明确把布局和业务数据分离，所以 snapshot 只应持久化布局相关状态，或持久化业务对象的轻量引用，不应直接把整份业务 store 镶嵌进去。

## 4. Public API Layers

`layout-v2` 的 API 大体可以分成三层。

## 4.1 High Level

适合大多数宿主，推荐优先使用。

- `VSCodeWorkbench`
- `WorkbenchActivityDefinition`
- `WorkbenchPanelDefinition`
- `WorkbenchTabDefinition`
- `createWorkbenchLayoutState(...)`

特点：

- 低接入成本。
- 已经内建常见布局骨架。
- 宿主主要负责提供 activities、panels、tabs、renderers 和持久化。

## 4.2 Mid Level

适合要自定义布局拓扑，但仍想复用现成组件和 store 的场景。

- `createVSCodeLayoutStore(...)`
- `createVSCodeLayoutState(...)`
- `SectionLayoutView`
- `ActivityBar`
- `PanelSection`
- `TabSection`

特点：

- 保留足够高的灵活度。
- 可以自己决定根布局树长什么样。
- 仍复用成熟的 section / drag / preview / commit 机制。

## 4.3 Low Level

适合非常特殊的布局，或者在引擎内部做能力扩展。

- `createRootSection(...)`
- `splitSectionTree(...)`
- `destroySectionTree(...)`
- 各模块 model / drag session / preview session helpers

特点：

- 灵活度最高。
- 也最容易误用。
- 一般不建议宿主从业务代码直接长期依赖这一层。

## 5. Core Mechanisms

## 5.1 Layout Assembly

布局的组装过程通常分四步：

1. 创建 section tree。
2. 创建 activity bars / panel sections / tab sections 的初始状态。
3. 合并成 `VSCodeLayoutState`。
4. 用 `VSCodeLayoutStore` 或 `VSCodeWorkbench` 驱动渲染。

也就是说，`layout-v2` 的装配逻辑不是“先有 React 组件，再隐式生成状态”，而是“先有明确状态，再由 React 渲染”。

这种方式的优点是：

- 更易持久化。
- 更易测试。
- 更易做拖拽预览与提交分离。

## 5.2 Render Pipeline

渲染路径可以概括为：

1. `SectionLayoutView` 从根节点递归渲染 section tree。
2. 每个叶子 section 根据 `component binding` 找到对应组件。
3. `ActivityBar` / `PanelSection` / `TabSection` 再读取自己的局部状态切片。
4. 宿主通过 renderer 或 payload，把业务视图挂载到具体容器里。

这里最重要的机制是“布局引擎只管理容器，不直接拥有业务页面实例”。

## 5.3 Command Model

所有布局变化都应尽量通过 store command 进入，而不是宿主直接篡改内部结构。

原因有三点：

- 命令模型更容易统一触发生命周期 hook。
- 更容易在预览、提交、持久化之间建立稳定边界。
- 更容易保证多个状态分片同步更新。

例如，一个 tab 被拖到新 group，并不是简单改一个数组下标，而通常涉及：

- 预览期计算目标 section tree。
- 生成新的 tab section 或复用已有 section。
- 更新 active group。
- 清理空 group。

这些都适合放到统一命令语义中完成。

## 5.4 Drag and Drop

拖拽是 `layout-v2` 最关键的机制之一，核心原则是：

> 预览状态和提交状态分离。

以 tab / panel 拖拽为例，通常分成两个阶段：

- Preview：根据 drag session 和 hover target，计算一个临时布局结果，用于视觉反馈。
- Commit：用户松手后，把临时意图真正落地到状态树，并清理无效容器。

这一机制的意义在于：

- 避免拖拽过程中频繁破坏正式状态。
- 让空 section 的销毁、单节点回收、焦点切换等逻辑可以在提交阶段集中处理。
- 让复杂 DnD 行为可以通过纯函数测试验证。

### Tab Drag

Tab 拖拽主要依赖 tab workbench helpers：

- `buildTabWorkbenchPreviewState(...)`
- `commitTabWorkbenchDrop(...)`

它们负责：

- 计算拆分方向和预览目标。
- 处理中间态的 group 创建。
- 在提交时清理空源 group。

### Panel Drag

Panel 拖拽对应 panel workbench helpers，目标类似，但语义更偏向侧边面板而非文档标签。

它同样需要处理：

- 面板重排。
- 拆分侧边区域。
- 回收到已有面板栏。
- 单面板源 section 的回收与合并。

## 5.5 Focus Management

布局不只是“显示在哪”，还包括“当前活跃的是谁”。

`layout-v2` 在不同层次维护焦点语义：

- activity bar 的 selected icon
- panel section 的 focused panel
- tab section 的 focused tab
- workbench 的 active group

这些焦点状态共同决定：

- 哪个区域是当前用户工作上下文。
- 快捷键、关闭动作和新建动作应该落到哪里。
- 宿主是否需要同步自己的活跃实体。

## 5.6 Metadata and Host Extension

`meta` 是宿主与引擎之间的重要扩展点。

它适合承载：

- 业务 ID 的轻量引用
- UI 辅助信息
- 固定宽度、边缘约束等宿主扩展信息
- 快照迁移时需要保留的额外字段

但不适合承载：

- 大体量业务数据
- 高频变化且由业务 store 已经维护的数据副本
- 需要跨多个业务域一致性的状态真源

通用原则是：**meta 用来做投影，不用来取代宿主业务状态。**

## 5.7 Persistence and Migration

布局持久化的推荐做法是：

1. 宿主从引擎导出 snapshot。
2. 宿主把 snapshot 保存到自己的持久化层。
3. 下次启动时导入 snapshot。
4. 如果结构演进，则通过 `migrateSnapshot(...)` 做版本迁移。

推荐只持久化：

- section tree
- activity / panel / tab 的结构与顺序
- 焦点信息
- 业务对象引用或 payload 标识

不推荐直接持久化：

- 完整业务实体快照
- UI 暂态中的拖拽 session
- 明显只在当前运行时有效的 ephemeral state

## 6. Host Responsibilities

宿主在接入 `layout-v2` 时应明确承担以下职责：

- 定义业务对象到 `WorkbenchTabDefinition` / `WorkbenchPanelDefinition` 的映射。
- 提供 tab/panel 的真实渲染组件。
- 管理业务状态真源。
- 决定哪些布局状态需要持久化。
- 在业务动作与 layout command 之间建立适配层。

一个健康的集成方式通常是：

- 业务 store 负责实体真源。
- layout store 负责布局真源。
- 两者之间通过 adapter / projection 协作。

## 7. Recommended Integration Pattern

推荐宿主按下面的思路集成：

1. 先把业务对象整理成稳定的 definition 列表。
2. 使用高层 `VSCodeWorkbench` 或 preset helpers 生成初始布局。
3. 用业务 ID 或轻量 payload 连接布局节点与业务渲染。
4. 把持久化逻辑放在宿主，而不是塞进布局组件内部。
5. 只有在高层 API 不够时，才下降到中层或低层。

## 8. What layout-v2 Does Not Own

为了避免架构边界漂移，下面这些东西不应默认交给 `layout-v2`：

- 请求、文档、消息、文件等业务实体本身
- 搜索索引、缓存、网络请求、副作用编排
- 权限体系、菜单策略、领域规则
- 应用级业务路由

引擎可以感知这些对象的“引用”，但不应成为它们的真源。

## 9. Glossary

| 术语 | 含义 |
| --- | --- |
| Section | 一个布局区域节点，是整个布局树的基本单位 |
| Section Tree | 由 section 组成的二叉布局树，决定空间结构 |
| Binding | 声明某个 section 渲染哪种组件，以及绑定哪个容器实例 |
| Activity Bar | 活动栏，一组可激活 icon 的集合 |
| Panel Section | 侧边面板容器，适合工具型内容 |
| Tab Section | 标签容器，适合主工作区内容 |
| Workbench | 基于预设组合出来的完整工作台骨架 |
| Snapshot | 可导入导出的布局状态表示 |
| Preview | 拖拽时的临时布局结果 |
| Commit | 用户松手后真正落地的布局变更 |

## 10. Reading Order

如果是第一次接触 `layout-v2`，推荐按下面的顺序继续阅读源码：

1. `src/vscode-layout/VSCodeWorkbench.tsx`
2. `src/vscode-layout/workbenchPreset.ts`
3. `src/vscode-layout/store.ts`
4. `src/section/layoutModel.ts`
5. `src/tab-section/*` 与 `src/panel-section/*`

这样可以从“高层组合”一路看到“底层模型与交互细节”。