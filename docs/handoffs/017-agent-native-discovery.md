---
plan: docs/plans/017-agent-native-discovery.md
issue: 255
status: open
updated: 2026-08-25
---

# Handoff — Agent-Native Discovery + Execution

> Delete-callout: nothing has been implemented yet. This is a pre-execution handoff from a
> planning-only session — treat it as onboarding, not a progress report.

## State at handoff (2026-08-25)

The plan (`docs/plans/017-agent-native-discovery.md`) was designed and approved in a separate
`qte77/qte77`-hub-rooted Claude Code session, via Plan Mode, after live-verifying the Cloudflare
Agents SDK and current MCP/A2A specs. Execution was then attempted from that same hub-rooted
session via background subagents and hit avoidable friction: the orchestrating session didn't
initially realize this repo was already locally checked out at
`/workspaces/qte77/agenthud-agui-a2ui`, so subagents created redundant clones/worktrees
elsewhere (`/tmp`, then `/workspaces/agenthud-agui-a2ui-base`), one of which ran a full
`npm install` (334 packages) that contributed to `/workspaces` filling up (30G/32G, 0 free),
which then hard-blocked `git fetch`/`git worktree add`. No source files were written and no
commits were made anywhere as a result — the plan and this handoff are the first real artifacts
of this arc.

This session is being wrapped up in favor of starting fresh **directly in this repo directory**
— no more cross-repo orchestration overhead needed for work that's entirely scoped to this repo.

## How to handle the plan (order)

Read `docs/plans/017-agent-native-discovery.md` in full — it has the locked owner decisions,
source map, and phase-by-phase steps. Follow Phase A steps 1-9 in order (step 0's docs are this
commit). Don't re-derive the owner decisions — they were verified live against current specs
this session (Cloudflare docs, MCP spec, A2A proto) and are correct as written.

## First actions on resume

1. `df -h /workspaces` — confirm disk space is actually free. This was the hard blocker last
   session; a cleanup pass was started but its completion was not confirmed before this session
   ended. Don't assume it's fine.
2. `git status` + `git branch --show-current` in this checkout — should be clean, on `main`.
3. Check for and remove stale state from the aborted attempt, if present: `git worktree list`
   here; and separately check whether `/workspaces/agenthud-agui-a2ui-base`,
   `/workspaces/agenthud-agui-a2ui-016`, `/workspaces/agenthud-agui-a2ui-017` still exist. Before
   deleting any of them, check each branch for commits not on `main`
   (`git log <branch> ^main --oneline`) — if empty, safe to delete; if not, something was
   committed that needs to be recovered first.
4. Decide worktree-vs-direct: the plan assumes a `git worktree add` setup for isolation from a
   concurrent orchestrator session. If this is now a single session working directly in this
   repo, working directly here (no separate worktree) is simpler and fine — worktrees mattered
   for avoiding collisions between concurrent sessions/agents, which may no longer apply.
5. Open the GitHub Issue for this arc (none exists yet), reference it in this handoff's and the
   plan's `issues:` frontmatter, then proceed through Phase A steps 1-9.

## Working style

Strict TDD RED-first for the two MCP tool handlers' logic and the agent-card shape assertion —
not for `worker.ts` routing wiring, `wrangler.toml` config, or the MCP transport/DO-absence
itself, which this repo's own `AGENTS.md` says to verify by effect. Run the real CI gate
(`npm run typecheck && npm run lint && npm test` in `worker/`) before every push, never
à la carte.

## Owner-gates (pre-staged; batch into one sitting)

Just one: PR review + merge. This repo's own convention (confirmed in prior arcs' handoffs) is
that agent-authored PRs cannot self-merge — human merge only, whenever this is ready.

## Gotchas (the unattended tax + arc-specific traps)

- `env -u GH_TOKEN -u GITHUB_TOKEN` prefix on every single `git`/`gh` call — bare `gh` hit `401`
  repeatedly last session; both vars shadow the real credential.
- **No GPG secret key is available in this environment**, despite `commit.gpgsign=true` being
  set globally — commits need `-c commit.gpgsign=false`; the owner will need to sign or
  `--admin`-merge the PR later. Confirmed via `gpg --list-secret-keys` returning empty.
- `isAllowedOrigin()` in `router.ts` returns `false` on a `null` Origin and is checked
  immediately after the "non-POST → 405" gate, before the `/agent/render` branch — insert the
  `/mcp` origin-bypass at that exact point, not vaguely "after the existing gates."
- Watch `/workspaces` disk usage (`df -h`) before large `npm install`s — it filled to 100% last
  session. A tiered cleanup tool exists at `/workspaces/disk-cleanup.sh` if needed again.
- This repo is already checked out at this exact path — never re-clone it. If worktreeing for
  isolation, worktree off *this* checkout, not a fresh clone.
- No version bump in this PR — that's a separate, maintainer-owned release PR per this repo's
  `.github/CONTRIBUTING.md`.

## At arc close (mine, then prune)

Once merged and Phase C's live verification passes: update this handoff's `status` to `closed`,
tick the plan's Phase A checklist against what actually shipped, and note any deviations from
the locked owner decisions. The plan's "Roadmap beyond this arc" table becomes the seed for
whichever arc number comes next.
