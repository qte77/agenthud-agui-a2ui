---
date: 2026-06-30
status: done
issues: [128]
plan: plans/003-live-settings-sidebar.md
title: Handoff 003 — Live connection settings → right sidebar
description: What moved (Live settings to a collapsible sidebar panel), how it was verified, and the link to the broader #128 unification.
---

# Handoff 003 — Live connection settings → right sidebar

> **Shipped 2026-06-30.** Live BYOK connection settings moved from the center to a collapsible
> sidebar panel above the event log, so the center stays the A2UI surface + prompt composer.

## What changed

- `ui/src/DashboardShell.tsx` — optional `asidePanel` slot at the top of the sidebar; the AG-UI
  Events header + stream are now a `<details open>` (collapses to its summary). Shared chrome, so
  Demo's log is collapsible too.
- `ui/src/LiveDashboard.tsx` — the Connection `<details>` (expanded by default) renders in the
  sidebar; the center is just the prompt composer (textarea + Run/Stop + hint).
- `CHANGELOG.md` — `### Changed` bullet.

## Verify

```bash
cd ui && npm run typecheck && npm run lint && npm test   # 64 tests
```

By effect — `npm run build && npm run preview`, then patchright (`../polyfetch-scrape/.venv`): toggle
to **Live** and confirm the sidebar has 2 open `<details>` (Connection on top, then AG-UI Events) and
the key/model inputs are no longer in the center.

## Open / next

- **#128 (Demo/Live unification):** this is one focused slice. The larger restructure — a single
  unified surface with a lighter source selector instead of a hard Demo/Live mode split — remains in
  #128. The shared `DashboardShell` + the new `asidePanel` slot are reusable building blocks for it.

## Pointers

- Plan: [plans/003-live-settings-sidebar.md][plan-003] · Shared chrome: `ui/src/DashboardShell.tsx`

[plan-003]: ../plans/003-live-settings-sidebar.md
