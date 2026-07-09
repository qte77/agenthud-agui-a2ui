---
date: 2026-07-09
status: planned
issues: [210, 211, 209, 206, 185, 165, 156, 132, 121, 120, 119, 102]
plan: plans/013-roadmap-fallback-shared-lib.md
title: Handoff 013 — Roadmap: fall-through chain + shared a2ui/agui library + backlog waves
description: Prioritized cross-repo roadmap. #210 = adopt ldnmxx's first-valid-wins model fall-through into agenthud's browser BYOK; #211 = extract a shared @qte77/a2ui-agui library after aligning both repos' protocol surface. Plan 013 carries the full two-repo source map — execute wave-by-wave, plan-mode + TDD each.
---

# Handoff 013 — Roadmap: fall-through chain + shared a2ui/agui library + backlog

> Read [plan 013][plan] first — it carries the **two-repo source map** (agenthud + ldnmxx-hack, with
> file:line refs), the ROI×feasibility wave table, and the reconcile-the-validators call. You should not
> need to re-map either repo.

## Where we are

Roadmap set; nothing built yet. All open issues + two new initiatives clustered into waves by
ROI × feasibility. New issues filed this session: **#210** (fall-through chain), **#211** (shared
a2ui/agui library). Source analysis lives in `/workspaces/temp/docs/a2ui-model-fallthrough-agenthud-port.md`
(the porting brief) + plan 013's source maps.

## Do this — wave by wave (each its own plan-mode + TDD session)

1. **Wave 0 — quick wins:** #121 vendor chunking (plan 012 ready — verify-by-build, no tests) · **#209
   paged turn-history** (◀/▶ toggle; TDD the selection reducer) · README GIF **de-icon** (re-record
   without emoji, PR #208 supersedes) · #120 vitest type-scoping.
2. **Wave 1 — reliability (biggest ROI):** #185 AI SDK v7 first/with → **#210 fall-through chain** wrap
   around `useLiveAgent.stream()`'s `runLiveAgent` call. Fold #165 model-list refresh.
3. **Wave 2 — #211 shared library:** align validators/prompts/registry, extract `@qte77/a2ui-agui`,
   migrate both repos. **After** #210 (so the surface is proven).
4. **Wave 3 — hygiene:** #206 · #132 · #119 · #102. **Deferred:** #156 Mode B.

## The hard calls (settle in each wave's plan-mode)

- **#210:** *buffered-trial vs optimistic-reset* (central) · trigger = **transport/429/no-tool-support,
  NOT imperfect batch** (BYOK spends the user's tokens) · per-attempt abort vs the single `abortRef` ·
  keep the **winner's** summary in `messagesRef` (no double-append). Reuse `A2UIMessageBatchSchema` +
  the `a2uiComponentCount` gate — don't add a parallel validator.
- **#211:** packaging (npm vs monorepo) · zod-core vs dep-free-core · reconcile agenthud's cycle-checked,
  broader zod schema with ldnmxx's dep-free `isSelfContainedBatch` (no cycle, begin/surfaceUpdate-only).

## Discipline (standing working agreement)

- **Plan-mode before implementing** each wave; **strict TDD Red-first** for non-trivial **module** logic
  (fall-through reducer, pager selection, validator) — the user checks Red. **No tests** for
  config/data (`config.ts`, `vite.config.ts`), scripts, styling, or thin wiring.
- **Strict lint** (complexity ≤12, `no-unnecessary-condition`) + typing (`exactOptionalPropertyTypes`)
  + **sec** (BYOK keys stay client-side — never in transcript/log/shared-lib data; worker holds no
  secret; validate at the schema seam).
- New branch per topic; conventional commits; squash-merge on green CI (unset `GH_TOKEN`/`GITHUB_TOKEN`).
  The user KISS-challenges scope via AskUserQuestion — reconcile there.

## Verification

Per wave: `cd ui && npm run typecheck && lint && test` (new-module tests Red-first); `npm run build`
(+ the code-split marker check for #121/#210); live E2E via patchright (polyfetch venv + `ui/.env`
prefill). #210 live-check: force a 429/bad-model → confirm fall-through + an EventStream note.

[plan]: ../plans/013-roadmap-fallback-shared-lib.md
