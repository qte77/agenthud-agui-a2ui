---
date: 2026-07-04
status: done
issues: [129, 156, 128]
plan: plans/007-live-interactive-multicol.md
title: Handoff 007 — Interactive live agent + multi-column
description: PR1 (multi-col) shipped; the live-stream quirk is RESOLVED (agent streams in a real browser) so PR2 (onAction MVP) is unblocked and ready to build.
---

# Handoff 007 — Interactive live agent + multi-column

> Read [plan 007][plan] — it carries a **full source map** (files, functions, `@a2ui` v0.8 API, exact
> `onAction` payload) so you **don't need to re-explore**. This handoff = where to start + how to handle it.

## Where we are
- ✅ **PR 1 (multi-column) shipped** — #159 merged, `main` @ `2d7a040`. Agent steers `Row`-of-`Column`s;
  the demo's filtered-results render 3 cards side by side.
- ✅ **#140 resolved** — `@a2ui` v0.9 is a **major redesign** (no `onAction`/provider/registry). **Build
  on v0.8.** (Eval on issue #140.)
- ▶️ **PR 2 (interactive buttons / onAction MVP) — not started, unblocked** (gate resolved — see below).

## The gate — RESOLVED (2026-07-04)
The live agent **does stream and render** in a real browser (verified on the deployed **Live** tab). The
earlier "proxy 200, nothing renders" was a **sandbox-headless limitation, not a hang**: the failures seen
live were a **stale model id → 404** (`anthropic/claude-3.5-sonnet` → "No endpoints found") and an
**OpenRouter 402 no-credits** — config/account issues, not code. #147's forced
`toolChoice:{type:'tool',…}` + `stepCountIs(1)` **stands unchanged** (cleared of suspicion). No agent-code
fix is needed — proceed straight to PR 2 (below).

## Then build PR 2 (KISS MVP, v0.8, TDD) — per plan §"PR 2"
A button click → **one follow-up agent turn** → re-render. On the **current tab structure** (no #128 unify).
1. **`ui/src/agent/conversation.ts`** (new) — Red-first: `actionToTurn(name)`, `appendUserTurn(msgs, text)`.
2. **`AgentActionContext`** (new) — a `useRef` bridge; **wrap `A2UISurfaceProvider`** so `onAction` reads it.
3. **`A2UISurface.tsx`** — pass `onAction={(m) => ref.current?.(m.userAction?.name ?? "")}`. *(action name
   = `message.userAction.name` — confirmed.)*
4. **`useLiveAgent.ts` / `liveAgent.ts`** — add a `messages` history; `streamText({ messages })`; expose
   `sendAction`. Keep `toolChoice` + `stepCountIs(1)` per turn.
5. **`LiveDashboard.tsx`** — register `sendAction` into the bridge.

Gates: `cd ui && npm run typecheck && npm run lint && npm test`. Verify the click→re-render **live**
(manual, post-gate). Squash-merge on green CI.

## Guardrails
- **Mind KISS/DRY/YAGNI** — reuse the `applyA2UIEvent` seam; don't unify Demo/Live (#128 is deferred);
  don't build full multi-turn yet. The user pushes back hard on scope creep.
- **Deferred (don't fold in):** full multi-turn, #128 unify, speculative pre-render, chores
  #132/#121/#120/#119/#102.

## Notes
- Plan + source map: [plans/007-live-interactive-multicol.md][plan].

[plan]: ../plans/007-live-interactive-multicol.md
