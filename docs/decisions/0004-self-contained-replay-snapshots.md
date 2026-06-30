---
title: ADR-0004 — Self-contained replay snapshots (@a2ui validates each surfaceUpdate in isolation)
description: Decision to re-emit a self-contained surfaceUpdate snapshot per replay step, because @a2ui validates every component reference against only the current message's components.
---

# ADR-0004 — Self-contained replay snapshots

**Status:** Accepted (2026-06-30)
**Relates to:** [US-1][user-stories] (demo replay) · demo referential errors #141 · [ADR-0003][adr-0003] · v0.8→v0.9 watch #140

## Context

`@a2ui`'s v0.8 server-to-client schema validates each `surfaceUpdate` **in isolation**: its
`superRefine` builds `componentIds` from **only that message's** `data.components`, then rejects any
child reference not in that set —
`Component 'root' references non-existent component ID '…'`
(`@a2ui/web_core/.../v0_8/schema/server-to-client.js`). So **every `surfaceUpdate` must be
referentially self-contained**.

The pre-baked demo replays **incremental deltas**: a later batch re-declares `root` to reference cards
defined in *earlier* batches (relying on the processor's cumulative component map). Each such delta
fails the per-message check. Since #145 surfaces render errors in the event log, this showed up as a
**flood** of "non-existent component ID" entries on *Play All* and the decision-tree path, and dropped
components. The live agent is unaffected — `toolChoice` + `stepCountIs(1)` make it emit **one complete**
`surfaceUpdate` per turn (ADR-0003 / #129).

## Decision

Keep a running **`SurfaceSnapshot`** (`ui/src/replaySnapshot.ts`) in the replay engine: fold each
delta's components into a cumulative map and re-emit **one self-contained `surfaceUpdate` per step**
(latest `beginRendering` + every component seen so far). Reset on a fresh (non-append) play; carry it
across append plays (tree mode). The logged event stays the raw delta, so the event log keeps its
per-message "stream" semantics — only what's handed to `@a2ui` is expanded.

| Option | Fixes per-message check | Keeps delta log | Effort | Verdict |
|---|---|---|---|---|
| **1. Self-contained snapshot at render (chosen)** | Yes (all modes) | Yes | small, pure + TDD | ✅ |
| 2. Strip dangling root refs (`patchRootChildren`) | Only cross-*segment* refs on a cleared surface | Yes | exists | ◑ complementary, kept |
| 3. Rewrite `overview.json` to self-contained messages | Yes | No (deltas become cumulative) | large, brittle data churn | ❌ |
| 4. Migrate `@a2ui` v0.8 → v0.9 (may validate differently) | Maybe | — | large | ❌ out of scope (#140) |

`patchRootChildren` (option 2) is **kept, not replaced** — it strips truly cross-segment references
when a segment renders on a cleared surface (non-append), which the snapshot can't conjure. It's
load-bearing and guarded by `ui/tests/filters-standalone.test.ts` (removing it fails that test).

## Consequences

- The replay seam now self-contains every render; the **live path is untouched** (one complete batch).
- `replaySnapshot.ts` is pure + Red-tested (`ui/tests/replaySnapshot.test.ts`); verified by render
  (patchright) — Play All + tree render with **zero** ref errors.
- This couples the replay engine to A2UI message structure (parse + merge components). Accepted — the
  seam is demo-only.
- Revisit if `@a2ui` v0.9 relaxes per-message validation (#140), which could make both the snapshot and
  `patchRootChildren` unnecessary.

## References

- `@a2ui` schema: `@a2ui/web_core/.../v0_8/schema/server-to-client.js` (`superRefine` / `checkRefs`)
- Self-containing seam: `ui/src/replaySnapshot.ts` · wired in `ui/src/useReplayEngine.ts`
- Render pipeline: [architecture.md][architecture] · [ADR-0003][adr-0003]

[user-stories]: ../UserStory.md
[adr-0003]: 0003-live-catalog-instruction.md
[architecture]: ../architecture.md
