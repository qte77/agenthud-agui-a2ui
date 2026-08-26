// Test-only stub for the "cloudflare:workers" virtual module, aliased in vitest.config.ts.
// This worker has no @cloudflare/vitest-pool-workers dependency (plain vitest, no real workerd
// runtime), so the real Workers-runtime-only module can't resolve under `vitest run`. `tsc` never
// needs this file — @cloudflare/workers-types' ambient `declare module "cloudflare:workers"`
// already satisfies typechecking; this shim exists ONLY so `class TrialQuotaDO extends
// DurableObject<Env>` has a real constructor to extend when the test runner evaluates the module
// graph (nothing in this suite instantiates TrialQuotaDO — see quota.ts's header comment on why
// the DO class itself is verified by effect, not unit-tested).
export class DurableObject<Env = unknown> {
  ctx: unknown;
  env: Env;
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
