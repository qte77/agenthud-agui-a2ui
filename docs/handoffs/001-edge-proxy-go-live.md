---
date: 2026-06-29
status: blocked-on-deploy
issues: [97]
plan: plans/001-edge-proxy-go-live.md
---

# Handoff 001 — Edge proxy go-live

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

- Full plan + ROI/feasibility: [plans/001-edge-proxy-go-live.md](../plans/001-edge-proxy-go-live.md)
- Deploy / auth / IaC / abuse: [docs/cloudflare-runbook.md](../cloudflare-runbook.md)
- Why Cloudflare: [ADR-0002](../decisions/0002-edge-proxy-platform.md) ·
  Data flow: [architecture](../architecture.md)
- CF skills installed: `cloudflare`, `wrangler`, `workers-best-practices`.
