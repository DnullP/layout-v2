# layout-v2

Independent React layout engine extracted from `ofive`.

该布局引擎提供了vscode布局的骨架，可复用于同类型布局的应用

仓库内保留了一个独立 demo 用于开发和回归验证，但 demo 不属于包的公共 API。

## Included

- Section tree model and React controller
- Recursive layout renderer with split and resize support
- Activity bar, tab-section, and panel-section engine components
- Bun unit tests and Playwright regression coverage

## Repository Structure

- `src/index.ts`: 包根入口，转发 `vscode-layout` 公共接口
- `src/vscode-layout/`: VSCode 风格布局引擎实际实现目录
- `src/example/`: 示例与演示代码
- `src/example/demo/`: 本地开发时运行的 demo 应用入口

`main`、`App` 和 demo 主题样式都只服务于仓库内示例，不应被外部应用当作引擎接口使用。

## Local Development

```bash
npm install
npm run dev
```

The demo app runs on `http://127.0.0.1:4175`.

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

Examples and demo-only helpers are intentionally not re-exported from the package root.