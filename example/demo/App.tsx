/**
 * @module host/layout-v2/example/demo/App
 * @description 仓库内 demo 应用入口。
 *   该文件只服务于本地示例运行，不属于布局引擎公共 API。
 */

import { type ReactNode } from "react";
import { SectionLayoutViewUsageExample } from "../usage";

export function App(): ReactNode {
    return <SectionLayoutViewUsageExample />;
}

export default App;