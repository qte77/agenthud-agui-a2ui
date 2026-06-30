---
date: 2026-06-30
status: shipped
issues: [129]
plan: plans/005-live-ux-robustness.md
title: Handoff 005 — Live UX + robustness batch
description: Actionable state for the 4-commit live-tab cluster; not started — sidebar 3-pane accordion ships first.
---

# Handoff 005 — Live UX + robustness batch

> **Planned, not started.** A 4-part live-tab cluster; the **sidebar 3-pane accordion +
> prompt-in-sidebar** ships first as its own PR, then robustness, model suggestions, and log
> coalescing. Pick up at item 1 below.

## Order + status

1. **Sidebar 3-pane accordion + prompt in sidebar** *(doing first)* — `ui/src/DashboardShell.tsx`
   (`asidePanel` slot + `<details name>` accordion) + `ui/src/LiveDashboard.tsx` (move composer into a
   Prompt `<details>`; `children={null}`). Verify by render (patchright on `npm run preview`).
2. **Robustness** — `ui/src/agent/liveAgent.ts`: `toolChoice:"required"` + `stepCountIs(1)` + a
   no-cycles `SYSTEM_PROMPT` rule. Verify by live E2E.
3. **Model suggestions (free-form)** — `ui/src/config.ts` `models` per endpoint + a `<datalist>` on the
   model input in `ui/src/LiveDashboard.tsx`.
4. **Event-log coalescing (TDD)** — `appendLogEntry` in `ui/src/agent/applyA2UIEvent.ts`, wired into
   `useLiveAgent` + `useReplayEngine`; Red-first test.

## Verify

```bash
cd ui && npm run typecheck && npm run lint && npm test
npm run build && npm run preview     # then patchright on http://localhost:4173/
```

Live E2E (post-deploy): patchright via `../polyfetch-scrape/.venv` + the `ui/.env` BYOK key (GitHub
Models via proxy) — one `render_ui` call, components render, no token flood.

## Notes
- `toolChoice:"required"` removes the text-token flood at the source; coalescing (4) is cheap defense.
- Model lists are **static/curated** (no live `/models` fetch — browser CORS + key). Drift cost accepted.
- Plan: [plans/005-live-ux-robustness.md][plan-005].

[plan-005]: ../plans/005-live-ux-robustness.md
