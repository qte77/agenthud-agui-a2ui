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
  },
});
