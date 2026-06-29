import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// vite.config.ts runs in Node.js; cast process to its typed shape since the browser
// tsconfig.app.json does not include @types/node.
const nodeEnv = (process as unknown as { env: Record<string, string | undefined> }).env;

export default defineConfig({
  base: nodeEnv.CI ? "/agenthud-agui-a2ui/" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: true,
  },
});
