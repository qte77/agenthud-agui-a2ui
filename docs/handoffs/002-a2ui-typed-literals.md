---
date: 2026-06-30
status: done
issues: [129]
plan: plans/002-a2ui-typed-literals.md
title: Handoff 002 — A2UI typed-literal bindings
description: What shipped for the A2UI value-binding fix, how it was verified, and what remains open on #129.
---

# Handoff 002 — A2UI typed-literal bindings

> **Shipped 2026-06-30.** Interactive A2UI components (Slider, CheckBox, Tabs) used a bare `literal`
> binding that the `@a2ui` schema rejects on typed fields, so they threw mid-render and never painted
> — in both Demo and Live. Fixed to typed literals; guarded by a real-`@a2ui` test.

## What shipped

- `ui/src/recordings/overview.json` — `literal` → `literalString`/`literalNumber`/`literalBoolean`
  (by value type; 56 / 2 / 9).
- `ui/src/agent/liveAgent.ts` — system prompt teaches typed bound values.
- `ui/tests/A2UISurface.test.tsx` — Red-first contract test: renders every value-bound leaf from the
  recording through the real `processMessages` (Red-verified via `git stash`).
- `docs/protocols.md` — "What this project implements (v0.8)" subsection (typed literals + the
  resolver-vs-schema gotcha + v0.8-vs-v0.9).

## Verify

```bash
cd ui && npm run typecheck && npm run lint && npm test   # 64 tests
```

By effect — after deploy, headless-render the demo and confirm the **AG-UI events** panel has zero
`A2UI render error`s and Slider/CheckBox/Tabs paint (patchright via `../polyfetch-scrape/.venv`).

## Open / next

- **#129 (still open):** the real-model **E2E** verification — a live GitHub Models run that actually
  renders components — needs a real `models:read` token (not available in this environment). The
  contract-hardening + binding halves are done; the live token run is all that remains.
- **#128 (UX, separate):** unify Demo/Live into one surface — center = the A2UI surface (content),
  move the Live connection settings (endpoint/key/model) to the right panel, keep the prompt a
  prominent composer. Shared-`DashboardShell` restructure; belongs in the unification.

## Pointers

- Plan: [plans/002-a2ui-typed-literals.md][plan-002]
- Protocol detail: [protocols.md][protocols] (A2UI v0.8) · Renderer contract: `ui/src/agent/contract.ts`

[plan-002]: ../plans/002-a2ui-typed-literals.md
[protocols]: ../protocols.md
