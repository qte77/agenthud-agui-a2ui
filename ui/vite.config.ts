import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// vite.config.ts runs in Node.js; cast process to its typed shape since the browser
// tsconfig.app.json does not include @types/node.
const nodeEnv = (process as unknown as { env: Record<string, string | undefined> }).env;

// Build-version badge (footer): the package.json version + the commit it was built from. npm sets
// npm_package_version; the gh-pages workflow passes github.sha as VITE_BUILD_SHA (empty locally →
// "dev"). `define` does static replacement for dev, build, and vitest, so the globals always resolve.
const appVersion = nodeEnv.npm_package_version ?? "0.0.0";
const buildSha = nodeEnv.VITE_BUILD_SHA ?? "";

export default defineConfig({
  base: nodeEnv.CI ? "/agenthud-agui-a2ui/" : "/",
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: true,
  },
});
