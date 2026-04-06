/**
 * @module App
 * @description layout-v2 独立项目的 demo 应用入口。
 * @dependencies
 *   - react
 *   - ./LayoutV2Examples
 * @example
 *   <App />
 * @exports
 *   - App  独立 demo 根组件
 */

import { type ReactNode } from "react";
import { LayoutV2ExamplesApp } from "./LayoutV2Examples";

/**
 * @function App
 * @description 渲染 layout-v2 的内置示例应用。
 * @returns demo 根节点。
 */
export function App(): ReactNode {
  return <LayoutV2ExamplesApp />;
}

export default App;