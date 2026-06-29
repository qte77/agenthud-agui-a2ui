import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

// Type-aware static analysis for the security-critical proxy. The complexity rules catch the
// "Complex Method" class locally + in CI (CodeFactor uses similar metrics) before push, not after.
export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".wrangler/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs },
    rules: {
      // The proxy uses deliberate, guarded `!` for provably-safe non-null access.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Idiomatic void callbacks (e.g. event handlers) should not require extra braces.
      "@typescript-eslint/no-confusing-void-expression": "off",
      complexity: ["error", 12],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  // Disable type-aware rules on plain JS config files (e.g. eslint.config.js itself).
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
