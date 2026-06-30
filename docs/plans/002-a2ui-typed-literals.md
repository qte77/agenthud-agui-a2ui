---
title: Plan 002 — A2UI typed-literal bindings
description: Fix the A2UI value-binding bug (bare `literal` → typed literals) so interactive components render, with a real-@a2ui contract test and v0.8 protocol docs.
date: 2026-06-30
status: done
issues: [129]
handoff: handoffs/002-a2ui-typed-literals.md
---

# Plan 002 — A2UI typed-literal bindings

**Date:** 2026-06-30 · **Part of** [#129][issue-129] (live-render hardening)

## Context

A patchright screenshot of the deployed demo surfaced real `A2UI render error`s
(`unrecognized_keys: ["literal"]` / "Must define exactly one property") on `Slider.value`.
Root cause (verified against `@a2ui/react` 0.10.1): the renderer's **message schema requires typed
literal keys** — `literalString` / `literalNumber` / `literalBoolean` (or `path`) — for bound values.
The runtime resolver is lenient (falls back to `String/Number/Boolean(value.literal)`), so a bare
`{ literal }` rendered for `Text.text`, but the stricter **schema rejects it** on typed bindings
(`Slider.value`, `CheckBox.value`), so those components threw mid-render and never painted — the root
cause of both the broken interactive demo **and** the blank Live path (a model told to emit `literal`
produces schema-invalid A2UI for any number/boolean value).

Our other v0.8 shapes (`beginRendering`/`surfaceUpdate`, `Card.child`, `children.explicitList`,
`usageHint`) are correct — confirmed by the working Text card.

## Fix

1. **Recordings** `ui/src/recordings/overview.json` — rename every `literal` → typed key by JS value
   type (56 `literalString`, 2 `literalNumber`, 9 `literalBoolean`).
2. **Live system prompt** `ui/src/agent/liveAgent.ts` — teach typed bound values (text →
   `literalString`, `Slider.value` → `literalNumber`, `CheckBox.value` → `literalBoolean`).
3. **Docs** `docs/protocols.md` — a "What this project implements (v0.8)" subsection: typed literals,
   the resolver-vs-schema gotcha, and the v0.8-vs-v0.9 distinction.
4. **CHANGELOG** — `### Fixed` bullet.

## TDD

Extend `ui/tests/A2UISurface.test.tsx` (drives the **real** `@a2ui/react` `processMessages`): render
every value-bound **leaf** component from the recording in a self-contained batch and assert no throw.
- **RED** (verified by `git stash` of the recording): bare `literal` on `Slider.value` → `unrecognized_key`.
- **GREEN** after the typed-literal fix. Self-contained batches avoid the recording's cross-segment
  component references (raw `processMessages` doesn't accumulate the way the replay engine does).

## Not done (KISS / YAGNI / DRY)

- No `contract.ts` binding validation (would duplicate `@a2ui`'s per-field schema).
- No data-model / `path` / `template` support (static literal-only UIs for now).
- No v0.9 migration (v0.8 is correct for what we ship).

## Verification

- TDD Red→Green; gates green (typecheck + lint + 64 tests).
- By effect: re-run the patchright screenshot of the deployed demo — the AG-UI events panel should show
  **zero** `A2UI render error`s and Slider/CheckBox/Tabs paint.

## References

- [protocols.md][protocols] (A2UI v0.8 subsection) · `ui/src/agent/contract.ts`
- Handoff: [handoffs/002-a2ui-typed-literals.md][handoff-002]

[issue-129]: https://github.com/qte77/agenthud-agui-a2ui/issues/129
[protocols]: ../protocols.md
[handoff-002]: ../handoffs/002-a2ui-typed-literals.md
