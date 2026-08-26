---
title: Plan 013 — Prioritized roadmap: model fall-through chain (#210) + shared a2ui/agui library (#211) + backlog waves
description: Cross-repo roadmap. Adopt ldnmxx-hack's first-valid-wins model fall-through into agenthud's browser BYOK path, align both repos' A2UI/AG-UI protocol surface, and spin off a shared @qte77/a2ui-agui library — sequenced against the open backlog by ROI × feasibility. Carries a self-contained source map (both repos) so the next session executes without re-mapping.
date: 2026-07-09
status: open
issues: [211, 185, 165, 156, 132, 120, 119, 102]
handoff: handoffs/013-roadmap-fallback-shared-lib.md
---

# Plan 013 — Roadmap: fall-through chain + shared a2ui/agui library + backlog

## Reconciled 2026-08-26 (audit — verified against both GitHub issue state AND actual code)

- **Wave 0 — DONE:** #121 (vendor chunking) and #209 (paged turn history) both shipped — closed on
  GitHub, and independently confirmed in code this session (`vite.config.ts`'s chunk groups;
  `Transcript.tsx`'s `usePagerIndex` ◀/▶ pager). The "README GIF de-icon (PR #208)" line item never
  had a real PR — no PR #208 exists in this repo; treat that sub-item as never-started, not done.
  #120 (scope vitest/globals types) is still OPEN and unverified against code this pass — not part
  of Wave 0's "done" claim.
- **Wave 1 — #210 DONE, #165 still open (recurring by design), #185 still open (untouched):** #210
  (fall-through chain) shipped — closed on GitHub, confirmed live in `ui/src/agent/fallback.ts` +
  `useLiveAgent.ts`'s `stream()` loop. #165 is deliberately kept open forever (recurring drift
  tracking) — see the `config.ts` date-refresh work below, which IS this issue's recurring task.
  #185 (AI SDK v7 migration) has no evidence of having started.
- **Wave 2 — #211 still fully open.** Confirmed multiple times this session: `worker/src/agent/{prompts,contract}.ts`
  are still hand-copied, comment-acknowledged duplicates of `ui/src/agent/{prompts,contract}.ts`.
  This is the one wave with zero progress since 2026-07-09.
- **Wave 3 — #206 DONE, #132/#119 still open (unverified this pass), #102 likely OBSOLETE:** #206
  (frozen transcript dataModelUpdate) shipped — closed on GitHub, confirmed in `replaySnapshot.ts`'s
  ValueMap→object fold. #102 ("adopt qte77/.github reusable release workflows") is still open on
  GitHub, but this repo's ACTUAL release flow (executed successfully 2026-08-26, v0.5.0) is a
  different, deliberately-chosen design — manual version-bump PR → automatic tag-on-merge →
  one-click `publish-release.yaml` dispatch — documented in `.github/CONTRIBUTING.md`'s "Releasing"
  section, explicitly rejecting changesets/release-please/semantic-release for fighting the `ui/`
  subdir layout. #102's premise (reusable workflows from `qte77/.github`) appears superseded, not
  merely unstarted — flagged to the owner rather than assumed.
- **Deferred — #156 correctly still open,** exactly as this plan already marks it (Mode B remainder;
  its own issue title confirms "Stages 1+2 shipped").

Each wave is TDD-implemented in its **own** future plan-mode session (plan-mode before implementing;
strict TDD Red-first for module logic only; strict lint/typing/sec; no tests for scripts/config/wiring).

## Context

Two forces converge: (1) a live-agent **reliability** gap we hit this session — 401/429 and one silent
empty-render — which ldnmxx-hack already solved worker-side with a first-valid-wins fall-through chain;
(2) ldnmxx was built **from** agenthud ("reuse, don't rebuild: base = agenthud") and keeps a
**dependency-free `shared/` dir**, so the two repos' A2UI/AG-UI protocol surface has diverged and wants
reunifying. This plan clusters all open issues + these two initiatives by ROI × feasibility into waves.

## Prioritized roadmap

