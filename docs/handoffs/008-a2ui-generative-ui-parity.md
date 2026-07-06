---
date: 2026-07-06
status: shipped
issues: [156]
plan: plans/008-a2ui-generative-ui-parity.md
title: Handoff 008 — A2UI generative-UI parity (qte77-branded)
description: PR1–PR3 + demo-controls SHIPPED in v0.4.0; nothing owed. PR4 (persistent transcript UI + composer) deferred → tracked in #195. Plan 008 carries the theming source map + decisions.
---

# Handoff 008 — A2UI generative-UI parity (qte77-branded)

> Read [plan 008][plan] first — it carries the **theming source map** (files, the `@a2ui`
> `Theme`-prop seam, `qte-*` class hooks) and the **decisions**, so you don't re-explore.

## Where we are

- ✅ **PR1 (surface theming) shipped** — #168 (v0.4.0). Themed A2UI surface via the exported
  `A2UIProvider theme` prop + app-owned `qte-*` classes; dark/light from the EyeRest `@theme` tokens.
- ✅ **PR2 / #156 Stage 1 (onAction MVP) shipped** — #170. A rendered Button drives one follow-up turn.
- ✅ **PR3 (motion / alive states) shipped** — #172. CSS-only entrance + Live pending skeleton
  (streaming-log cursor cut per KISS).
- ✅ **Demo-controls addendum shipped** — #173 (+ #194 fix). Buttons drive the decision tree;
  CheckBoxes/Slider interactive via `path` bindings.
- ▶️ **PR4 (persistent transcript UI + composer) — DEFERRED**, tracked in **#195** (below).

Nothing owed on PR1–PR3.

## PR4 — deferred (decision recorded)

The persistent transcript UI + "continue the conversation" composer is the one unbuilt piece. Its
**memory half** already shipped (plan/handoff 009, #182); the UI half stays **YAGNI** until demand is
proven, and **overlaps #128** (unify Demo + Live) — sequence #128's IA rebuild **before/with** the
transcript so we don't build against a layout about to change. Anchor: **#195**.

## Open threads beyond this plan

- **qte77/qte77#148** — promote `--radius-card` / `--shadow-card` to the EyeRest `DESIGN.md` upstream
  (brand-repo issue; the `qte-*` component CSS stays app-local). Cited at `ui/src/index.css:31`.
- **#140 CLOSED** — `@a2ui` v0.9 is a major redesign (no `onAction`/provider/registry); staying on v0.8.
  Theming couples only to the exported `Theme` type (`qteA2uiTheme: Theme` → a shape change is a
  compile error; the real-renderer test guards runtime). No action unless a breaking
  `@a2ui/react` major lands (Dependabot has no special guard for it).

## Guardrails

- KISS/DRY/YAGNI — the user KISS-challenges scope via AskUserQuestion; reconcile there, not in prose.
- Styling is verified by render (screenshots), not unit tests; TDD applies to module logic only.

[plan]: ../plans/008-a2ui-generative-ui-parity.md
