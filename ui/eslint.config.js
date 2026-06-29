import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ["vite.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      sonarjs,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React-Compiler advisory rules (react-hooks v7): keep as warnings — they flag
      // intentional latest-ref / recursive-timer patterns in the tested replay engine.
      // The classic rules (rules-of-hooks, exhaustive-deps) stay as errors.
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Catch the "Complex Method" class locally + in CI (CodeFactor uses similar metrics).
      // The repo uses deliberate, guarded `!` for provably-safe indexed access (noUncheckedIndexedAccess pass).
      "@typescript-eslint/no-non-null-assertion": "off",
      // Idiomatic React event handlers like `onClick={() => setX(v)}` return void expressions.
      "@typescript-eslint/no-confusing-void-expression": "off",
      complexity: ["error", 12],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  // Disable type-aware rules on plain JS config files (e.g. eslint.config.js itself).
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
