/**
 * @module host/layout-v2/layoutV2ExampleMode
 * @description layout-v2 示例模式判定工具。
 *   该模块负责从 URL query 中读取示例模式标识，
 *   供应用入口与顶层 App 在渲染前做分支判断。
 * @dependencies
 *   - window.location
 *
 * @example
 *   if (isLayoutV2ExampleMode()) {
 *     return <LayoutV2ExamplesApp />;
 *   }
 *
 * @exports
 *   - LayoutV2ExampleKey     示例页面标识
 *   - readLayoutV2ExampleKey 读取当前示例页面标识
 *   - isLayoutV2ExampleMode  判断是否处于布局示例模式
 */

/**
 * @constant LAYOUT_V2_EXAMPLE_QUERY_KEY
 * @description 控制示例页面渲染的 query 参数键名。
 */
const LAYOUT_V2_EXAMPLE_QUERY_KEY = "layoutV2Example";

/**
 * @type LayoutV2ExampleKey
 * @description 当前保留的示例页面标识。
 */
export type LayoutV2ExampleKey = "vscode";

/**
 * @function readLayoutV2ExampleKey
 * @description 从当前 URL 读取示例页面标识。
 * @param 无。
 * @returns 命中的示例标识；无参数或参数非法时返回 null。
 * @throws 无显式抛出；在非浏览器环境中安全返回 null。
 */
export function readLayoutV2ExampleKey(): LayoutV2ExampleKey | null {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const value = searchParams.get(LAYOUT_V2_EXAMPLE_QUERY_KEY);

  if (value === "vscode") {
    return value;
  }

  return null;
}

/**
 * @function isLayoutV2ExampleMode
 * @description 判断当前是否应进入布局示例模式。
 * @param 无。
 * @returns 进入示例模式返回 true。
 * @throws 无显式抛出；在非浏览器环境中安全返回 false。
 */
export function isLayoutV2ExampleMode(): boolean {
  return readLayoutV2ExampleKey() !== null;
}