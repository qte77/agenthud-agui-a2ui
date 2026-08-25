---
title: Wow factor — capture a live agent session as a shareable, deterministic replay
description: Turn agenthud's AG-UI replay engine into a capture-and-share mechanism — serialize a live agent session into the existing recording format so anyone can replay it identically (zero key, zero cost) from a file/link; and let an agent generate recordings headlessly via /a2a. Ships as its own arc.
date: 2026-08-25
status: open
issues: []
predecessor: docs/plans/017-agent-native-discovery.md
handoff: docs/handoffs/019-capture-share-replay.md
---

# Arc 019 — "Generative UI you can bottle"

## Context

agenthud has one asset no other agent-UI demo has: a full **AG-UI replay engine** (`useReplayEngine`)
that deterministically replays a recording with zero key / zero API cost. Today it only replays a
pre-baked `overview.json`. This arc turns it into **capture-and-share**: serialize a *live* agent
session's AG-UI event stream into the **same recording format**, so anyone can replay it identically
from a file/link — and (bonus, gated on arc 017's live `/a2a`) let an agent generate recordings
**headlessly**. Fuses agenthud's two halves (live gen + deterministic replay). All `ui/`-only.

## Owner decisions

- **DRY serializer core** shared by the browser-live adapter and the headless-agent script — no new
  validation/shape logic; reuse the exported `coalesceSurfaceUpdates` + the Zod `RecordingSchema` /
  `A2UIMessageBatchSchema`.
- **Live turns are already self-contained** (`stepCountIs(1)` → one complete `render_ui` per turn;
  ADR-0004 says the live path is exempt), so capture needs **no** new snapshot logic.
- **Share = files + hash links, no backend** (zero-external-request / self-host policy). No gist/paste.
- Strict TDD (RED-first) for the pure module logic; UI wiring verified by effect (patchright E2E).

## 🗺️ Source map (verified — do NOT re-map)

Recording schema + types
- `ui/src/agent/contract.ts` — **Zod** `RecordingSchema` / `RecordingEventSchema` / `A2UIMessageBatchSchema`
  (`:142`, `:150-187`). `RecordingEvent = { delayMs:number, type:string, text?, segment?, a2uiMessages?: A2UIMessageBatch }`;
  `Recording = { meta:{title,description}, events: RecordingEvent[], tree?: DecisionTree }`.
- `ui/src/recordings/index.ts` — re-exports the inferred types (`:3-12`); imports `overview.json` at build
  time (`:1`); the demo's `asset:` token is resolved by a **one-off string-replace** (`:83-85`) — specific
  to overview.json, does NOT apply to a runtime-fed Recording.

Live event path (source of the capture)
- `ui/src/agent/applyA2UIEvent.ts` — `AgentEvent = {type,text?,a2uiMessages?}` (`:14-19`); `eventLog`
  strips `a2uiMessages` to count/types (`:4-11`); **`coalesceSurfaceUpdates` exported** (`:94`).
- `ui/src/agent/useLiveAgent.ts` — `render` calls `resolveAssets(...)` before `processMessages` (`:40-45`).
  `stream()` collects per-attempt `batches[]` (`:70`,`:88`), commits `winnerBatch` on win (`:107`), and
  timing is computed at receipt as `Date.now()-start` (`:89`). Reset in `run()` (`:138`). **Nothing today
  retains a capturable stream** — a capture buffer is new; commit only the WINNING attempt.

Replay engine + the asset gap (Phase 0)
- `ui/src/useReplayEngine.ts` — `render` (`:30-36`) does `accumulate(...) → processMessages` **without
  `resolveAssets()`** (unlike `useLiveAgent.ts:40-45`). → a captured recording with `asset:` tokens
  replays broken. **Phase 0 fix:** wrap this `render` with `resolveAssets` (import from `ui/src/agent/assets.ts`).
- `ui/src/replaySnapshot.ts` — `accumulate`/`emptySnapshot` (cumulative fold; ADR-0004).

Wiring points
- `ui/src/DemoDashboard.tsx` — hardcodes `tours[0]!.recording` (`:36`); has an `extraControls` slot.
- `ui/src/LiveDashboard.tsx` — Live surface + `extraControls` (Save button goes here).
- `ui/src/App.tsx` — root (Phase 2 hash-read on mount).
- Test convention: `ui/tests/*.test.ts`, import via `../src/…`, vitest + `@testing-library/react`.

Agent angle (Phase 3; gated on arc 017 — now LIVE)
- Worker `POST /a2a` `message/send` → completed Task; batch at `result.artifacts[0].parts[0].data.a2uiMessages`.
  Base URL `https://agenthud-proxy.cloudflare-driveway392.workers.dev`.

## Phases

**Phase 0 — prerequisite (S):** `ui/src/useReplayEngine.ts` render → wrap with `resolveAssets`. Latent bug
this arc exposes immediately.

**Phase 1 — MVP capture→save→import (the core):**
- NEW `ui/src/agent/recording.ts`: `batchesToRecording(batches, meta, delaysMs?)` (pure core) +
  `liveEventsToRecording(events, meta)` adapter (delayMs = ts gap; coalesce + `A2UIMessageBatchSchema.safeParse`
  each batch, drop a bad batch's `a2uiMessages` but keep the event; exclude internal `FALLBACK` events;
  final `RecordingSchema.safeParse` invariant). **TDD RED-first.**
- MODIFY `ui/src/agent/useLiveAgent.ts`: per-attempt capture buffer in `stream()` (push
  `{type,text,a2uiMessages,timestamp:Date.now()-start}` beside `applyA2UIEvent` at `:89`), commit to a
  persistent `capturedEventsRef` only on the winning attempt (`:106-108`), reset in `run()` (`:138`);
  expose `toRecording(meta)`.
- MODIFY `ui/src/LiveDashboard.tsx`: **Save** button in `extraControls` → Blob + `URL.createObjectURL` +
  hidden `<a download>` (no dep).
- NEW `ui/src/recordings/importRecording.ts`: `parseRecordingFile(raw):{ok,recording}|{ok:false,error}` =
  `JSON.parse` + `RecordingSchema.safeParse`. **TDD RED-first.**
- MODIFY `ui/src/DemoDashboard.tsx`: lift `tours[0]!.recording` (`:36`) to state; add an **Import**
  file-input control → feed the parsed Recording into `useReplayEngine` (unchanged) → `restart()`/`play()`.

**Phase 2 — shareable link (fast-follow):** NEW `ui/src/agent/recordingLink.ts` (`encode/decodeRecordingFromHash`
via native `CompressionStream`, size cap → fallback to download) + `ui/src/App.tsx` reads `location.hash` on mount.

**Phase 3 — agent-generated (bonus; arc 017 /a2a is live):** NEW `scripts/generate-recording.mjs` — POST prompts
to `/a2a` `message/send`, extract each Task's batch, pipe through the SHARED `batchesToRecording` → a Recording.

## Tests (RED-first for module logic; UI by effect)
- `ui/tests/recording.test.ts` — `batchesToRecording` (delays, coalescing, schema-valid, empty→empty) +
  `liveEventsToRecording` (drops bad batch keeps event, excludes FALLBACK).
- `ui/tests/importRecording.test.ts` — valid→`{ok,recording}`; malformed/invalid→`{ok:false,error}`.
- Phase 2: `recordingLink` encode→decode round-trip.
- By effect (patchright E2E): live run → Save → reload → Import → replays identically WITH images, 0 console errors.

## Risks
- **Asset tokens** — Phase 0 fixes; else captured recordings with images break on replay.
- **Fallback-retry leakage** — capture MUST commit only the winning attempt.
- **ADR-0004 `accumulate` bloat** — multi-turn capture re-emits stale components; harmless, accept for MVP.
- **`DemoDashboard` tree-optional** — `recording.tree` is `.optional()`; confirm the picker degrades for a
  tree-less imported recording (implementation-time check).

## Verification
`cd ui && npm run typecheck && npm run lint && npm test` (RED→GREEN) → patchright E2E for the wiring.

## Ops notes for the executing session
- **Disk is the gate.** ui toolchain (~450M) ENOSPC'd earlier. Before `npm ci --prefix ui`: **free
  `worker/node_modules` (~316M — the Worker is already deployed, PR #259) with `rm -rf`**, giving ~1.1G+
  free. Reinstall worker deps later only if redeploying.
- **Any subagents spawned for this arc MUST use worktree isolation** (`Agent` tool `isolation: "worktree"`) —
  parallel `ui/` edits would otherwise collide.
- Gotchas: `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh; `-c commit.gpgsign=false`; sandbox blocks Bash
  pipes/`;`/`&&` (use `bash -c '…'`).

## Shipped (arc 019, Phase 0+1) — PR #260 (open, all CI green; awaiting owner squash-merge)

Code-complete, `npm run typecheck && npm run lint && npm test` all green (173 tests):
- **Phase 0** — `useReplayEngine` render wrapped with `resolveAssets` (captured `asset:` tokens replay as images).
- **recording.ts** — `batchesToRecording` (DRY core) + `liveEventsToRecording` (adapter) + `recording.test.ts` (RED-first).
- **useLiveAgent** — per-attempt capture buffer, winner-only commit, `run()` reset, `toRecording(meta)`.
- **LiveDashboard** — **Save** button (Blob object-URL download; `SaveButton` extracted for the complexity gate).
- **importRecording.ts** — `parseRecordingFile` + `importRecording.test.ts` (RED-first).
- **DemoDashboard** — recording lifted to state; **Import** file-input control + inline error; replays via unchanged `useReplayEngine`.

## Remaining-work table (single source of open work)
| # | Item | Phase | Gate | Done-when |
|---|------|-------|------|-----------|
| 1 | E2E verify capture→Save→Import→replay (WITH images, 0 console errors) | 1 | agent | patchright E2E green locally + gh-pages |
| 2 | Phase 2 hash link (`recordingLink.ts` + App hash-read) | 2 | agent | encode→decode round-trip test + E2E |
| 3 | Phase 3 `generate-recording.mjs` (headless via `/a2a`) | 3 | agent | script → Recording → imports/replays |
| 4 | Merge PR #260 (feat/019) | all | owner | `gh pr merge 260 --squash --admin --delete-branch` (agent merge is classifier-blocked) |
