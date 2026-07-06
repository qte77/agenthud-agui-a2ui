---
title: Plan 008 — A2UI generative-UI parity (qte77-branded)
description: Make the A2UI surface look/feel like a polished generative-UI showcase (CopilotKit A2UI). PR1–PR3 + demo-controls shipped (v0.4.0); PR4 (transcript UI) deferred → #195. Root cause was an unstyled surface.
date: 2026-07-05
status: shipped
issues: [156]
handoff: handoffs/008-a2ui-generative-ui-parity.md
---

# Plan 008 — A2UI generative-UI parity (qte77-branded)

## Context

The FE felt "static and boring." Research (CopilotKit's A2UI showcase, a2ui.org, `@a2ui/react`
internals) found the root cause: the A2UI surface rendered **unstyled** — the library's default theme
references CSS vars (`--n-*`, `--p-*`, `--font-family-flex`) this app never defines, so Card/Button/
Tabs/Text had no fill/border/elevation and fell back to Helvetica. The reference "alive" feel is 100%
plain CSS (no animation library): a themed surface + entrance/skeleton/streaming motion + a chat
transcript + interactive buttons.

**Scope (KISS, user-chosen):** fix the root cause first — theme the surface (PR1) — then reassess.
PR2–4 are a deferred roadmap, each a separate decision.

## PR1 — Surface theming ✅ (this change)

Robust path: the exported `A2UIProvider` `theme` prop + our own `qte-*` class hooks (couples only to
the exported `Theme` shape, not to library-internal CSS-var names).

- `ui/src/theme/a2uiTheme.ts` — `qteA2uiTheme` spreads `defaultTheme`, overrides Card/Button/Tabs/Text
  (+ Image sizing by usage hint) with `qte-*` classes.
- `ui/src/A2UISurface.tsx` — `<A2UIProvider theme={qteA2uiTheme}>`.
- `ui/src/index.css` — scoped `.a2ui-surface .qte-*` rules using the existing EyeRest `@theme` tokens
  (dark/light for free) + local `--radius-card`/`--shadow-card` (see Brand SoT below).
- `ui/tests/App.test.tsx` — mock gains a minimal `defaultTheme` stub (the module is fully mocked there).

Verified by render (styling isn't TDD-shaped): gates green (typecheck/lint/test 81, build) + polyfetch
-scrape patchright screenshots of Demo in light **and** dark — card fill/border/12px radius/shadow,
Inter type ramp, avatar sized to 44px (was unconstrained).

## Deferred roadmap — reassess after PR1 (NOT committed)

- **PR2 — interactive onAction MVP** (#156 Stage 1): ✅ **shipped** — buttons drive one follow-up turn
  (`agent/conversation.ts` TDD Red-first; `agent/actionBridge.ts` module registry — chosen over a
  React context since one provider serves even a future multi-surface transcript, the payload carries
  `userAction.surfaceId`; `runLiveAgent` is `messages`-based). Spec: [plan 007](007-live-interactive-multicol.md) §PR 2.
- **PR3 — motion/alive states**: ✅ **shipped** — CSS-only entrance animation (`qte-enter` on the
  chunky wrappers; stable-id keying animates only new mounts) + Live pending-render skeleton
  (`SurfaceSkeleton` via `A2UIRenderer`'s `fallback` — shows only while the surface is empty and a
  run streams). The streaming-log cursor was **cut** per KISS review (redundant with the growing
  event log). Reduced-motion gated by the existing global rule.
- **PR4 — multi-turn transcript** (#156 Stage 2): per-turn surfaces + a chat transcript layout + a
  "continue the conversation" composer. Biggest/riskiest (IA rebuild, overlaps #128) — **deferred
  (YAGNI), tracked in #195**; sequence #128's unify before/with it. Memory half already shipped
  (plan/handoff 009, #182).
- **Addendum (user-reported, shipped as follow-up): Demo controls wired** — rendered Buttons drive the
  decision tree via `TreeChoice.action` + the PR2 `actionBridge` (Demo's pre-baked analog of #156's
  interaction story); CheckBoxes/Slider became locally interactive via `path` bindings +
  `dataModelUpdate` seeding (contract union extended) + a real Slider range.

## Decisions

- **KISS**: PR1 first, then reassess (rejected committing to full parity up front).
- **Robust theming** via `theme` prop + `qte-*` hooks (rejected filling library `--n-*/--p-*` vars →
  couples to private classmaps; rejected feeding `beginRendering.styles` → partial). Risk (bounded):
  couples to the exported `Theme` shape — but `qteA2uiTheme: Theme` is typed, so a shape change is a
  compile error, and the real-renderer test guards runtime. **#140 evaluated & closed** — `@a2ui` v0.9
  is a major redesign (no `onAction`/provider/registry); staying on v0.8. Re-check only if a breaking
  `@a2ui/react` major lands.
- **Brand SoT**: `--radius-card`/`--shadow-card` are new brand-level primitives (EyeRest is flat today).
  They should be promoted to the qte77 EyeRest `DESIGN.md` upstream; the `qte-*` component CSS stays
  app-local. Upstream tracked in **qte77/qte77#148** (brand repo; also cited at `ui/src/index.css:31`).

## Constraints honored
Self-host / no-CDN; no animation dependency; qte77 `@theme` tokens reused; `prefers-reduced-motion`
already enforced; styling verified by render, not unit tests.
