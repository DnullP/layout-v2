/**
 * @module host/layout-v2/example/demo/main
 * @description layout-v2 仓库内 demo 的浏览器入口。
 *   该入口只用于本地开发和示例预览。
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./demoTheme.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("[layout-v2] root mount element is missing");
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);