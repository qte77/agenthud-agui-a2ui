---
title: Plan 011 — Live persistent transcript UI + conversation composer (#195)
description: Retain each Live turn's rendered surface in a scrollable chat transcript (prior turns frozen via A2UIViewer, latest stays live) + a free-text composer. Builds on the lifted eventLog (#128) and turn memory (#182); the last live-agent piece of #156 Stage 2.
date: 2026-07-08
status: planned
issues: [195, 156]
handoff: handoffs/011-live-transcript-composer.md
---

# Plan 011 — Live persistent transcript UI + conversation composer

## Context

Live mode's turn **memory** shipped (plan 009: `messagesRef` + `summarizeRender`), and the shared
`eventLog` was lifted to `Root` (plan 010 / #128). But each turn still **replaces** the surface, and
the only way to continue a conversation is clicking a rendered Button. #195 asks for: (1) per-turn
surfaces retained in a scrollable transcript, (2) a free-text composer.

**Feasibility (verified):** `@a2ui/react@0.10.1` ships `A2UIViewer` (`{root, components, theme?, onAction?}`)
— a static renderer that mounts its own isolated provider per instance. So N frozen turns = N isolated
read-only surfaces. The missing piece is *capture*: `useLiveAgent.stream()` collects raw batches but
discards them (only `batches.at(-1)` feeds the text summary). `replaySnapshot.ts`
(`emptySnapshot`/`accumulate`) already folds incremental batches into the exact `{root, components}`
shape the viewer wants — reuse it (DRY).

**User-approved UX:** interleaved chat transcript (user row + surface per turn; prior turns frozen,
latest stays the live interactive surface); composer = bottom bar in main; **Live-only** (Demo keeps
its tree/history UI untouched).

## Decisions

- **Capture inside `stream()`**, folding per-event via `accumulate(snap, resolveAssets(event.a2uiMessages))`,
  gated on `entry.a2uiComponentCount !== undefined` (= batch passed `A2UIMessageBatchSchema` in
  `applyA2UIEvent.ts`). *Rejected: folding the existing `batches` array post-hoc — it's pushed
  pre-validation and pre-`resolveAssets` (broken images / invalid trees in frozen turns).*
- **Transcript state is LiveDashboard-local**, injected into the hook as a second setter (mirrors the
  `setEventLog` injection). It dies on a Demo↔Live switch — correct, because `messagesRef` (the
  conversation it visualizes) dies with the dashboard too; a Root-owned transcript would outlive its
  conversation. #128 continuity (eventLog + surface persist on switch) is untouched.
- **Fresh `run()` wipes the transcript** — same reset family as `setEventLog([])` + `clearSurfaces()`.
- **Layout: one new optional `beforeSurface?: ReactNode` slot on `DashboardShell`**, rendered between the
  "A2UI Surface" header row (`DashboardShell.tsx:76`) and the surface wrapper (`:77`). Order top→bottom:
  frozen prior turns → latest user row → live surface → composer (`children`, currently `{null}` for
  Live). Demo passes nothing → zero change. *Rejected: transcript in `children` (inverts chronology);
  shell inversion (stays rejected per plan 010, AHA).*
- **Frozen turns: no `onAction` + `pointer-events-none` wrapper** — inert, no dead-click confusion.
- **New `sendMessage(settings, text)`** on the hook; extract a shared `followUp()` used by both
  `sendAction` and `sendMessage` (guard → `appendUserTurn` → `stream`, no wipe). `messagesRef` stays the
  sole LLM-history source of truth — the transcript is **display-only** and never fed back to the model.
- **Error/abort turns:** user row always kept; turn finalizes with whatever validated render
  accumulated (possibly `null`). **No per-turn error field** — the hook's existing top-level `error`
  (already shown by `LiveDashboard`) stays the single error surface (KISS).
- **BYOK sec:** `TranscriptTurn` carries only user text + component JSON — `LiveSettings` never enters it.

## 🗺️ Source map (verified)

- `App.tsx:18` — `Root` owns `const [eventLog, setEventLog] = useState<EventLogEntry[]>([])`, passed to
  both dashboards. Lazy `LiveDashboard` (`App.tsx:7-11`) confines `ai`/`@ai-sdk/openai` to that chunk.
- `agent/useLiveAgent.ts` — `useLiveAgent(setEventLog)` → `{isRunning, error, run, sendAction, stop}`.
  `stream()` (:35-70) collects `batches` and uses only `batches.at(-1)` for `summarizeRender`, then
  discards. `run()` (:72-82) wipes; `sendAction()` (:86-93) appends, no wipe. Unmount aborts (:99).
- `agent/conversation.ts` — `ConversationTurn`, `actionToTurn`, `appendUserTurn`/`appendAssistantTurn`,
  `summarizeRender`. `messagesRef` holds this history.
- `replaySnapshot.ts:18-48` — `emptySnapshot()` / `accumulate(snapshot, messages)` fold incremental
  batches into a self-contained `{begin, surfaceId, components: Map}`.
- `agent/applyA2UIEvent.ts:66-106` — validates via `A2UIMessageBatchSchema`, sets `a2uiComponentCount`
  only on success (:92-94), then `render()`. `EventLogEntry` = `{type, timestamp, text?,
  a2uiComponentCount?, a2uiComponentTypes?}`.
- `A2UISurface.tsx` — the ONE live provider; `onAction` → `actionBridge.dispatchAction`. `A2UIViewer`
  ships its own provider (needs explicit `theme={qteA2uiTheme}` — defaults to litTheme otherwise).
- `DashboardShell.tsx` — slots `headerMiddle`, `extraControls`, `asidePanel` (:90), `children` (:87,
  Live passes `{null}`); live surface at `:84`.
- `LiveDashboard.tsx:135` — `useLiveAgent(setEventLog)`; `ready` (:160-164) gates the sidebar Run.

## Data model — NEW `ui/src/agent/transcript.ts` (pure module, no `ai`/runtime `@a2ui` imports)

```ts
import type { SurfaceSnapshot } from "../replaySnapshot";
import type { ComponentInstance } from "@a2ui/react"; // type-only — erased at build; module stays runtime-pure

export interface TurnSnapshot { root: string; components: ComponentInstance[] }
export interface TranscriptTurn {
  userText: string;                 // typed prompt | composer text | clicked-action label
  snapshot: TurnSnapshot | null;    // null while streaming / render-free or failed turn
}
export function seedTurn(turns: TranscriptTurn[], userText: string): TranscriptTurn[];       // append {userText, snapshot:null}
export function finalizeTurn(turns: TranscriptTurn[], snapshot: TurnSnapshot | null): TranscriptTurn[]; // replace LAST turn's snapshot; [] no-op
export function toTurnSnapshot(snap: SurfaceSnapshot): TurnSnapshot | null;  // begin.root + [...components.values()]; null if no root/components
export function actionLabel(name: string): string;                          // `Clicked "${name}"` (UI-facing; model keeps actionToTurn)
```

## File changes

1. **`ui/src/agent/transcript.ts`** — NEW, as above (~50 lines).
2. **`ui/src/agent/useLiveAgent.ts`** — signature → `useLiveAgent(setEventLog, setTranscript)` (both
   required). `stream()` gains a `userText` param: seed turn after `setError(null)` (:38); fold
   `accumulate(snap, resolveAssets(event.a2uiMessages))` in the event callback (:49-53) behind the
   validation gate; catch (:61-64) unchanged; in `finally` (:65-67)
   `setTranscript(prev => finalizeTurn(prev, toTurnSnapshot(snap)))`. `run()` (:72-82) adds
   `setTranscript([])` + passes `prompt` as `userText`. Extract `followUp(settings, content, userText)`;
   `sendAction` → `followUp(s, actionToTurn(name).content, actionLabel(name))`; new
   `sendMessage` → `followUp(s, text, text)`. Return gains `sendMessage`.
3. **`ui/src/DashboardShell.tsx`** — add optional `beforeSurface?: ReactNode`; render between `:76` and `:77`.
4. **`ui/src/Transcript.tsx`** — NEW. `{turns}`; null when empty. Per turn: user-row pill (`text-xs`,
   right-aligned) + — only when `i < turns.length - 1` and `snapshot` non-null —
   `<A2UIViewer root components theme={qteA2uiTheme}/>` inside a `pointer-events-none opacity-80`
   wrapper. Follow-scroll `useEffect` on `turns.length` (ships now — core chat UX; no test).
5. **`ui/src/Composer.tsx`** — NEW. `{disabled, onSend}`; local draft state; `<form>` + input + Send;
   Enter submits; trim, skip empty; `sticky bottom-0` bar styling.
6. **`ui/src/LiveDashboard.tsx`** — `const [transcript, setTranscript] = useState<TranscriptTurn[]>([])`;
   hook call gains `setTranscript` + destructure `sendMessage`; split `ready` into `connectionReady`
   (settings only) + `ready` (+ prompt); DashboardShell gains `beforeSurface={<Transcript turns={transcript}/>}`
   and `children` = `<Composer disabled={isRunning || transcript.length === 0 || !connectionReady}
   onSend={(text) => void sendMessage(settings, text)}/>`.
7. **Test-harness ripples:** `useLiveAgent.test.ts` harness gains the transcript state pair;
   `LiveDashboard.test.tsx` hook mock adds `sendMessage: vi.fn()`; `sourceSwitch.test.tsx` `@a2ui/react`
   mock factory adds `A2UIViewer: () => null`.

## Red-first tests (non-trivial module logic only; Red before each module)

- **`transcript.test.ts`** (first): seedTurn appends immutably; finalizeTurn replaces only the last
  turn's snapshot / `[]` no-op; toTurnSnapshot from an accumulate-folded begin+update fixture →
  `{root, components}` in insertion order; null when no begin or no components.
- **`useLiveAgent.test.ts`** (extend): run seeds 1 turn (userText + snapshot); sendAction appends turn 2
  with `Clicked "…"` label, turn 1 retained; sendMessage appends history `["user","assistant","user"]`
  (turn memory intact, no wipe) + a transcript turn; sendMessage before any run = no-op; fresh run
  resets transcript to 1 turn; rejected stream → last turn keeps its user row with `snapshot: null` +
  hook-level `error` set.
- **`Composer.test.tsx`**: Enter → onSend(trimmed) once + field cleared; disabled blocks; whitespace-only skipped.
- **`Transcript.test.tsx`** (stub A2UIViewer): 3 turns → 3 user rows, exactly 2 viewers (N−1 rule);
  null-snapshot prior turn renders no viewer; empty → nothing.
- **No tests for:** `actionLabel` one-liner, styling, scroll effect, `beforeSurface` pass-through.

## Constraints honored

KISS/DRY/YAGNI/AHA; preserve the offline-Demo code-split (no `ai`/`@ai-sdk` in the eager graph);
`A2UIViewer` is `@a2ui/react` (already eager via `A2UISurface`) and `Transcript.tsx` sits in the Live
chunk; BYOK keys stay client-side; strict lint (complexity ≤12, `no-unnecessary-condition`) + typing
(`exactOptionalPropertyTypes`) + sec; TDD Red-first for module logic only.

## Verification

Per PR: `cd ui && npm run typecheck && npm run lint && npm test` green (new modules Red-first);
`npm run build` + confirm `LiveDashboard-*` still emits its own lazy chunk with the AI SDK and the eager
`index-*` has no `ai`/`@ai-sdk`. E2E via polyfetch-scrape + patchright on the dev server (real BYOK via
`ui/.env` prefill): Run default prompt → composer follow-up + Enter → frozen snapshot + both user rows
above the live surface, composer disabled while streaming → click a live Button → third row `Clicked "…"`
+ second frozen snapshot → click a frozen-turn button → no-op → Demo↔Live switch: transcript gone
(expected), stream + surface persist (#128 regression). Light + dark screenshots.

## Known-accepted risks

- `accumulate` ignores `dataModelUpdate` → frozen turns render data-bound values as defaults. Low
  exposure (system prompt drives `literalString` UIs); fold `data` prop later if needed (documented in code).
- Per-viewer provider overhead / unbounded turn growth — fine at conversation scale; cap later (YAGNI).
- Theme type identity (`Types.Theme` vs re-exported `Theme`) — expected identical; single-site cast if `tsc` disagrees.
- UI label (`Clicked "name"`) intentionally diverges from the model-facing `actionToTurn` text — pinned by tests.
