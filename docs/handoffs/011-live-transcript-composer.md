---
date: 2026-07-08
status: done
issues: [195, 156]
plan: plans/011-live-transcript-composer.md
title: Handoff 011 — Live persistent transcript UI + composer
description: SHIPPED — PR4 / #195 delivered via #205 (code, TDD Red-first, 130/130 green) + #204 (docs). Live-verified. Retains each Live turn's surface in a chat transcript (prior turns frozen via A2UIViewer, latest stays live) + a free-text composer, on the lifted eventLog (#128) + turn memory (#182).
---

# Handoff 011 — Live persistent transcript UI + composer

> Read [plan 011][plan] first — it carries the **verified source map**, the capture/fold decision, the
> `beforeSurface` layout call, the injected-setter contract, and the Red-first test list.

## Where we are — SHIPPED (#195)

- ✅ **Delivered** via PR **#205** (code, TDD Red-first, 130/130 green, code-split preserved) + PR
  **#204** (this plan/handoff). **Live-verified**: 3-turn BYOK E2E (Run → composer follow-up →
  live-button click) = 2 frozen prior turns, newest row `Clicked "chooseRun"`, **0 console errors**.
  #195 closed; #156 rescoped to the deferred speculative pre-render (Mode B). Nothing owed.
- Foundation it built on: `eventLog` lifted to `Root` (#128 / plan 010), turn memory in place (#182 /
  plan 009). `@a2ui/react@0.10.1` ships `A2UIViewer` (static per-instance renderer) — feasibility confirmed.
- UX **decided** (via AskUserQuestion): interleaved chat transcript (user row + surface per turn; prior
  turns frozen, latest stays the live interactive surface); composer = bottom bar in main; **Live-only**.
- Review KISS-cuts already folded into plan 011: **no per-turn error field** (top-level `error` banner
  stays the single error surface); `TurnSnapshot.components` uses a **type-only** `ComponentInstance`
  import (no structural dupe); keep the 4-function `transcript.ts` API; auto-scroll ships (core chat UX).

## The one non-obvious thing

The raw per-turn A2UI batch is **discarded today** — `stream()` keeps `batches` only for
`batches.at(-1)` → `summarizeRender`. PR4's real work is *capturing* it into a frozen snapshot. Do the
fold **inside the event callback** via `accumulate(snap, resolveAssets(event.a2uiMessages))` gated on
`entry.a2uiComponentCount !== undefined` (validated) — **not** by post-processing the `batches` array
(that's pushed pre-validation and pre-`resolveAssets`; frozen turns would get broken images / invalid
trees). Reuse `replaySnapshot.ts` `emptySnapshot`/`accumulate` — don't rewrite the fold.

## Build order (TDD Red-first — the user checks Red)

1. `transcript.test.ts` → `agent/transcript.ts` (pure; ideal TDD target).
2. `useLiveAgent.test.ts` additions → `useLiveAgent.ts` (new `setTranscript` setter, `userText` param,
   `followUp` extraction, `sendMessage`). Harness gains the transcript state pair.
3. `Composer.test.tsx` → `Composer.tsx`; `Transcript.test.tsx` (stub `A2UIViewer`) → `Transcript.tsx`.
4. Wiring (no new tests): `DashboardShell` `beforeSurface` slot, `LiveDashboard` state + slots; update
   `LiveDashboard.test.tsx` + `sourceSwitch.test.tsx` mocks. Then follow-scroll + light/dark polish.

## Guardrails

- **Option A stays** — ternary + lazy `LiveDashboard` + one-mounted-at-a-time `actionBridge`. Don't
  invert `DashboardShell` (one small `beforeSurface` slot only); don't unify the two engines (AHA).
- **Continuity semantics** — a mere source switch keeps eventLog + surface (#128); the transcript is
  LiveDashboard-local so it (like `messagesRef`) resets on switch; a fresh `run()` wipes all three.
- **Preserve the code-split** — no `ai`/`@ai-sdk` in the eager graph (`npm run build` + eyeball chunks).
  `A2UIViewer` is fine (already eager via `A2UISurface`; `Transcript.tsx` is in the Live chunk).
- **Display-only transcript** — `messagesRef` remains the sole LLM-history source of truth; never feed
  the transcript back to the model.
- Strict TDD (Red first), non-trivial module tests only; strict lint (complexity ≤12,
  `no-unnecessary-condition`) + typing (`exactOptionalPropertyTypes`) + sec (BYOK keys stay client-side;
  transcript entries carry no settings). The user KISS-challenges scope via AskUserQuestion.

## Verification

Gates per PR; new modules Red-first then green. `npm run build` + confirm the lazy `LiveDashboard-*`
chunk still carries the AI SDK and the eager `index-*` does not. E2E via polyfetch-scrape + patchright
on the dev server (real BYOK via `ui/.env` prefill — works headless): Run default prompt → composer
follow-up + Enter → frozen snapshot + both user rows above the live surface, composer disabled while
streaming → click a live Button → third `Clicked "…"` row + second frozen snapshot → click a frozen-turn
button → no-op → Demo↔Live switch: transcript gone (expected), stream + surface persist. Light + dark
screenshots. Squash-merge each PR on green CI (unset `GH_TOKEN`/`GITHUB_TOKEN`).

[plan]: ../plans/011-live-transcript-composer.md
