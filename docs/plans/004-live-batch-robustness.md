---
title: Plan 004 — Live batch robustness (surface contract violations + tighten prompt)
description: Make live A2UI failures visible (surface contract rejections in the event log) and reduce them (one complete render_ui call, no empty arrays).
date: 2026-06-30
status: done
issues: [129]
handoff: handoffs/004-live-batch-robustness.md
---

# Plan 004 — Live batch robustness

**Date:** 2026-06-30 · Part of [#129][issue-129]

## Context

After the catalog-shapes fix (#144, ADR-0003), gpt-4o-mini emits correct component shapes — but on
**complex** prompts it's inconsistent: sometimes it splits the UI across **multiple/partial
`render_ui` calls** or leaves a required array (`children.explicitList` / `tabItems` /
`components`) **empty**, which `@a2ui` rejects → blank surface. Worse, when a batch fails **our**
contract (`A2UIMessageBatchSchema`), `applyA2UIEvent` only `console.warn`s and skips — a **silent**
blank with nothing in the event log (unlike `@a2ui` render errors, surfaced since #127). Two fixes,
chosen by the user ("tighten prompt + surface errors").

## Change

### (b) `ui/src/agent/applyA2UIEvent.ts` — surface contract violations (TDD)
In the `!safeParse` branch, set `entry.text` to a concise violation message (first issue path +
message) so a rejected batch shows in the event log, mirroring the render-error surfacing.
**Red-first test** in `ui/tests/applyA2UIEvent.test.ts`: a bogus batch's `entry.text` contains
"A2UI contract violation" (Red: was `undefined`).

### (a) `ui/src/agent/liveAgent.ts` — tighten `SYSTEM_PROMPT` (prompt config)
- "Make exactly ONE `render_ui` call with the COMPLETE interface (one beginRendering + one
  surfaceUpdate listing every component)."
- "Define every id you reference in the same call, and never leave a `children.explicitList`,
  `tabItems`, or `components` list empty."

### `CHANGELOG.md` — `### Fixed` bullet.

## Tests
- (b) is module logic → **Red-Green** unit test (the only new test).
- (a) is prompt config → verified **by effect** (live E2E), not a unit test. Full suite green (65).

## Verification
- Gates: typecheck + lint clean, 65 tests.
- By effect: after deploy, live E2E (patchright via `../polyfetch-scrape/.venv`, `.env` BYOK key) with
  a rich prompt — fewer multi-call/empty-array failures, and any remaining rejection now shows a
  "contract violation"/"render error" line in the AG-UI log instead of a silent blank. (gpt-4o-mini
  variance persists; a stronger model is more reliable for rich UIs.)

## References
- [#129][issue-129] · [ADR-0003][adr-0003] (catalog instruction) · render-error surfacing #127
- Handoff: [handoffs/004-live-batch-robustness.md][handoff-004]

[issue-129]: https://github.com/qte77/agenthud-agui-a2ui/issues/129
[adr-0003]: ../decisions/0003-live-catalog-instruction.md
[handoff-004]: ../handoffs/004-live-batch-robustness.md
