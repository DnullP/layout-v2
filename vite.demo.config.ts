/**
 * @module vite.demo.config
 * @description Static demo build config for Vercel deployment.
 */

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
  },
});
