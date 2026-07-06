---
date: 2026-07-05
status: done
issues: [156]
plan: plans/009-live-turn-memory.md
title: Handoff 009 — Live turn memory (land + verify)
description: SHIPPED & VERIFIED — turn memory merged in #182, released in v0.4.0, live-E2E continuity confirmed. Nothing owed. Plan 009 carries the source map (retained for reference/regression).
---

# Handoff 009 — Live turn memory

> Read [plan 009][plan] first — it has the **full source map** (files, functions, lint gotchas,
> test-mock gotchas) so you don't re-explore.

## Where we are
- ✅ **SHIPPED**: merged in **#182**, released in **v0.4.0** (`main` @ or after `3013dd6`). 106/106
  tests, Red-first, lint/typecheck clean. The "land it" steps below are DONE.
- ✅ Design user-ratified: compact assistant render-summary per turn (see plan §Decision).
- ✅ **Live-E2E continuity VERIFIED (2026-07-06)**: turn 1 "The Enchanted Forest" → click *Venture
  Deep* → turn 2 "Deep Within the Enchanted Forest…" (continuation, not restart), 0 console errors.
  Nothing left owed on this plan.

## How it was verified (for reference / regression)
Recipe: docs/testing.md "Live BYOK E2E" (patchright + `ui/.env`, CORS-friendly provider). Capture the
`.a2ui-surface` text on turn 1, click a rendered `.qte-button`, wait for the 2nd `RUN_FINISHED`
(probe the log via `textContent`, 90s), capture turn 2, and assert story-word overlap (turn 2
continues turn 1). Rebuild the script from that recipe if re-running.

## Issue hygiene (still open)
- Comment on **#156**: Stage 2's memory half shipped in #182 (assistant summaries); remaining =
  transcript UI + composer (plan 008 "PR4").

## Guardrails
- Strict TDD (Red first — the user checks), strict lint/typing (complexity gate 12: that's why
  `collectComponentContent` exists), KISS/YAGNI (no summary-trimming until context limits bite).
- The user KISS-challenges scope via AskUserQuestion — reconcile there, not in prose.

## Open threads beyond this plan
- **Dependabot #160/#162**: recreated but still carry blocked majors — fix is `ignore:` entries in
  `.github/dependabot.yml` (`@cloudflare/workers-types`, `ai`, `@ai-sdk/openai` majors). ~10 lines.
- **plan 008 "PR4"** transcript UI (reassess); **qte77/qte77#148** (brand tokens, user review);
  `components/` split deferred to PR4 (noted on #132).

[plan]: ../plans/009-live-turn-memory.md
