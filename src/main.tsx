/**
 * @module main
 * @description layout-v2 独立 demo 的浏览器入口。
 * @dependencies
 *   - react
 *   - react-dom/client
 *   - ./App
 *   - ./demoTheme.css
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