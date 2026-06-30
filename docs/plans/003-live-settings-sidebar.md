---
title: Plan 003 — Live connection settings → right sidebar
description: Move the Live BYOK connection settings out of the center into a collapsible sidebar panel so the center stays the A2UI surface; both sidebar sections collapsible.
date: 2026-06-30
status: done
issues: [128]
handoff: handoffs/003-live-settings-sidebar.md
---

# Plan 003 — Live connection settings → right sidebar

**Date:** 2026-06-30 · A focused slice of [#128][issue-128] (Demo/Live unification)

## Context

The center column should be **content** (the A2UI surface the agent composes). The Live BYOK setup
chrome (endpoint / key / model) sat in the center under the surface. Move the **connection settings
only** into the right `<aside>` (above the event stream); keep the **prompt + Run/Stop** as a
center composer. Both sidebar sections become collapsible, expanded by default.

## Change

- `ui/src/DashboardShell.tsx` — new optional `asidePanel?: ReactNode` slot at the top of the
  `<aside>`; the AG-UI Events header + `EventStream` become a `<details open>` that fills the panel
  when open (`flex-1 min-h-0 flex flex-col`) and shrinks to its summary when closed
  (`[&:not([open])]:flex-none`). Shared, so Demo's log is collapsible too.
- `ui/src/LiveDashboard.tsx` — the Connection `<details>` (now `open`, sidebar padding) is passed as
  `asidePanel`; the center `children` is just the composer `<form>` (prompt + Run/Stop + error +
  hint). Settings inputs leave the `<form>` (only Run submits); behavior unchanged.
- `CHANGELOG.md` — `### Changed` UX bullet.

## TDD

**None** — presentational/layout relocation (no new logic); per the testing rules ("don't test
styling/layout") verify by effect. Full suite stays green (64 tests). `App.test.tsx` only exercises
Demo mode, so it's unaffected.

## Verification

- Gates: typecheck + lint + 64 tests green; production build OK.
- By effect (patchright via `../polyfetch-scrape/.venv`, local preview): toggled to **Live** →
  sidebar shows **2 `<details>`, both open** (Connection with endpoint/key/model on top, then AG-UI
  Events); center has the prompt + Run; the key/model inputs are **not** in the center.

## References

- [#128][issue-128] (full Demo/Live unification) · `ui/src/DashboardShell.tsx`
- Handoff: [handoffs/003-live-settings-sidebar.md][handoff-003]

[issue-128]: https://github.com/qte77/agenthud-agui-a2ui/issues/128
[handoff-003]: ../handoffs/003-live-settings-sidebar.md
