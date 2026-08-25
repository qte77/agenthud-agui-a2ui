---
title: Documentation index
description: Single-source-of-truth index linking every doc in the project.
---

# Documentation

Single source of truth: each topic lives in one doc — link, don't duplicate.

- [Architecture][architecture] — end-to-end data flow (app → edge proxy → LLM), ours vs theirs
- [Cloudflare / Wrangler runbook][cloudflare-runbook] — deploy, auth, IaC, rate-limit, abuse model
- [Agentic Protocols][protocols] — AG-UI, A2UI, MCP, A2A reference
- [Testing][testing] — test-layout convention (co-location)
- [User Stories][user-stories] — acceptance criteria and status
- [ADR-0001: Agent runtime stack][adr-0001] — TS-only, BYOK in-browser
- [ADR-0002: Edge proxy platform][adr-0002] — Cloudflare Workers (vs Supabase / Vercel)
- [ADR-0003: Live-agent catalog instruction][adr-0003] — curated prompt reference (vs schema injection)
- [ADR-0004: Self-contained replay snapshots][adr-0004] — re-emit a self-contained surfaceUpdate per step
- [ADR-0005: Agent-native endpoints][adr-0005] — A2A card + MCP server + A2A endpoint on the Worker

## Plans & handoffs

Per-change working docs live in `plans/` and `handoffs/`, paired **1:1** by a shared `NNN-slug.md`
filename (e.g. `plans/010-unify-demo-live-surface.md` ↔ `handoffs/010-unify-demo-live-surface.md`) and
cross-linked via frontmatter — the plan carries `handoff: handoffs/NNN-slug.md`, the handoff carries
`plan: plans/NNN-slug.md`, and both mirror `status`/`issues`. A plan is the design + source map; its
handoff is where to start + how to hand it off. Add both together; keep the numbers in lockstep.

[architecture]: architecture.md
[cloudflare-runbook]: cloudflare-runbook.md
[protocols]: protocols.md
[testing]: testing.md
[user-stories]: UserStory.md
[adr-0001]: decisions/0001-agent-runtime-stack.md
[adr-0002]: decisions/0002-edge-proxy-platform.md
[adr-0003]: decisions/0003-live-catalog-instruction.md
[adr-0004]: decisions/0004-self-contained-replay-snapshots.md
[adr-0005]: decisions/0005-agent-native-endpoints.md
