import { defineConfig } from "vitest/config";

// Alias the Workers-runtime-only "cloudflare:workers" module to a local stub so `vitest run`
// (plain Node, no @cloudflare/vitest-pool-workers / real workerd runtime) can resolve worker.ts's
// module graph — it re-exports TrialQuotaDO (wrangler requires DO classes to be exported from the
// main script), which extends the real DurableObject base class. See test/stubs/cloudflare-workers.ts.
export default defineConfig({
  test: {
    alias: {
      "cloudflare:workers": "./test/stubs/cloudflare-workers.ts",
    },
    // `npm run test:coverage` (CI) fails when coverage drops below these floors. autoUpdate ratchets
    // them up (floored to whole percent) when coverage rises — commit the bumped numbers.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: {
        autoUpdate: (n: number) => Math.floor(n),
        statements: 83,
        branches: 74,
        functions: 77,
        lines: 84,
      },
    },
  },
});
