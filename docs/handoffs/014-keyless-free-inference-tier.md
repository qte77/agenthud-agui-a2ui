---
date: 2026-07-10
status: planned
issues: [187, 211]
plan: plans/014-keyless-free-inference-tier.md
title: Handoff 014 — US-6 keyless free-inference tier (ldnmxx-style server chain + Turnstile)
description: Build the deferred US-6 "keyless" tier — the worker runs free models server-side (Workers AI → OpenRouter `:free`) so visitors need no key. Security-first (free-ids-only + Turnstile). Plan 014 carries the full two-repo source map; execute PR1 (worker, TDD) → PR2 (browser + docs) → deploy.
---

# Handoff 014 — US-6 keyless free-inference tier

> Read [plan 014][plan] first — it carries the **two-repo source map** (agenthud target + ldnmxx-hack
> port source, with file:line refs), the security design, and the settled design calls. You should NOT
> need to re-map either repo.

## Where we are

Plan-mode is **done** (this session). **Nothing built yet.** The user picked, via AskUserQuestion:
**Option B (full server chain: Workers AI → OpenRouter `:free`)** + **Turnstile in the launch PR**. This
reverses the long-deferred US-6 "keyless" decision on purpose, with hardening that caps worst-case cost at
**$0** and closes the Origin-spoof drain our own `worker/README.md:55-57` documents.

## Do this — in order (each its own branch + PR; user merges)

1. **PR1 `feat/worker-keyless-freechain` (worker; TDD-heavy).** Port ldnmxx's pure kernel into `worker/src/`
   (`model.ts`, `providers.ts`, a dep-free `contract.ts` validator lifted from `ui/src/agent/contract.ts:87-139`,
   `prompts.ts` copied, `turnstile.ts`) + a `/agent/render` branch in `worker.ts` inserted **after the
   rate-limit gate (:86), before `resolveUpstream` (:88)**. Extend `Env` (router.ts) + `wrangler.toml`
   (`[ai]`, 2nd `[[ratelimits]]`, `[env.dev]` mirror). **Red-first** on renderFree/buildProviders/assertFreeId/
   extractBatch/validator/verifyTurnstile — **the user checks Red before GREEN**.
2. **PR2 `feat/live-keyless-mode` (browser + docs; wiring → E2E).** `ui/src/agent/keylessAgent.ts`
   (POST → synth 4 AG-UI events; **event-synth Red-first**), branch `useLiveAgent.stream()` at :84, add the
   `keyless` `ENDPOINTS` entry + `Endpoint.keyless?` (config.ts), Free-mode UI in `LiveDashboard.tsx` (relax
   `connectionReady` :196-198, hide key input :250-257, Turnstile widget with a **fresh token per turn**).
   Docs: CHANGELOG, US-6 → delivered, a **new ADR** (keyless secret+abuse model + Turnstile self-host
   exception), architecture flow box. Reopen/close **#187**.
3. **Deploy (user runs; authenticated).** `wrangler secret put OPENROUTER_KEY` + `TURNSTILE_SECRET` (prod
   AND `--env dev`); create the Turnstile widget (`turnstile-spin` skill); `set -a; . worker/.env; set +a;
   wrangler deploy --cwd worker`. Then live-verify + E2E.

## Design calls already SETTLED (do not relitigate)

- **Option B, not A** (the KISS key-injecting proxy was offered and declined) — the worker owns the chain.
- **Providers:** Workers AI first (truly $0, spares OpenRouter quota) → OpenRouter `:free`. **Drop GitHub
  Models** (retired 2026-07-30, just removed in #165 — do NOT re-add).
- **One-shot JSON** response (not ldnmxx's SSE) — render is atomic; browser synthesizes the events.
- **Worker owns the system prompt** (copied from `ui/src/agent/prompts.ts`) — never trust a client-sent prompt.
- **Free-ids-only enforced in code** (`assertFreeId`, reject non-`:free` + ignore client model) = the $0 lock.
- **Turnstile in the launch** (siteverify server-side) — the accepted answer to the Origin-spoof abuse gap.
- **Dep-free validator lifted into the worker = #211's smallest step** (agenthud's cycle-check is stronger
  than ldnmxx's `isSelfContainedBatch`).

## Sub-decisions to make DURING implementation (small)

- Exact `FREE_RATE_LIMITER` limit (≤20/60s) + prompt-byte cap value (well under 1 MiB).
- Refresh `DEFAULT_OPENROUTER_FREE_MODELS` against OpenRouter's live `:free`+tool-capable list at impl time
  (drift — bump the `verified` date; see plan 012's re-runnable probe).
- Turnstile per-turn token UX (re-execute the widget before each Run/composer submit — tokens are single-use/short-TTL).

## Discipline (standing)

Plan-mode already done → go straight to PR1 RED. **Strict TDD Red-first for the pure kernel + event-synth
only** (user checks Red); **no unit tests** for wiring/config/UI/wrangler (verify by build + curl + E2E).
Strict lint (complexity ≤12, `exactOptionalPropertyTypes`) + **sec**: the key lives only in the upstream
`authorization` header — never in a response/transcript/error/`console.*` (observability logs 100%). New
branch per PR; conventional commits; push + PR with `env -u GH_TOKEN -u GITHUB_TOKEN`; **user merges**.

## Env gotchas

- **Dev server is on :5174** — a stale ldnmxx-hack dev server may hold :5173 (its app is "Founder's
  Copilot / Groundwork", NOT agenthud). Check `npm --prefix ui run dev` output for the real port.
- **`worker/.env`** holds the Cloudflare deploy token + account id (auth works when loaded from the worker
  cwd). Run the local binary `worker/node_modules/.bin/wrangler` (or `--cwd worker`), **not `npx`** (RTK hook
  mangles it).
- **Workers AI `.bind()` gotcha** (ldnmxx providers.ts:77-81): a detached `env.AI.run` throws — bind it.
- Sandbox: no pipes / `grep` / compound bash; use Read/node. gh needs `env -u GH_TOKEN -u GITHUB_TOKEN`.

## Verification

Per PR: `cd worker && npm test` and `cd ui && npm run typecheck && lint && test && build` green (new-module
tests Red-first). Endpoint pre-UI: `curl` the deployed/`wrangler dev` `/agent/render` (valid token → batch;
bad/absent token → 403; non-`:free` → rejected; oversized → 413; spoofed Origin + no token → 403). E2E via
patchright (Free mode → Turnstile → Run → `.a2ui-surface .qte-card`, 0 console errors, key absent from
network/DOM; forced-failure → deterministic stub).

[plan]: ../plans/014-keyless-free-inference-tier.md
