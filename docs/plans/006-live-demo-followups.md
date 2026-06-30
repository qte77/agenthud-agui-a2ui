---
title: Plan 006 — Live + demo UX/robustness follow-ups
description: Self-hosted live images, bounded events-log scroll, model <select>+Custom…, and self-contained demo replay (no @a2ui dangling-ref errors).
date: 2026-06-30
status: shipped
issues: [129]
handoff: handoffs/006-live-demo-followups.md
---

# Plan 006 — Live + demo UX/robustness follow-ups

**Date:** 2026-06-30 · Part of [#129][issue-129] · follow-on to #146–#149 (Plan 005)

## Context

Live-testing the merged 005 cluster surfaced a batch of issues. The unifying insight: **`@a2ui`
itself validates the component tree** — it throws on cycles and on dangling refs, and #145 now
*surfaces* those. So most "breakage" is the model (live) or recording (demo) emitting an invalid
tree, now visible — not a crash, not a hang.

User decisions: live images = **self-hosted token only**; panel growth = **scroll internally**;
model picker = **`<select>` + Custom…** (mirror provider).

## Four topic PRs

1. **Live agent output** (#150) — `ui/src/agent/assets.ts` `resolveAssets()` swaps `asset:<name>`
   image tokens for the bundled URL (runtime counterpart to the demo's build-time replace), applied
   in `useLiveAgent`'s render; the system prompt points Image at `asset:qte77-avatar` and spells out
   the acyclic / define-every-id rules. TDD.
2. **Layout** (#151) — a native `<details>` lays content out at intrinsic height, so the events log
   overflowed past the footer. Position the stream **absolutely** within the bounded `<details>`
   box (fixed `h-10` summary offset) so it scrolls internally. Plus a clearer log summary
   (`"{n} components, {m} types: …"`).
3. **Model picker** (#152) — `<select>` of the provider's models + `Custom…` reveal, mirroring the
   provider picker; no-models providers fall back to a free-text input.
4. **Demo replay** (#153) — `@a2ui` validates each surfaceUpdate in isolation, but the demo replays
   incremental deltas referencing earlier cards. `ui/src/replaySnapshot.ts` re-emits a
   **self-contained** snapshot per step (wired into `useReplayEngine`). Fold-in: light cleanup of
   `recordings/index.ts`. TDD.

## Tests
TDD (Red-first): `resolveAssets` (#150) and `accumulate` (#153) — module logic. Layout (#151) and
picker (#152) verified by render. Full suite green.

## Verification
Gates (`cd ui && npm run typecheck && npm run lint && npm test`) + render/screenshots via the
`../polyfetch-scrape/` chromium patchright (bounded scroll, picker reveal, demo renders with zero ref
errors). Live image populating verifies by live E2E post-deploy.

## References
- [#129][issue-129] · Handoff: [handoffs/006-live-demo-followups.md][handoff-006]

[issue-129]: https://github.com/qte77/agenthud-agui-a2ui/issues/129
[handoff-006]: ../handoffs/006-live-demo-followups.md
