---
title: Plan 009 — Live turn memory (assistant render summaries)
description: Turn N sees turn N-1's render via a compact assistant summary — fixes "multi-turn is just multiple single-turns". SHIPPED in #182 / v0.4.0; carries a full source map.
date: 2026-07-05
status: done
issues: [156]
handoff: ../handoffs/009-live-turn-memory.md
---

# Plan 009 — Live turn memory

## Problem (user-reported)

"Multi-turn in live is in fact just multiple single-turns" — the history held **user turns only**;
the model never saw what IT rendered, so continuity (e.g. the fairytale story) was guesswork.

## Decision (user-ratified via options)

**Compact render summary**: after each successful turn, append
`{ role: "assistant", content: "You rendered: <Text literals> Buttons offered: <action names>." }`
(capped at 1200 chars) to the history. Rejected: full A2UI JSON echo (token cost on the visitor's
BYOK key) and protocol tool-call history (plumbing; same cost) — revisit if summaries prove lossy.

## 🗺️ Source map (don't re-explore)

- **`ui/src/agent/conversation.ts`** — `ConversationTurn { role: "user"|"assistant"; content }`
  (replaced `UserTurn` everywhere); `actionToTurn(name)`; `appendUserTurn` / `appendAssistantTurn`
  (immutable); **`summarizeRender(messages)`** (walks `surfaceUpdate.components`, collects
  `Text.text.literalString` + `Button.action.name` via `collectComponentContent` helper — extracted
  for the complexity-12 lint gate; cap `SUMMARY_MAX_CHARS = 1200`).
- **`ui/src/agent/useLiveAgent.ts`** — `stream()` collects `batches: unknown[][]` from
  `event.a2uiMessages` in the onEvent callback; post-`await` (success path only), appends the
  assistant summary of `batches.at(-1)`. (A closure-assigned `let` trips
  `no-unnecessary-condition` — the array + `.at(-1)` shape is deliberate.)
- **`ui/src/agent/liveAgent.ts`** — signature now `runLiveAgent(settings, messages: ConversationTurn[], onEvent, opts?)`;
  `streamText` accepts mixed-role messages unchanged; `toolChoice` + `stepCountIs(1)` still per turn.
- **Tests** — `ui/tests/conversation.test.ts` (summary extraction / cap / empty; append immutability);
  **`ui/tests/useLiveAgent.test.ts`** (NEW): mocks ONLY `runLiveAgent` via `vi.hoisted` +
  `importOriginal` spread, plus `@a2ui/react`'s `useA2UIActions`; asserts call #2's messages are
  `[user, assistant(contains rendered text), user(contains action name)]`. Gotchas encoded there:
  `vi.mock` factories are hoisted (use `vi.hoisted`); a defensive `typeof onEvent !== "function"`
  guard absorbs an act()-flush re-entry that once invoked the mock bare.

## State

**SHIPPED** — merged in **#182**, released in **v0.4.0** (2026-07-06). 106/106, lint 0, typecheck 0;
Red-first. Landing + CHANGELOG done.

## Verification still owed (optional)

- **Live E2E continuity re-run** (recipe: docs/testing.md "Live BYOK E2E", needs user's `ui/.env`):
  run fairytale, click a story button, and additionally assert the SECOND turn's content *continues*
  the first (story text overlaps/references turn 1) — the observable effect of memory. Unit-verified
  today (the hook contract test proves the summary lands in history); this proves the model uses it.

## Related / deferred

- #156 Stage 2 remaining after this: persistent transcript UI (turn history rendering + composer) —
  the "PR4" of plan 008. This plan delivers Stage 2's memory half.
- Token growth per turn is bounded by the 1200-char cap; revisit trimming (drop oldest summaries)
  only if long sessions hit provider context limits (YAGNI now).
