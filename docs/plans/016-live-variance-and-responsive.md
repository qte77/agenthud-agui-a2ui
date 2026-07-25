---
title: Plan 016 — Live variance residue + responsive shell
description: Code/file/source map for the remainder migrated out of arc 015 — narrow-viewport shell layout, residual multi-call model variance, and the reusable live-E2E harness.
date: 2026-07-25
status: open
issues: [240, 129]
predecessor: plans/015-live-render-hardening.md
handoff: handoffs/016-live-variance-and-responsive.md
---

# Plan 016 — Live variance residue + responsive shell

Successor to [plan 015][p015], which closed after the live-render defects it was chasing turned out
to be **framing bugs in our seam, not model variance**, and were fixed deterministically (PR #239).
Start from the E2E harness described below — it is the arc's main instrument.

## State (verified 2026-07-25, deployed build `43b65a4`)

Live BYOK path renders end-to-end: 4/6 E2E runs fully clean, both prior failure modes gone
(split `surfaceUpdate` → coalesced; unknown `asset:` token → placeholder). `main` CI and the Pages
deploy are green again (PR #235). The two remaining failures are **not** render-correctness bugs.

## Backlog (ordered, each with its done-when)

### 1. Responsive shell — #240 (agent-runnable, highest user impact)
The A2UI surface collapses to a ~10px sliver at 390px: `ui/src/DashboardShell.tsx` renders
`<aside className="w-96 …">` — 384px fixed at every breakpoint. Render is clean; there is simply no
room to paint. Desktop 1280/1440 unaffected.

- **Do:** make the aside responsive (stacked/full-width below a `md:` breakpoint, or a drawer).
  Touches `DashboardShell.tsx` only; Demo and Live share it, so verify both.
- **Verify by effect, not a unit test** (layout/CSS): E2E at 390×844 + a tablet width + 1440.
- **Done when:** the `mobile-complex` E2E run reports non-empty `surface_chars` with the same clean
  event log, and desktop runs are unchanged.

### 2. Residual multi-call variance (decide-by-default: accept + observe)
1 of 4 complex runs had gpt-4o-mini emit **two** `render_ui` calls; the second batch failed
`A2UIMessageBatchSchema` and was skipped, and the surface still painted from the valid one, with the
violation visible in the event log.

- **Default: accept.** This is graceful degradation, and the deterministic fixes cost nothing per
  token. Do **not** spend ADR-0003 option 3 (derived-schema reference) or a `parse_response` repair
  step on it — both remain unspent and should be *proposed before building*.
- **Done when:** a 10-run E2E sample keeps surface-paint at 100% even when a stray second call
  appears; escalate only if paint itself starts failing.

### 3. Promote the live-E2E harness into the repo (agent-runnable)
The harness lives in `/tmp` today, so every session rebuilds it. It drives Live mode, fills the key
from `ui/.env` (never printed — a `fill()` timeout would dump it), runs a prompt matrix across
viewports, intercepts `chat/completions` to reassemble the streamed `render_ui` arguments, and
asserts paint + zero render errors / contract violations / console errors / failed requests.

- **Do:** land it under `ui/tests/e2e/` (or `scripts/`) with the recipe in `docs/testing.md`; keep it
  out of the CI gate (needs a real key) — it is an on-demand instrument.
- **Done when:** one documented command reproduces the 6-run matrix and writes a JSON report.

### 4. Reconcile `gh issue list` against plans 004–015
Carried unstarted from plan 015 §3. Open issues at close of 015: #211, #185, #165, #156, #132, #120,
#119, #102, plus new #240.

## Code / file / source map (deltas since plan 015; the 015 map still holds)

| Stage | File · symbol | Note |
|---|---|---|
| Batch repair | `ui/src/agent/applyA2UIEvent.ts` · `coalesceSurfaceUpdates`, `componentsBySurface` | Folds a batch's `surfaceUpdate`s per surface **before** validate + render. Runs on the replay path too (harmless — recordings are already single-update). |
| Cross-batch repair | `ui/src/replaySnapshot.ts` · `accumulate` | The replay-side equivalent (stateful, across batches). Header comment cross-references the live one — keep both in sync. |
| Asset fallback | `ui/src/agent/assets.ts` · `PLACEHOLDER_ASSET`, `resolveAssets` | Unknown `asset:<name>` → inline data-URI SVG. Known tokens still map to bundled URLs. |
| Shell layout | `ui/src/DashboardShell.tsx` (aside `w-96`, `main` flex-1) | The #240 fix site. |
| E2E harness | `/tmp/e2e_live.py` (to be promoted — item 3) | Selectors: `aside input[type=password]`, `aside select` nth(1) → `__custom__`, `aside input[placeholder^="Model id"]`, `aside summary` filtered by "Prompt" / "AG-UI Events", `main div.relative`. |

**@a2ui ground truth (unchanged):** v0.8 default export.
`ui/node_modules/@a2ui/web_core/src/v0_8/schema/server-to-client.js` ·
`SurfaceUpdateMessageSchema.superRefine` builds its id set from **one message's** `components` — the
root cause behind the whole of arc 015's "variance".

## Working agreement (unchanged from 015)
- **Strict TDD for module logic only** — failing behavior test FIRST. Prompt / recording / config /
  layout changes are verified **by effect** (E2E / render), never a unit test.
- Topical branch off fresh `origin/main`; `unset GH_TOKEN GITHUB_TOKEN` for gh; gates
  (`npm --prefix ui run typecheck && … lint && … test`) green → squash-merge → delete branch.
- **Commits must be signed** — the ruleset requires it and a repo-local `commit.gpgsign=false`
  silently produces unsigned commits: use `git -c commit.gpgsign=true commit -S`. The resulting
  merge block ("base branch policy prohibits the merge") never mentions signatures.
- After each merged PR: progress report (shipped / next / % / blocked) + docs & issues audit.

## Environment watch-outs
- The sandbox denies compound bash (`a; b`, `a && b`), pipes, `curl`, and `ls` outside the working
  dir. Use single commands, `node -e`, and redirect output to a file, then read the slice you need.
- `$CLAUDE_JOB_DIR` may be unset — fall back to `/tmp` for scratch scripts.
- `npm ci` must resolve in **both** `ui/` and `worker/`; a dependabot bump that breaks peers reds CI
  *and* the Pages deploy, leaving the live site stale (see #235). Check deploy status before trusting
  an E2E result — assert the footer build SHA in the harness (it now does).

[p015]: 015-live-render-hardening.md
