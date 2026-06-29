# Plan 001 — Edge proxy go-live + CI release standardization

**Date:** 2026-06-29
**Open issues:** [#97](https://github.com/qte77/agenthud-agui-a2ui/issues/97) ·
[#102](https://github.com/qte77/agenthud-agui-a2ui/issues/102)

## Context

The BYOK edge proxy (`worker/`) is fully built, hardened, documented, and `--dry-run`-validated, but
**not deployed** — the only blocker on lighting up the two Live "(via proxy)" options. A second issue
tracks adopting the org's reusable release workflows. This plan prioritizes both plus the cheap
baseline-audit fixes.

## Open issues — ROI × feasibility

| Issue | ROI | Feasibility | Blocker | Effort |
|---|---|---|---|---|
| **#97** deploy proxy | Med–High — lights up 2 live options; built + validated | Easy once unblocked; ~10-line wiring | Maintainer runs 1 wrangler command (Claude's shell can't auth + sandbox blocks `.env`) | Tiny |
| **#102** reusable release workflows | Low–Med — DRY/maintenance; repo already has a working flow | Medium | Upstream `qte77/.github#33` must merge + actions allowlist needs `qte77/.github@<sha>` (baseline L1.05) | Medium |

## Clusters

- **A — Edge proxy go-live (#97):** deploy + wire. Self-contained; gated on one maintainer command.
- **B — CI / release standardization (#102):** org reusable workflows. Gated on an upstream PR + the
  actions allowlist; bundles with the baseline-audit CI quick-wins.

## Prioritized plan

### P1 — #97 deploy (ready now)

1. Maintainer: `cd worker && npx wrangler deploy --env=""` → capture the `…workers.dev` URL.
2. Set `PROXY_BASE` in `ui/src/LiveDashboard.tsx` to that URL.
3. Drop `experimental: true` from the two "(via proxy)" `ENDPOINTS` entries.
4. Re-probe both endpoints resolve + confirm the CORS allowlist covers the gh-pages origin.
5. Reconcile the URL in `worker/README.md` + `wrangler.toml`. One PR → closes #97.

### P2 — #102 release workflows (hold for dependency)

Cannot land cleanly until `qte77/.github#33` merges **and** the selected-actions allowlist permits
`qte77/.github@<sha>`. When ready: swap this repo's `tag-release.yaml`/`publish-release` for thin
callers (version from `package.json` via `version_regex`, publish from `CHANGELOG`), SHA-pinned,
honoring the **never-delete-tags** guardrail (deleted tag names are burned forever — HTTP 422
GH013). Skip the Python `bump`/`scriv` halves (this repo is non-Python). The callers can be
pre-drafted now.

### P3 — baseline-audit quick-wins (anytime, independent)

- `.github/dependabot.yml` labels `["dependencies","npm"]` → `["dependencies","typescript"]`.
- Add `.github/CODEOWNERS` (`* @qte77`).
- `.markdownlint.jsonc` `MD060`.
- (Bigger, separate) `noUncheckedIndexedAccess` in `ui/tsconfig.app.json`.

## References

- [Cloudflare / Wrangler runbook](../cloudflare-runbook.md) ·
  [ADR-0002](../decisions/0002-edge-proxy-platform.md) ·
  [worker/README](../../worker/README.md)
