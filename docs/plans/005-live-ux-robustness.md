---
title: Plan 005 — Live UX + robustness batch
description: Sidebar 3-pane accordion (prompt in sidebar), force one render_ui call (toolChoice), event-log coalescing, and per-provider model suggestions (free-form).
date: 2026-06-30
status: planned
issues: [129]
handoff: handoffs/005-live-ux-robustness.md
---

# Plan 005 — Live UX + robustness batch

**Date:** 2026-06-30 · Part of [#129][issue-129] · follow-on to #142–#145

## Context

The verified live agent (#143/#144) surfaced a cluster on rich prompts: the prompt composer clutters
the center; gpt-4o-mini sometimes prints the A2UI batch as **text instead of calling `render_ui`**
(token flood, nothing renders) or emits a **circular** component ref; and the model field is a bare
free-text input. All failures are now *visible* (#127/#145), not silent.

## Four topical commits (one branch, one squash PR) — **sidebar first per user**

1. **Event-log coalescing (TDD)** — `appendLogEntry(log, entry)` in `ui/src/agent/applyA2UIEvent.ts`
   merges consecutive `TEXT_MESSAGE_CONTENT` into one entry; wired into `useLiveAgent` +
   `useReplayEngine`. Red-first test. (Defense — commit 3 removes the flood at the source.)
2. **Sidebar 3-pane accordion + prompt in sidebar** (presentational) — native
   `<details name="sidebar-accordion">` on Connection / Prompt / Events (exclusive: open one → others
   close). `ui/src/LiveDashboard.tsx` moves the composer `<form>` into a Prompt pane and passes
   `asidePanel = <>{connection}{prompt}</>`, `children={null}` → **center = just the surface**.
   `ui/src/DashboardShell.tsx` adds the `name` + `open={!asidePanel}` on Events. Connection open by
   default. Demo unaffected.
3. **Robustness** — `ui/src/agent/liveAgent.ts`: `streamText` gets `toolChoice: "required"` +
   `stopWhen: stepCountIs(1)` (force one `render_ui` call, no JSON-as-text / multi-call); `SYSTEM_PROMPT`
   gains a no-cycles (acyclic tree) rule.
4. **Model suggestions (free-form)** — `ui/src/config.ts` adds `models?: string[]` per `Endpoint`
   (curated ids); `ui/src/LiveDashboard.tsx` model input gets `list` + a `<datalist>` from
   `selected.models`. Native combobox: suggests per provider, still accepts free-form. (No live
   `/models` fetch — browser-CORS wall + needs the key; static list is KISS.)

## Tests
Only commit 1 is module logic → Red-Green unit test. Commits 2–4 are layout / SDK config / data →
verified **by effect** (render + live E2E). Full suite stays green.

## Verification
- Gates: typecheck + lint + test green.
- Sidebar (patchright, local preview): Live shows 3 panes, exclusive; prompt + Run in the sidebar;
  center is only the surface.
- Robustness (live E2E post-deploy): one `render_ui` call, no prose flood, renders.
- Models: provider switch shows suggestions; free-form still accepted.

## References
- [#129][issue-129] · model-list reference: `claude-azure-workflows-gui` `_FALLBACK_MODELS`
- Handoff: [handoffs/005-live-ux-robustness.md][handoff-005]

[issue-129]: https://github.com/qte77/agenthud-agui-a2ui/issues/129
[handoff-005]: ../handoffs/005-live-ux-robustness.md
