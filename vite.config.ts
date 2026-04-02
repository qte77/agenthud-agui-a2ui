import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.CI ? "/agenthud-agui-a2ui/" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "ES2022",
  },
});
