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

[architecture]: architecture.md
[cloudflare-runbook]: cloudflare-runbook.md
[protocols]: protocols.md
[testing]: testing.md
[user-stories]: UserStory.md
[adr-0001]: decisions/0001-agent-runtime-stack.md
[adr-0002]: decisions/0002-edge-proxy-platform.md
