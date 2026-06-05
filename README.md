# layout-v2

Independent React layout engine extracted from `ofive`.

该布局引擎提供了vscode布局的骨架，可复用于同类型布局的应用

仓库内保留了一个独立 demo 用于开发和回归验证，但 demo 不属于包的公共 API。

## Documentation

- [Core Concepts](./docs/core-concepts.md): 面向 wiki 的核心概念、要素与机制说明

## Included

- Section tree model and React controller
- Recursive layout renderer with split and resize support
- Activity bar, tab-section, and panel-section engine components
- Bun unit tests and Playwright regression coverage

## Repository Structure

- `src/index.ts`: 包根入口，转发 `vscode-layout` 公共接口
- `src/vscode-layout/`: VSCode 风格布局引擎实际实现目录
- `example/usage/`: 示例与回归测试 fixture
- `example/demo/`: 本地开发与 Vercel 部署使用的 demo 应用入口

`main`、`App` 和 demo 主题样式都只服务于仓库内示例，不应被外部应用当作引擎接口使用。

## Local Development

```bash
npm install
npm run dev
```

The demo app runs on `http://127.0.0.1:4175`.

## Vercel Demo

The root demo page is a static Vite app with multiple ready-made workbench scenarios.

```bash
npm run build:demo
npm run preview:demo
```

Vercel can deploy this repository directly with:

- Build command: `npm run build:demo`
- Output directory: `demo-dist`

The included `vercel.json` already sets these values.

## Build

```bash
npm run build
```

This generates `dist/index.js` and `dist/index.cjs` for GitHub-based package consumption.

## Tests

```bash
bun test
npm run test:e2e
```

## Package Consumption

After pushing to GitHub, install it in another project with a Git dependency, for example:

```bash
npm install github:<owner>/layout-v2
```

Import the compiled base styles explicitly in the host app:

```ts
import "layout-v2/styles.css";
```

## Public API Layer

External applications can now integrate through a single export layer instead of directly combining internal reducers and models.

```ts
import {
	createVSCodeLayoutState,
	createVSCodeLayoutStore,
	createRootSection,
	createSectionComponentBinding,
} from "layout-v2";

const root = createRootSection({
	id: "root",
	title: "Root",
	data: {
		role: "root",
		component: createSectionComponentBinding("empty", {}),
	},
});

const store = createVSCodeLayoutStore({
	initialState: createVSCodeLayoutState({
		root,
		activityBars: [
			{
				id: "primary-activity-bar",
				icons: [{ id: "explorer", label: "Explorer", symbol: "E" }],
				selectedIconId: "explorer",
			},
		],
	}),
});

store.splitSection("root", "horizontal", {
	first: {
		id: "sidebar",
		data: {
			role: "sidebar",
			component: createSectionComponentBinding("panel-section", { panelSectionId: "left-panel" }),
		},
	},
	second: {
		id: "main",
		data: {
			role: "main",
			component: createSectionComponentBinding("tab-section", { tabSectionId: "main-tabs" }),
		},
	},
});

store.insertActivityIcon("primary-activity-bar", {
	id: "search",
	label: "Search",
	symbol: "S",
}, 1);
```

The public facade exposes three kinds of capability:

- `createVSCodeLayoutState(...)` for assembling a complete initial snapshot
- `createVSCodeLayoutStore(...)` for subscribing to and mutating the snapshot
- `useVSCodeLayoutStoreState(...)` for consuming the store inside React

For host apps that want a thinner integration layer, `createWorkbenchRegistry()` owns the generic registration boundary for activities, panels, and tab renderers. The host still owns business data and side effects; the registry only handles ordering, snapshots, subscriptions, and projection into `VSCodeWorkbench` props.

```tsx
import { VSCodeWorkbench, createWorkbenchRegistry } from "layout-v2";

const registry = createWorkbenchRegistry();

registry.registerActivity({ id: "collections", label: "Collections", bar: "left" });
registry.registerPanel({
	id: "collections-panel",
	label: "Collections",
	activityId: "collections",
	position: "left",
	render: (context) => <CollectionsPanel context={context} />,
});
registry.registerTabComponent({
	id: "request-editor",
	render: ({ params, api }) => <RequestEditor params={params} api={api} />,
});

function WorkbenchShell() {
	return (
		<VSCodeWorkbench
			activities={registry.useActivityDefinitions()}
			panels={registry.usePanelDefinitions()}
			tabComponents={registry.useTabComponentRenderers()}
			renderPanelContent={(panelId, context) =>
				registry.getPanelById(panelId)?.render(context) ?? null}
		/>
	);
}
```

For hosts that need real tab workbench behavior instead of demo-only glue code, `layout-v2` now also exposes tab workbench helpers that turn `TabSectionDragSession` into reusable preview and commit state transitions:

```ts
import {
	buildTabWorkbenchPreviewState,
	commitTabWorkbenchDrop,
	createSectionComponentBinding,
	type SectionDraft,
} from "layout-v2";

const adapter = {
	createTabSectionDraft: ({ sourceLeaf, nextSectionId, nextTabSectionId, title }): SectionDraft<MySectionData> => ({
		id: nextSectionId,
		title,
		data: {
			...sourceLeaf.data,
			component: createSectionComponentBinding("tab-section", {
				tabSectionId: nextTabSectionId,
			}),
		},
		resizableEdges: sourceLeaf.resizableEdges,
		meta: sourceLeaf.meta,
	}),
};

const preview = buildTabWorkbenchPreviewState(root, tabSections, dragSession, adapter);
const committed = commitTabWorkbenchDrop(root, tabSections, dragSession, adapter);
```

These helpers intentionally keep host-specific concerns outside the engine:

- The host still owns tab payloads, renderers, persistence, and business side effects.
- The engine now owns preview split planning, empty-group cleanup, and committed tab-group creation.

Examples and demo-only helpers are intentionally not re-exported from the package root.
