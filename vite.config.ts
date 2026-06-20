import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.CI ? "/agenthud-agui-a2ui/" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    globals: true,
  },
});