| Wave | Items | ROI | Feasibility |
|---|---|---|---|
| **0 — quick wins (teed up)** | ~~#121 vendor chunking~~ ✅ · ~~#209 paged history~~ ✅ · ~~README GIF de-icon~~ (never had a real PR — drop) · #120 vitest types (open) | Low–Med / **Med-High** (#209) | **High** |
| **1 — live-agent reliability (core)** | #185 AI SDK v7 (open, untouched) → ~~**#210 fall-through chain**~~ ✅ (+ #165 model-list refresh — recurring, see config.ts date-refresh) | **High** | Med |
| **2 — shared a2ui/agui library** | **#211** align validators/prompts/registry → extract `@qte77/a2ui-agui` → migrate both repos — **still fully open, zero progress** | Med-High (strategic) | Med-Low |
| **3 — fidelity & hygiene** | ~~#206 dataModelUpdate~~ ✅ · #132 config naming (open) · #119 coverage thresholds (open) · #102 reusable release workflows (open on GitHub, likely superseded by the adopted manual-bump/auto-tag flow — flag to owner) | Low–Med | Med |
| **Deferred** | #156 Mode B speculative pre-render (correctly still open/deferred) | Med | Low (YAGNI) |

Recommended order (2026-08-26): Waves 0 and 1's core items (#121/#209/#210) are done — only #120,
#185, and the recurring #165 remain in those two waves. **Wave 2 (#211) is the one with zero
progress** and is now the natural next architectural item, if picked up. Wave 3 is mostly done
(#206 shipped); #102 needs an owner decision (close as superseded, or actually adopt the reusable
workflows) rather than more agent work.

---

## 🗺️ Source map — Wave 1: #210 fall-through chain

**agenthud (target — browser BYOK streaming):**
- `ui/src/agent/useLiveAgent.ts` — **THE SEAM**: `stream()` wraps a single `await runLiveAgent(settings, messages, onEvent, {signal})` (~:63-77); today one catch → `setError` (:83-86). The provider loop wraps here. Holds `batches[]`, `snap`, `abortRef` (single), `messagesRef` (history), the `a2uiComponentCount` fold-gate (:71).
- `ui/src/agent/liveAgent.ts` — `runLiveAgent(settings, messages, onEvent, opts?)` (:94-125, AI-SDK `streamText` + forced `toolChoice render_ui` + `stepCountIs(1)`); `streamPartToEvent` (:48-74, **pure** SDK-part→AG-UI mapper); `toConnectionError` (:33-40, error classifier — extend for 429/no-tool triggers); `LiveSettings{baseURL,apiKey,model}` (:13-17).
- `ui/src/agent/applyA2UIEvent.ts` — sets `a2uiComponentCount` on `A2UIMessageBatchSchema` success (:92-94) = "valid batch / this provider won" signal; `render` is injected (decoupling seam).
- `ui/src/agent/contract.ts` — `A2UIMessageBatchSchema` (zod, **cycle-checked**) — reuse as the validity gate; don't add a parallel validator.
- `ui/src/config.ts` — `ENDPOINTS` (candidate list; direct-vs-`(via proxy)` base URLs; `verified` date convention).
- `worker/src/router.ts` — CORS proxy allowlist (`github-models`,`google`); browser-direct vs proxy-only routing (no secret).
- `ui/src/LiveDashboard.tsx` / `Composer.tsx` — where `LiveSettings` is chosen + `run()`/`sendMessage()` fire; where to surface "fell through to X".

