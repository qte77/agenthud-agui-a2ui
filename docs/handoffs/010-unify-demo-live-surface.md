---
date: 2026-07-07
status: done
issues: [128, 156]
plan: plans/010-unify-demo-live-surface.md
title: Handoff 010 — Unify Demo + Live into one surface
description: SHIPPED — #128 closed via PR-a (#198) docs, PR-b (#199) extraction, PR-c (#200) the unify. Continuity verified in a real browser (patchright, 0 console errors). Nothing owed; PR4/#195 (transcript) builds on the lifted log next.
---

# Handoff 010 — Unify Demo + Live into one surface

> Read [plan 010][plan] first — it carries the **verified source map**, the injected-setter contract,
> the continuity semantics, and the Red-first test list, so you don't re-explore.

## Where we are — SHIPPED (#128 closed)

- ✅ **PR-a (docs) — #198.** This handoff + plan 010 + the plans/handoffs index (`docs/README.md`) +
  the 0.x-deps Dependabot learning (`AGENT_LEARNINGS.md`).
- ✅ **PR-b (pure extraction) — #199.** `DemoDashboard` (+ helpers/types) moved to
  `ui/src/DemoDashboard.tsx`; zero behavior change; code-split intact.
- ✅ **PR-c (the unify) — #200.** `eventLog` lifted to `Root`; setter injected into both engine hooks;
  two unmount cleanups (replay timer cancel / live stream abort); `clearSurfaces()` dropped from the
  switch path (continuity); `ModeToggle` restyled. **TDD Red-first**, 112/112 green.
- ✅ **Verified in a real browser** (patchright, port 4173): demo replay → switch to Live → the event
  stream + surface persist → switch back → still there; **0 console errors**. Code-split preserved.

Nothing owed on #128.

## Next session — PR4 / #195 (persistent transcript UI + composer)

The unify is the foundation; PR4 is the last live-agent piece. **Start in plan-mode and produce
plan 011 + handoff 011 first, then TDD.** Read **#195** for scope; the anchors below (plus plan 010's
source map) mean you don't need to re-explore:

- **Lifted state (build on this):** `App.tsx` `Root` owns `const [eventLog, setEventLog] =
  useState<EventLogEntry[]>([])` and passes both as props to each dashboard. The transcript renders
  from this shared log; a composer drives a new turn through the existing engines.
- **Turn memory already exists (plan 009):** `ui/src/agent/conversation.ts` (`ConversationTurn`,
  `summarizeRender`) + `messagesRef` in `useLiveAgent.ts` hold the multi-turn history. PR4 is the *UI*
  for what memory already tracks — don't rebuild the memory.
- **Slots to reuse:** `DashboardShell` exposes `children` (main body, below the surface), `asidePanel`,
  and `extraControls`. The composer likely extends one of these — **no shell inversion** (stays
  rejected per plan 010).
- **Actions:** rendered-Button clicks route via `agent/actionBridge.ts` (`setActionHandler`/
  `dispatchAction`) → `useLiveAgent.sendAction`; the composer adds a *free-text* follow-up alongside.
- **UX decisions to settle in plan-mode (via AskUserQuestion):** transcript layout (stacked per-turn
  surfaces vs chat bubbles); composer placement (`asidePanel` vs a bottom bar); Live-only vs Demo too.
- **Guardrails carry over** (see below): Option A, continuity semantics, strict TDD/lint/typing/sec,
  preserve the code-split.

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
