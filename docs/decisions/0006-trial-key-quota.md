---
title: ADR-0006 — Trial-key quota via Durable Objects (+ a scoped Turnstile self-host exception)
description: Decision to back the 2-3-free-real-prompts trial tier's hard per-visitor and shared-daily caps with a single generic Durable Object class, after verifying KV's eventual consistency and the RateLimit binding's 60s period ceiling both make them unsuitable — and to accept Cloudflare Turnstile's client-side widget script as one documented, scoped exception to the self-host / zero-external-request policy.
---

# ADR-0006 — Trial-key quota via Durable Objects

**Status:** Accepted (2026-08-26)
**Relates to:** [ADR-0005][adr-0005] (agent-native endpoints, same Worker) · `docs/protocols.md` ·
the keyless `/agent/render` tier this feature sits alongside (US-6)

## Context

The keyless tier (`/agent/render`) is deliberately `:free`-only — it can never cost the owner
money, so a sliding-window `RateLimit` binding is sufficient abuse protection. A **trial** tier
(2-3 calls against a real, non-`:free` model per visitor, then BYOK) is different: it spends the
owner's held OpenRouter key, so it needs a **hard, unbypassable cap**, not a sliding window — and a
shared daily circuit-breaker in case the per-visitor cap is somehow defeated.

## Decision

Back both caps with **one Durable Object class**, `TrialQuotaDO`, used two ways by naming
convention: `getByName(<visitor-ip>)` for a permanent per-visitor cap (3, never resets), and
`getByName("__global_daily__")` for a shared daily cap (default 200/day, UTC-midnight alarm reset).
The DO wraps a pure, unit-tested counting function (`quotaLogic.ts`); the class itself is thin
runtime glue, verified by effect (no `@cloudflare/vitest-pool-workers` dependency exists in this
worker to simulate a real DO runtime in tests).

**Why not the two options that look simpler:**

| Option | Verified problem |
|---|---|
| Workers KV | Cloudflare's own docs state KV is eventually-consistent (changes take up to 60s+ to propagate) with no atomic read-modify-write, and explicitly recommend Durable Objects for stronger guarantees. A visitor's rapid successive calls could land on different edge colos and race past a KV-backed counter, exceeding the cap. |
| A second `RateLimit` binding (like `RATE_LIMITER`/`FREE_RATE_LIMITER`) | Cloudflare's Rate Limiting binding caps `period` at 10 or 60 seconds — verified against the current binding docs. Neither "3 uses, ever" (no window at all) nor "N/day" (86400s) fits. |

Durable Objects give single-threaded, strongly-consistent state per named instance — concurrent
requests to the *same* name serialize, so a read-then-increment can't race. This was verified
against Cloudflare's current docs before committing to the design, not assumed from training data.

**Identity:** the visitor-cap DO is named by `cf-connecting-ip` — the same pattern already used by
this worker's Turnstile check and both existing `RateLimit` bindings. Accepts the same known
tradeoff those already carry (shared-IP visitors share a quota; resettable via VPN); Turnstile still
gates every call, raising the bar beyond bare IP. A more precise (but more complex — new
client-side storage, a bootstrapping step) opaque-token identity scheme was considered and rejected
for MVP as unnecessary complexity given the existing precedent.

**Check ordering:** Turnstile verification runs *before* either quota check (both the daily and
per-visitor). Turnstile costs nothing to verify (no model spend); checking a quota first would let
an attacker with no valid token exhaust the *shared* daily cap by spamming requests — a free denial
of service against real visitors, since the attacker never reaches the paid model call either way.

**One documented policy exception:** Cloudflare Turnstile's client-side widget can only be loaded
from `challenges.cloudflare.com` — the challenge is served live by Cloudflare, so it cannot be
self-hosted. This is accepted as the one deliberate, scoped exception to this project's self-host /
zero-external-request policy: it is the actual abuse gate for a real-money resource, and the
worker-side verification it feeds was already trusted before this feature existed. Nothing else in
this feature — the DO, the trial model call, the UI wiring — introduces any other external request.

## Consequences

- First Durable Objects usage in this repo. `worker/wrangler.toml` gains a `durable_objects.bindings`
  + `migrations` block (mirrored under `[env.dev]` — bindings aren't inherited by named envs, unlike
  migrations, which apply globally unless overridden).
- `worker/vitest.config.ts` (new) aliases the Workers-runtime-only `cloudflare:workers` module to a
  local stub (`worker/test/stubs/cloudflare-workers.ts`) so plain `vitest run` can resolve
  `worker.ts`'s module graph (it must re-export `TrialQuotaDO` — wrangler requires DO classes to be
  exported from the main script). `tsc` never needed this; `@cloudflare/workers-types`' ambient
  module declaration already satisfies typechecking. The stub is resolution-only, not a DO
  simulation — nothing instantiates it into real DO behavior.
- The trial tier reuses the existing `OPENROUTER_KEY` secret (the `:free` restriction lives in
  `providers.ts`'s code, not the key itself) — no new secret to provision.
- A failed trial render is refunded (doesn't consume the visitor's use) — a provider hiccup
  shouldn't cost one of only 2-3 tries. Unlike the $0 keyless tier, a trial failure surfaces an
  honest error rather than the deterministic stub batch, since masking a paid-trial failure would
  misrepresent what happened.

## References

- `worker/src/trial/quotaLogic.ts` (pure, tested) · `worker/src/trial/quota.ts` (DO class) ·
  `worker/src/agent/trial.ts` (`renderTrial`) · wired in `worker/src/worker.ts` (`handleTrialRender`,
  route `POST /agent/trial-render`).
- `worker/README.md`'s "Trial tier" section for the operator-facing route + env var reference.

[adr-0005]: 0005-agent-native-endpoints.md
