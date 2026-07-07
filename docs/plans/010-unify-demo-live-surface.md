---
title: Plan 010 — Unify Demo + Live into one surface (#128)
description: Lift the event log to the App root so Demo↔Live share one persistent A2UI surface + event stream (continuity on switch), with a lighter source selector. SHIPPED (#128) via PRs #198/#199/#200; unblocks PR4/#195.
date: 2026-07-07
status: shipped
issues: [128, 156]
handoff: handoffs/010-unify-demo-live-surface.md
---

# Plan 010 — Unify Demo + Live into one surface

## Context

`App.tsx` switches Demo↔Live with a root `useState` ternary that **fully unmounts one subtree and
mounts the other** (`App.tsx:307-333`) and calls `clearSurfaces()` on every switch — the surface
flashes and the event stream is lost, so the two feel like separate apps. The shared chrome is already
centralized (`DashboardShell` mounts the one `A2UISurface` + `EventStream`); what's missing is that
`eventLog` is owned **per-dashboard** (inside `useReplayEngine`/`useLiveAgent`), so nothing persists
across a switch. #128 asks for one shared surface + stream with a lighter **source selector**. This
also unblocks **PR4 / #195** (transcript + composer), which reads from the lifted log.

## Decisions

- **Option A — lift the log, keep the remount** (KISS). `Root` owns `eventLog` + `source`; the two
  engine hooks accept an **injected setter** instead of owning `useState`. The dashboard ternary, the
  lazy `LiveDashboard` (code-split), and the one-mounted-at-a-time `actionBridge` lifecycle all stay.
  *Rejected: inverting `DashboardShell` / compound components — an IA rebuild for marginal gain.*
- **Continuity switch semantics.** A *mere switch* no longer clears surface/log. Per-run resets stay:
  a fresh `play()` (non-append) / `restart()` / `run()` still wipes the shared log + surface — a
  `beginRendering` replaces the surface wholesale, so keeping stale rows would desync stream from
  surface. `sendAction`'s no-clear is untouched.
- **Rejected: unify the two engines behind one `run()`** (AHA). Replay-a-recording and stream-from-an-
  LLM (BYOK, `messages` history, turn-memory, `toolChoice`+`stepCountIs(1)`, 402/error handling) are
  genuinely different; they already meet at the shared `applyA2UIEvent` → `appendLogEntry` seam. A
  unified `run()` would wrap two things that only *look* alike — the dedup worth doing is the pipeline
  (done), not the engines.
- **Cut as YAGNI (revisit with PR4):** per-entry source tags (`"demo"`/`"live"`), the `EventStream`
  chip, and a cross-source coalescing guard. Mixed-source rows exist only in the brief read-only window
  between a switch and the next run; attribution becomes real when the transcript (#195) lands.
- **Lighter selector is in scope** — #128 asks for it explicitly (restyle `ModeToggle`, no new tests).

## 🗺️ Source map (verified)

- **Root switch**: `App.tsx:307-333` — `useState<ViewMode>("demo")`, `clearSurfaces()` on switch
  (`:314`), ternary mounts `DemoDashboard` (inline `:91-305`) or lazy `LiveDashboard` (`:10-12`).
  `App()` wraps in the single `A2UISurfaceProvider` (`:335-341`) — surface state survives switches.
- **Engine hooks** own `eventLog` today: `useReplayEngine.ts:22` (+ return `:82`); `useLiveAgent.ts:19`
  (+ return `:97`). Both append via `setEventLog(prev => appendLogEntry(prev, entry))`
  (`useReplayEngine.ts:64`, `useLiveAgent.ts:52`) and reset via `setEventLog([])` on a fresh run.
- **Shared seam**: `DashboardShell.tsx:84` (`A2UISurface`) + `:112` (`EventStream events={eventLog}`);
  presentational only (`:13-16` — no engine imports, keeps the AI SDK code-split).
- **Action bridge**: `agent/actionBridge.ts` module singleton; Demo registers `App.tsx:116-122`, Live
  `LiveDashboard.tsx:134-137` — works because one dashboard mounts at a time.

## Approach — 3 PRs (each independently green, squash-merged)

**PR-a — docs (this).** This plan; a plans/handoffs index in `docs/README.md`; an `AGENT_LEARNINGS.md`
entry (0.x deps: a breaking release ships as a *minor*, so major-only Dependabot ignores don't protect
them — from #197).

**PR-b — pure extraction (no behavior change, no new tests).** Move `DemoDashboard` (+ `DemoTreeChoiceView`,
`DemoLeafView`, `type Mode`, `HistoryEntry`, `activeRecording`) verbatim from `App.tsx` into
`ui/src/DemoDashboard.tsx`, mirroring `LiveDashboard.tsx`. `App.tsx` gains one **eager**
`import { DemoDashboard }` (Demo is the default view). `App.test.tsx` is the safety net.

**PR-c — the unify (TDD Red-first).**

1. **Contract** — inject the raw setter (React guarantees setter identity → zero hook-logic churn):
   - `useReplayEngine(recording, setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>, onComplete?)`
     → `{ isPlaying, play, restart }` (drop internal `useState`).
   - `useLiveAgent(setEventLog)` → `{ isRunning, error, run, sendAction, stop }`.
2. **Unmount cleanups (required — the lift introduces a zombie-writer path):** an in-flight producer
   surviving its dashboard's unmount would write into the shared log/surface. `useReplayEngine` clears
   `timerRef` on unmount (kills the recursive `setTimeout` chain); `useLiveAgent` aborts `abortRef` on
   unmount. Semantics: switching stops the outgoing source but keeps its output on stage.
3. **Root** owns `const [eventLog, setEventLog] = useState<EventLogEntry[]>([])`; `onView` becomes just
   `setView` — delete `clearSurfaces()` + the now-unused `useA2UIActions` import. Thread
   `eventLog`/`setEventLog` into both dashboards (inline prop fields).
4. **`ModeToggle` restyle** (last, no test): keep `role="group"`/`aria-pressed`; `aria-label`
   "Agent mode" → "Event source"; lighter active state (`bg-primary/10 text-primary` vs filled),
   `text-xs` pills; align `eventsSubtitle` copy (the stream is shared now).

### Red-first tests (non-trivial module logic only)

- `useReplayEngine.test.ts` — rewrite the harness for the injected setter (`useState` beside the hook,
  read `result.current.log`); add: fresh play wipes seeded pre-existing entries; **unmount mid-play
  stops scheduled events**.
- `useLiveAgent.test.ts` — pass a setter (turn-memory test unaffected); add: `run` wipes seeded
  entries; **aborts in-flight stream on unmount** (capture `opts.signal`; `let captured: AbortSignal |
  undefined` to avoid `no-unnecessary-condition`).
- **NEW `sourceSwitch.test.tsx`** — continuity via `<App/>` (module-stable `@a2ui` mocks; mock
  `useLiveAgent` so the lazy chunk loads without the AI SDK): stream persists across demo→live→demo;
  a mere switch does **not** call `clearSurfaces`. Timer gotcha: flush replay under fake timers, switch
  to real timers **before** `await screen.findBy…` (Suspense hangs under fake timers).
- No tests for the PR-b move, the `ModeToggle` restyle, or library behavior.

## Known-accepted risks

- A stale live-rendered Button clicked in Demo dispatches into Demo's tree lookup — unknown names no-op
  via `findChoiceByAction`; namespacing demo actions is YAGNI. Reverse is safe (`sendAction` no-ops
  before the first run).
- Demo's tree state (path/history) still resets on switch — the promise is surface + stream continuity,
  not tree position (Option A keeps the remount).
- Untagged mixed-source rows in the switch→run window — accepted; revisit with PR4.

## Constraints honored

KISS/DRY/YAGNI; preserve the offline-Demo code-split (no `ai`/`@ai-sdk` in the eager graph); BYOK keys
stay client-side (log entries carry no settings); strict lint (complexity 12, `no-unnecessary-condition`)
+ typing (`exactOptionalPropertyTypes`) + sec; TDD for the switch/lift logic only; styling verified by
render (polyfetch-scrape + patchright).

## Verification

Per PR: `cd ui && npm run typecheck && npm run lint && npm test` green; PR-c tests RED first then green;
`npm run build` + confirm `LiveDashboard` still emits its own lazy chunk. E2E: polyfetch-scrape/patchright
on the dev server — click a Demo path, switch to Live, assert stream entries persist + no surface flash,
switch back → still there (no BYOK key needed; Demo is offline). Screenshot light+dark for the selector.
