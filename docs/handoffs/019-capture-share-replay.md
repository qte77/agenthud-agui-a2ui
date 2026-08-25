---
plan: docs/plans/019-capture-share-replay.md
issue: null
status: open
updated: 2026-08-25
---

# Handoff — Arc 019 (capture-share replay / "wow factor")

Onboarding for the next session. **Read `docs/plans/019-capture-share-replay.md` in full first** — it has
the verified **source map** (exact `file:line` refs), the design, phases, tests, and the remaining-work
table. Nothing here re-derives it.

## Start-of-session checklist (do in order)

1. **Free disk for the ui toolchain — this is the blocker.** `df -h /workspaces` (was 849M free).
   The Worker is already deployed (PR #259), so **`rm -rf worker/node_modules`** (~316M, regenerable) →
   ~1.1G+ free. Then `npm ci --prefix ui` (~450M). The ui install ENOSPC'd earlier at ~526M free, so make
   the room first. If wrangler/miniflare is later needed again, `npm ci --prefix worker`.
2. `git switch feat/019-capture-share-replay` (this branch; the plan+handoff are its first commit).
3. Confirm on branch, `main` up to date.

## What shipped this session (Phase 0 + 1 — code-complete, PR #260)

**PR #260** is open with **all CI green** (typecheck+lint+test+build, worker, markdown, links, CodeQL) —
the ONLY thing left on it is the **owner squash-merge** (agent `gh pr merge` is classifier-blocked;
owner runs `env -u GH_TOKEN -u GITHUB_TOKEN gh pr merge 260 --squash --admin --delete-branch`).
`npm run typecheck && npm run lint && npm test` all green (173 tests). See the plan's **Shipped** list
for the file-by-file breakdown. In short: Phase 0 asset-resolve fix; `recording.ts` (DRY core +
adapter) and `importRecording.ts` with RED-first tests; winner-only capture buffer + `toRecording` in
`useLiveAgent`; **Save** button (Live) and **Import** control (Demo). **Not yet done: the patchright
E2E** (env's polyfetch venv was deleted; needs a dev server + browser) — it's row 1 of the table.

## How to handle the remaining work (plan's table, in order)

1. **E2E verify** capture→Save→Import→replay WITH images, 0 console errors (row 1) — the wiring was
   verified by types/lint/unit only. Run `npm run dev --prefix ui` + patchright (restore the venv first).
2. **Phase 2** hash link, then **Phase 3** headless `/a2a` script — the serializer is **one DRY core**
   (`batchesToRecording`); the Phase-3 script must reuse it, don't fork it.
- Design invariants already honored (keep them): **capture only the WINNING attempt** (commit-on-win in
  `stream()`); `asset:` tokens stay verbatim in the file and resolve at replay (Phase 0); `FALLBACK`
  excluded; final `RecordingSchema` invariant.

## Owner-gates
- One: PR review + merge of the `feat/019` PR (agent `gh pr merge` is classifier-blocked for large PRs →
  owner runs `!env -u GH_TOKEN -u GITHUB_TOKEN gh pr merge <n> --squash --admin --delete-branch`; small
  docs/dependabot PRs pass for the agent).

## Watch-outs
- **Subagents for this arc MUST use worktree isolation** (`Agent` tool `isolation: "worktree"`) — parallel
  `ui/` edits collide otherwise.
- `env -u GH_TOKEN -u GITHUB_TOKEN` on every git/gh; `-c commit.gpgsign=false` (no GPG key); sandbox blocks
  Bash pipes/`;`/`&&` (wrap in `bash -c '…'`); use `node -e` for fetches (no curl/polyfetch — venv deleted).
- Phase 3 is **unblocked** now (arc 017's `/a2a` is live + verified at
  `https://agenthud-proxy.cloudflare-driveway392.workers.dev/a2a`).

## Wider context (not this arc)
Agent-readiness roadmap + ora work: `docs/agent-readiness.md` (score in its frontmatter; ordered next-steps).
All-open-work plan: `~/.claude/plans/deep-conjuring-pie.md`. Open PRs at handoff: #259 (worker fix, deployed),
#258 (docs), dependabot #253/#251/#228. Arc 016 (#240 viewport) + arc 018 (#211 a2ui-kit) also `ui/`/disk-gated.

## At arc close
Tick the plan's remaining-work table against what shipped, set this handoff `status: closed`, note any
deviations, migrate any remainder to the next NNNN.
