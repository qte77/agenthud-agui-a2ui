---
date: 2026-07-25
status: closed
issues: [129]
plan: plans/015-live-render-hardening.md
successor: handoffs/016-live-variance-and-responsive.md
title: Handoff 015 — Live-path render hardening + re-baseline
description: Onboards the next (unattended) session to the verified-working live A2UI render path, the code map, open threads, and the working agreement.
---

# Handoff 015 — Live-path render hardening + re-baseline

> **Closed 2026-07-25 — superseded by [handoff 016][h016].** Its open thread #1 turned out to be a
> seam bug, not model variance (fixed in #239); CI + the Pages deploy were also unbroken (#235).
> The remainder moved to plan/handoff 016. Kept for the arc record.

> **First thing:** re-baseline. A prior session had a stale view of the tree. Run
> `git fetch origin && git log --oneline -12 origin/main` and skim `git status` before anything.
> The real tree is ~#220 / plan-014.

## State (verified this arc)
The **BYOK live path renders end-to-end on gh-pages** — a real GitHub Models run (gpt-4o-mini via the
proxy) painted a card. Zero NetworkError (old failure was client-side), zero render error for
well-formed batches. The system prompt (`ui/src/agent/prompts.ts`) already encodes the hard-won rules
(one `render_ui` call, typed literals, `root`=top-component id, no empty arrays, `dataModelUpdate` for
interactive path-bound CheckBox/Slider, `asset:` URLs, acyclic tree). `applyA2UIEvent` already
surfaces both contract-violation and render errors in the event log. **These are done — do not rebuild.**

## What's next (in order)
1. **Re-verify** which live-path fixes are merged vs open in the #220 tree (typed literals / root-id /
   catalog shapes / contract-surfacing all *appear* present).
2. **gpt-4o-mini variance on complex UIs** (the one real open item): occasional multiple/partial
   `render_ui` calls or empty required arrays. Verify **by effect** (E2E), not a unit test. If still
   flaky, *propose before building*: derived-schema reference (ADR-0003 opt 3) or a repair step.
3. Reconcile `gh issue list` against plans 004–014 for anything unshipped.

## How to handle it (the loop)
- **Strict TDD** for module logic only: failing behavior test FIRST (Red) → minimal (Green) → refactor.
  Prompt/recording/config changes are **verified by effect** (E2E/render), never a unit test.
- Topical branch off fresh `origin/main`; `unset GH_TOKEN GITHUB_TOKEN` for push/PR/merge; gates
  (`cd ui && npm run typecheck && npm run lint && npm test`) green → squash-merge → delete branch.
- **After each merged PR:** post the progress report (shipped / next / % / blocked) and run the docs +
  issues audit — see plan §"Per-milestone discipline".
- **E2E:** patchright via `/workspaces/qte77/polyfetch-scrape/.venv/bin/python` against the deployed
  URL; read the key from `ui/.env` in-script (never print it); GitHub Models (via proxy); assert the
  surface paints + zero `A2UI render error`. Temp scripts under `$CLAUDE_JOB_DIR/tmp`. Sandbox blocks
  pipes/compound bash + curl — use Read/node.

## Watch-outs
- Local `main` goes stale after squash-merges → branch off `origin/main`, `git fetch --prune`.
- Don't touch the API-key field in E2E beyond filling it (a fill() timeout dumps the key to logs).
- We're on `@a2ui` **v0.8** default export (not v0.9); v0.9 migration is a separate, larger issue.

## Pointers
- Full map + open threads: [plans/015-live-render-hardening.md][p015]
- Pipeline prose: [architecture.md][arch] ("A2UI render pipeline") · ADR-0001/0002/0003

[p015]: ../plans/015-live-render-hardening.md
[arch]: ../architecture.md
[h016]: 016-live-variance-and-responsive.md
