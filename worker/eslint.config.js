import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

// Static analysis for the security-critical proxy. The complexity rules catch the "Complex Method"
// class locally + in CI (CodeFactor uses similar metrics) so it's caught before push, not after.
export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".wrangler/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: { sonarjs },
    rules: {
      complexity: ["error", 12],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
);
