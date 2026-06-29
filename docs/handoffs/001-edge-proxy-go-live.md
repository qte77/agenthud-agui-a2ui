---
date: 2026-06-29
status: done
issues: [97]
plan: plans/001-edge-proxy-go-live.md
title: Handoff 001 — Edge proxy go-live
description: Handoff state and next actions for deploying the BYOK edge proxy and wiring PROXY_BASE.
---

# Handoff 001 — Edge proxy go-live

> **Resolved 2026-06-29.** Deployed end-to-end from the dev container — the "Claude's shell can't
> run it" assumption was stale: `wrangler` auto-loads `worker/.env`, so no shell `source` was
> needed. `PROXY_BASE` in `ui/src/LiveDashboard.tsx` is wired to the live worker and the
> "(via proxy)" options are active. Closed by the PR for #97.

## State

The BYOK edge proxy (`worker/`) is **built, hardened, documented, and `--dry-run`-validated — but not
deployed**. The code is honest: `PROXY_BASE` is a placeholder and the two "(via proxy)" options are
flagged experimental. `main` is clean; nothing half-applied.

## The single next action (maintainer)

```bash
cd worker && npx wrangler deploy --env=""
```

Claude's shell can't run this — it's unauthenticated and the sandbox blocks sourcing `worker/.env`.
Then hand the resulting `…workers.dev` URL to Claude.

## Then (Claude → one small PR that closes #97)

1. Set `PROXY_BASE` in `ui/src/LiveDashboard.tsx` to the URL.
2. Drop `experimental: true` from the two "(via proxy)" options.
3. Re-probe both endpoints + the CORS allowlist (see the runbook).
4. Flip the US-6 / roadmap status to deployed.

## Open / deferred

- **#102** reusable release workflows — hold for `qte77/.github#33` + the actions allowlist.
- Baseline quick-wins — Dependabot labels, `CODEOWNERS`, `MD060` (independent, cheap).

## Pointers

- Full plan + ROI/feasibility: [plans/001-edge-proxy-go-live.md][plan-001]
- Deploy / auth / IaC / abuse: [docs/cloudflare-runbook.md][cloudflare-runbook]
- Why Cloudflare: [ADR-0002][adr-0002] ·
  Data flow: [architecture][architecture]
- CF skills installed: `cloudflare`, `wrangler`, `workers-best-practices`.

[plan-001]: ../plans/001-edge-proxy-go-live.md
[cloudflare-runbook]: ../cloudflare-runbook.md
[adr-0002]: ../decisions/0002-edge-proxy-platform.md
[architecture]: ../architecture.md
