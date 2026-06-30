---
date: 2026-06-30
status: shipped
issues: [129]
plan: plans/006-live-demo-followups.md
title: Handoff 006 — Live + demo UX/robustness follow-ups
description: Four shipped topic PRs (#150–#153) closing the live + demo issues found testing the 005 cluster.
---

# Handoff 006 — Live + demo UX/robustness follow-ups

> **Shipped.** Four topic PRs, all squash-merged to `main`. Follow-on to Plan 005 (#146–#149).

## What shipped

| PR | Fix |
|----|-----|
| #150 | Self-host live agent images via `asset:` tokens (`resolveAssets`) + firmer acyclic/define-every-id prompt rules |
| #151 | Bound the events-log scroll (absolute-in-`<details>`) so it stops overflowing past the footer; clearer log summary |
| #152 | Model picker → `<select>` + Custom… mirroring the provider |
| #153 | Self-contained demo replay snapshot (`replaySnapshot.ts`) — fixes `@a2ui` "non-existent component ID" flood; light `recordings/index.ts` cleanup |

## Key learning
`@a2ui` validates **each surfaceUpdate in isolation** (every referenced id must be in that message)
and throws on cycles too — it does **not** hang. #145 surfaces these, so invalid model/recording
trees are now visible. Live emits one complete batch (fine); the demo replays incremental deltas, so
it needs the self-containing snapshot.

## Open follow-up
- **Live E2E (post-deploy):** confirm one `render_ui` call, the image populates via `asset:qte77-avatar`,
  no flood/overflow, picker works — patchright via `../polyfetch-scrape/.venv` + the `ui/.env` BYOK key.

## Notes
- Plan: [plans/006-live-demo-followups.md][plan-006].

[plan-006]: ../plans/006-live-demo-followups.md
