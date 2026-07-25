---
date: 2026-07-25
status: open
issues: [240]
plan: plans/016-live-variance-and-responsive.md
title: Handoff 016 — Live variance residue + responsive shell
description: Onboards the next (unattended) session to plan 016 — what arc 015 actually found, what shipped, and the ordered remainder.
---

# Handoff 016 — Live variance residue + responsive shell

> **First thing:** `git fetch origin && git log --oneline -6 origin/main`, then `git status`.
> The tree is at #239 (`43b65a4`) or later. Check the Pages deploy is green before any E2E —
> a red deploy means you are testing a stale build (that happened in arc 015).

## What shipped (arc 015 close-out)
- **#235** — unbroke `main`: the auto-merged `typescript` 7.0.2 bump made `npm ci` unresolvable in
  both `ui/` and `worker/` (typescript-eslint peers `<6.1.0`), redding CI **and** the Pages deploy.
  TS pinned to `~6.0.3`, `@cloudflare/workers-types` → `^5`, TS majors dependabot-ignored.
- **#239** — the two live-render defects the E2E found (details in [plan 016][p016] and
  [plan 015 §E2E outcome][p015]): split `surfaceUpdate` → `coalesceSurfaceUpdates`; invented
  `asset:` token → inline placeholder. TDD Red-first, 162 tests green.
- **#240 opened** — surface collapses to a sliver at 390px (fixed `w-96` aside).

## The headline finding
Arc 015's "gpt-4o-mini variance on complex UIs" was **not** variance. The failing batches were
structurally complete; @a2ui v0.8 resolves child references within a *single* `surfaceUpdate`
message, and the model had split its components across several. One deterministic fix at the render
seam took the E2E from 2/6 to 4/6 — **without** touching the prompt and without spending either
ADR-0003 escalation. Prefer looking for a framing/seam bug before blaming the model.

## What's next (in order)
1. **#240 responsive shell** — `ui/src/DashboardShell.tsx`, the fixed `w-96` aside. Verify by effect
   at 390 / tablet / 1440. Highest user impact, fully agent-runnable.
2. **Promote the E2E harness** from `/tmp/e2e_live.py` into the repo + `docs/testing.md`.
3. **Residual multi-call variance** — default is *accept and observe*; propose before building.
4. **Reconcile `gh issue list`** against plans 004–015.

## How to handle it (the loop)
- Strict TDD for module logic only; layout / prompt / config changes are verified by effect.
- Topical branch off fresh `origin/main`; `env -u GH_TOKEN -u GITHUB_TOKEN gh …`; gates green →
  squash-merge → delete branch; then progress report + docs/issues audit.
- **Sign every commit:** `git -c commit.gpgsign=true commit -S …`. The repo-local
  `commit.gpgsign=false` otherwise yields an unsigned commit and the merge fails with an unhelpful
  "base branch policy prohibits the merge". Don't amend a pushed commit to fix it — branch fresh and
  open a replacement PR.
- **E2E:** `/workspaces/qte77/polyfetch-scrape/.venv/bin/python` + patchright against the deployed
  URL; **OpenRouter** with the `ui/.env` key (the old "GitHub Models (via proxy)" recipe is dead —
  that provider was removed in #165). Read the key in-script, never print it, and never touch the key
  field beyond `fill()`. Assert the footer build SHA so you know which build you tested.

## Watch-outs
- Sandbox denies compound bash, pipes, `curl`, and `ls` outside the working dir → single commands,
  `node -e`, redirect to a file and read back the slice.
- Local `main` goes stale after squash-merges → branch off `origin/main`, `git fetch --prune`.
- We're on `@a2ui` **v0.8** default export; v0.9 is a separate, larger migration.

## Pointers
- Full map + backlog with done-whens: [plans/016-live-variance-and-responsive.md][p016]
- Closed predecessor (incl. the E2E outcome table): [plans/015-live-render-hardening.md][p015]

[p016]: ../plans/016-live-variance-and-responsive.md
[p015]: ../plans/015-live-render-hardening.md
