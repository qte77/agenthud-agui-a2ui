---
date: 2026-07-08
status: planned
issues: [187, 121]
plan: plans/012-free-byok-endpoints-bundle-chunking.md
title: Handoff 012 — Free-tier BYOK endpoints (#187) + vendor chunking (#121)
description: Two small, independent config/build PRs, planned and context-mapped. #187 = OpenRouter :free models + a CORS-verified Cerebras endpoint in config.ts; #121 = vendor manualChunks in vite.config.ts (must preserve the AI-SDK code-split). Plan 012 carries the full source map, verified model ids, and the marker check — no re-exploration needed.
---

# Handoff 012 — Free-tier BYOK endpoints (#187) + vendor chunking (#121)

> Read [plan 012][plan] first — it carries the **source map** (config.ts + vite.config.ts with line
> refs), the **verified free-model ids** + Cerebras CORS probe, the **code-split marker check**, and the
> docs/issue impact. You should not need to re-map anything.

## Where we are

Both issues are **planned, not started**. They're small and independent — do them as **two separate PRs**,
in any order. Neither is TDD-shaped (config data / build config → verify **by effect**, no unit tests per
AGENTS.md). Approach + exact edits are in plan 012 §"#187 changes" and §"#121 changes".

## Do this

1. **#121 — vendor chunking** (`ui/vite.config.ts`): add the selective `manualChunks` (`react`, `a2ui`).
   Branch `chore/121-vendor-chunking`.
2. **#187 — free BYOK endpoints** (`ui/src/config.ts`): fold the 3 OpenRouter `:free` picks into the
   OpenRouter preset; add the `Cerebras` endpoint (CORS already verified `*`). Branch
   `feat/187-free-byok-endpoints`.
3. Each PR: CHANGELOG line (`### Changed` for #121, `### Added` for #187, `Closes #NNN`); #187 also gets a
   one-line README mention of free options (optional-recommended). Comment on **#165** (2026-07-08 model
   refresh). No other docs; env/URL/CLI already correct (config.ts is the SoT).

## The two things that actually matter

- **#121 — DON'T break the code-split.** A blanket `node_modules → vendor` rule would pull `ai`/`@ai-sdk`
  into an eager chunk. Use the named `react`/`a2ui` chunks only, then **run the marker check** (plan 012
  §Verification): `streamText`/`createOpenAI` must appear ONLY in `LiveDashboard-*.js`. Mandatory.
- **#187 — forced `tool_choice` is the gotcha.** `render_ui` uses `toolChoice:{type:"tool"}` +
  `stepCountIs(1)`. Not every free model honors forced tool_choice. **Smoke-test each pick live**
  (patchright + the OpenRouter key in `ui/.env`) and **drop any that fail** — don't ship a model that
  reproduces the 401-class dead end. Cerebras render is optional (needs a Cerebras free key; endpoint +
  CORS are already verified).

## Guardrails

- Branch off `main`; push/PR with `env -u GH_TOKEN -u GITHUB_TOKEN`.
- **Do not merge** — the auto-mode classifier blocks agent PR merges; open the PR, report, the human
  merges. (Note: PRs #204/#205 for #195 may still be awaiting merge; 012's PRs are independent of them.)
- Model ids drift — keep the `verified 2026-07-08` dates; confirm Cerebras ids vs its docs at build time.

## Verification (summary — full recipes in plan 012)

`typecheck && lint && test` (130/130) for both. #121: `npm run build` → warning gone + marker check green.
#187: live E2E smoke of a `:free` model renders a surface (drop failures). Screenshots not required.

[plan]: ../plans/012-free-byok-endpoints-bundle-chunking.md
