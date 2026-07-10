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
    // Split the EAGER vendors (react, @a2ui) into named, cacheable chunks so the main chunk clears
    // Vite's >500 kB warning. Deliberately NOT a blanket node_modules group — that would pull ai/@ai-sdk
    // into the eager graph and break the Live code-split (the AI SDK must stay in the lazy LiveDashboard
    // chunk; see the marker check in docs/plans/012). Vite 8 / Rolldown: codeSplitting groups replace the
    // old rollup manualChunks. This does not reduce first-load bytes; it improves caching + silences the warning.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: "a2ui", test: /node_modules\/@a2ui\// },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: true,
  },
});