**ldnmxx-hack (source pattern — `/workspaces/qte77/ldnmxx-hack`):**
- `worker/src/agent/providers.ts` — `renderFree(providers, args)` (:120-129, first-valid-wins loop); `openRouterFreeProvider` (:77-92, inner model-list walk + `console.warn("... fell through", model)`); `buildProviders()` (:132-146, cheapest-first, omit absent tiers); `DEFAULT_OPENROUTER_FREE_MODELS` (:21-28, 6 tool-capable `:free` ids); `Provider{name, tryRender(args): Promise<ModelResult|null>}` (:35-38).
- `worker/src/agent/model.ts` — `extractBatch` (:30-39, pulls `messages[]` from `tool_calls[0].function.arguments`); `callRenderModel` (forced `tool_choice`, `temperature 0.2`, `max_tokens 8000`); `console.warn("model fallback: …")` on HTTP-not-ok / no-tool / invalid.
- `shared/renderTool.ts` — `isSelfContainedBatch` (:22-51, dependency-free; root exists + `Card.child`/`explicitList` refs resolve; **NO cycle check** — narrower than agenthud's zod).
- `worker/src/worker.ts` — `renderBatch` (:47-72, one 20s `AbortController` for the whole chain; keyed-BYOK bypasses free chain; stub on total failure); `freeChain(env)` (:92-106).
- `worker/test/providers.test.ts` — TDD shape: `renderFree (first-valid-wins)` [first-valid / all-fail / empty-chain], `openrouter-free walks the fallback list … misses logged`, `buildProviders cheapest-first`.

**Design calls (settle in the #210 plan-mode session):** buffered-trial vs optimistic-reset · trigger = transport/429/no-tool-support (NOT imperfect batch; BYOK cost) · per-attempt abort vs single `abortRef` · winner's summary in `messagesRef` (no double-append).

## 🗺️ Source map — Wave 2: #211 shared a2ui/agui library

**Portable (already zod-only / DOM-free → shared-lib core):**

| Piece | agenthud | ldnmxx | Reconcile |
|---|---|---|---|
| Contract + validator | `contract.ts` `A2UIMessageBatchSchema` (zod, cycle-check, `dataModelUpdate`/Image) | `shared/renderTool.ts` `isSelfContainedBatch` (dep-free, no cycle, begin/surfaceUpdate-only) | canonical **zod** + thin dep-free validator for worker/edge; converge contract breadth |
| render_ui tool | `prompts.ts` `RENDER_UI_TOOL_DESCRIPTION` + `liveAgent.ts` `renderUiInput` (zod) | `shared/renderTool.ts` `RENDER_UI_TOOL` (shallow JSON-schema) | one tool schema+description |
| System prompt / rules | `prompts.ts` `SYSTEM_PROMPT` (~3.5 KB) | `shared/prompt.ts` `A2UI_RULES` ("condensed from agenthud SYSTEM_PROMPT") | one parameterized prompt builder |
| AG-UI events + mappers | `liveAgent.ts` `streamPartToEvent`; `applyA2UIEvent.ts` (`EventLogEntry`/`AgentEvent`/`summarizeA2UI`/`appendLogEntry`, injected `render`); `conversation.ts` (`ConversationTurn`/`summarizeRender`) | (server maps `tool_calls`→batch via `extractBatch`) | share the event vocab + `applyA2UIEvent` seam |
| Provider registry + combinator | `config.ts` `ENDPOINTS` | `providers.ts` `buildProviders`/`renderFree`/`DEFAULT_*` | one data registry + runtime-agnostic `renderFree` |
| Injection guard | — (none) | `shared/guard.ts` `detectInjection`/`PATTERNS` | **adopt** browser-side too |

**Stays per-repo (env drivers):** agenthud `useLiveAgent.ts` (React + `@a2ui/react` `useA2UIActions`/`processMessages`), `runLiveAgent`/`buildRenderUiTool` (`ai`/`@ai-sdk` — runtime-agnostic but npm-coupled), `config.ts` `PROXY_BASE` (Vite `import.meta.env`); ldnmxx `workersAiProvider` (`ai.run` binding), `Env`/secrets, Arize trace, CORS proxy.
**Packaging decision (open):** npm package `@qte77/a2ui-agui` vs monorepo; zod-core vs dep-free-core. Do this **after** #210.

## 🗺️ Source map — Wave 0: #209 paged turn-history

- `ui/src/Transcript.tsx` — today maps ALL turns → stacked (user row + frozen `A2UIViewer` for `i < lastIndex && snapshot`; live surface below in DashboardShell). Add a **selected-index** + ◀/▶; render selected past turn = frozen `A2UIViewer`, latest = live `A2UISurface`. New turn → snap index to latest.
- `ui/src/LiveDashboard.tsx` — owns `transcript: TranscriptTurn[]` (each `{userText, snapshot:{root,components}|null}`); no `useLiveAgent`/capture change. Ship as a **stacked↔paged toggle** (design call).
- **TDD target:** the selection/which-turn-renders reducer (pure) — Red-first. No tests for the arrow styling.
- README GIF de-icon (PR #208): if "icons" = the ✨🌑 emoji in the recorded content, re-record with a "no emoji" prompt via the patchright+ffmpeg pipeline (`/tmp/record_usage.py`, `?theme=` sweep).

## Verification (per wave)

- Code waves: `cd ui && npm run typecheck && lint && test` green (new-module tests Red-first); `npm run build` (+ code-split marker check for #121); live E2E via patchright (polyfetch venv, `ui/.env` prefill) for #210/#209.
- #210: assert first-valid-wins + fall-through-on-trigger + winner-in-history via mocked `runLiveAgent` (mirror ldnmxx tests); live: force a 429/bad-model and confirm fall-through + EventStream note.
- Sec: BYOK keys stay client-side (never in transcript/log/lib data); worker holds no secret; validate at the `A2UIMessageBatchSchema` seam.

## Constraints / workflow

KISS/DRY/YAGNI/AHA; new branch per topic; conventional commits; squash-merge on green CI (unset
`GH_TOKEN`/`GITHUB_TOKEN`); plan-mode before implementing each wave; the user KISS-challenges scope via
AskUserQuestion.
