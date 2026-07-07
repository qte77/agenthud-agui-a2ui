---
date: 2026-07-07
status: in-progress
issues: [128, 156]
plan: plans/010-unify-demo-live-surface.md
title: Handoff 010 — Unify Demo + Live into one surface
description: Plan approved; 3-PR slicing (docs → extract → unify). PR-a shipped this doc; start at PR-b (pure extraction), then PR-c (TDD Red-first). Plan 010 carries the full contract + test list.
---

# Handoff 010 — Unify Demo + Live into one surface

> Read [plan 010][plan] first — it carries the **verified source map**, the injected-setter contract,
> the continuity semantics, and the Red-first test list, so you don't re-explore.

## Where we are

- ✅ **PR-a (docs) shipped** — this handoff + plan 010 + the plans/handoffs index (`docs/README.md`) +
  the 0.x-deps Dependabot learning (`AGENT_LEARNINGS.md`).
- ▶️ **PR-b (pure extraction) — next.** Move `DemoDashboard` (+ `DemoTreeChoiceView`, `DemoLeafView`,
  `type Mode`, `HistoryEntry`, `activeRecording`) verbatim from `App.tsx:91-305` into
  `ui/src/DemoDashboard.tsx`; `App.tsx` gains one **eager** `import { DemoDashboard }`. Zero behavior
  change, **no new tests** — `App.test.tsx` is the net. Gates green = done.
- ⏳ **PR-c (the unify) — after PR-b.** Lift `eventLog` to `Root`, inject the setter into both engine
  hooks, add the two unmount cleanups, drop `clearSurfaces()` on switch (continuity), restyle
  `ModeToggle`. **TDD Red-first** — see plan §"Red-first tests".

## Guardrails

- **Option A only** — keep the ternary + lazy `LiveDashboard` + one-mounted-at-a-time `actionBridge`.
  Don't invert `DashboardShell`; don't unify the two engines behind one `run()` (AHA).
- **Continuity ≠ no-reset** — a mere *switch* stops clearing; a fresh *run* still wipes log + surface.
- **Strict TDD (Red first — the user checks), non-trivial module tests only**; no tests for the PR-b
  move or the restyle. Strict lint (complexity 12, `no-unnecessary-condition`) + typing
  (`exactOptionalPropertyTypes`) + sec (BYOK keys stay client-side).
- **Preserve the code-split** — no `ai`/`@ai-sdk` in the eager graph (`npm run build` + eyeball chunks).
- The user KISS-challenges scope via AskUserQuestion — reconcile there, not in prose.

## Verification

Gates per PR; PR-c tests RED-first then green. E2E via **polyfetch-scrape + patchright** on the dev
server (docs/testing.md recipe): click a Demo path → switch to Live → stream entries persist, no
surface flash → switch back → still there (no BYOK key needed; Demo is offline). Screenshot light+dark
for the selector restyle. Squash-merge each PR on green CI (unset `GH_TOKEN`/`GITHUB_TOKEN`).

[plan]: ../plans/010-unify-demo-live-surface.md
