---
plan: docs/plans/017-agent-native-discovery.md
issue: 255
status: open
updated: 2026-08-25
---

# Handoff — Agent-Native Discovery + Execution

Onboarding for the next session. Read `docs/plans/017-agent-native-discovery.md` in full first — it
carries the locked decisions, the verified **source map** (so you need not re-map), and the single
remaining-work table. This handoff is the "where we are / what's next / how to run it".

## What shipped this session (Track 1 — agenthud Worker, branch `feat/017-agent-native-discovery`)

Complete and **gate-green** (`typecheck` + `lint` + 71 tests) and **bundle-verified**
(`wrangler deploy --dry-run` → 173 KiB gzip, all bindings resolved, `nodejs_compat` OK):

- `GET /.well-known/agent-card.json` — static A2A card (`worker/src/wellknown/agent-card.ts`).
- `POST /mcp` — stateless MCP server via `createMcpHandler` (`worker/src/mcp/{server,tools}.ts`):
  tools `render_ui`, `validate_a2ui_batch`.
- `POST /a2a` — minimal A2A JSON-RPC (`worker/src/a2a/handler.ts`): `message/send` → completed Task.
- Shared render seam `worker/src/agent/render.ts` (`renderFromPrompt`); `validateBatch` added to
  `worker/src/agent/contract.ts` (`isValidBatch` now delegates).
- Routing in `worker/src/worker.ts` (`agentNativeRoute`, origin-bypass, `FREE_RATE_LIMITER`);
  `nodejs_compat` in `worker/wrangler.toml`; deps in `worker/package.json` (**dropped unused
  `agents`**; kept `@modelcontextprotocol/server` + `zod`).
- Tests: `worker/test/{mcp-tools,agent-card,a2a,agent-routes}.test.ts` + `contract.test.ts`
  `validateBatch` block. TDD Red-first for module logic; routing/origin-bypass by in-process test;
  transport by effect.
- Docs: `worker/README.md`, `docs/protocols.md`, `CHANGELOG.md` (`[Unreleased]`, **no version bump**),
  new `docs/decisions/0005-agent-native-endpoints.md`, `docs/README.md` index (added 0004 + 0005),
  `docs/UserStory.md` (US-11), root `README.md` + `docs/architecture.md` (brief mentions).

Also cleared this session: **Dependabot backlog 9 → 3** (merged #244/#247/#230/#254/#256; closed
#250/#248; left #253/#251 = worker-dep bumps to rebase AFTER this arc lands, and #228 = red CI).

## What's next (in order)

1. **Open the PR** for `feat/017` (if not already), CI green → **owner squash-merge** (this repo's
   convention is human merge; the GPG gotcha below may force `--admin`). This is the only Phase-1 gate.
2. **After merge:** rebase/sweep dependabot **#253 / #251** (they touch `worker/package.json`).
3. **Track 2 — origin-root discovery** (repo `qte77/qte77.github.io`, checked out at
   `/workspaces/qte77/qte77.github.io`). Per the `ora-readiness` scout: highest ROI is the Phase-1
   static cluster — fix llms.txt's 5 dead links **and add agenthud** (currently unmentioned) + a
   when-to-use section; `/index.md`; origin-level `/.well-known/agent-card.json` +
   `ai-catalog.json` + `agent-skills/index.json` + `mcp/server-card.json` (thin pointers to THIS
   Worker's `/a2a` + `/mcp`); robots AI-crawler tiers + Content-Signal + `schemamap:`; JSON-LD
   breadth; `/auth.md`; api-catalog; agent-friendly 404. **First `curl -I` the live site** — GitHub
   Pages can't set custom headers, so the Link-header/Vary checks may be capped. Re-scan
   (`POST https://ora.ai/api/scan {"url":"qte77.github.io"}`) after shipping to verify the lift
   (45 → plausibly mid-60s).
4. **Phase 1.5 — cheap Worker wins** (this repo, own PR): consistent JSON error envelope on the
   remaining plain-text error paths in `worker.ts` (ora `json-error-responses`, ~4 pts);
   `WWW-Authenticate` hint; document the keyless free tier as the "sandbox". OpenAPI at `/openapi.json`
   is the bigger Phase-2 item.
5. **Track 3 — estate baseline** (`qte77/qte77` hub) + the `dntywntme` hackathon repos + whether to
   use/enhance `qte77/a2ui-agui-kit`: pending the `estate-strategy` scout's report (owner-gated).

## Owner-gates (batch into one sitting)

- **PR review + merge** (agent PRs don't self-merge here).
- **Release** is separate + maintainer-owned: bump `ui/package.json` on `main` → auto-tag `vX.Y.Z` →
  `publish-release`. **Not part of this PR.**
- **Track 2/3** touch other repos — confirm access (both are checked out locally already).

## Commands

```bash
# CI gate (run before every push — the EXACT gate, not à la carte):
npm run typecheck --prefix worker && npm run lint --prefix worker && npm test --prefix worker
npm run deploy --prefix worker -- --dry-run --outdir /tmp/wr   # bundle check (no deploy)
# by-effect once running:  wrangler dev  → curl the card / an MCP tools/list / an A2A message/send
```

## Watch-outs (verified this session)

- `env -u GH_TOKEN -u GITHUB_TOKEN` on **every** git/gh call (else 401).
- `-c commit.gpgsign=false` on commits (no GPG secret key here); owner signs/`--admin`-merges the PR.
- `/workspaces` disk runs tight (~400 MB free) — no stray `npm install`/large clones; `agents` was
  pruned to reclaim space.
- Sandbox blocks Bash pipes / `;` / `&&` — one simple command per call; use `gh --json … --jq`.
- The A2A `/a2a` JSON-RPC wire shape follows the a2a-js transport (`kind` discriminators); it's
  verified by effect (curl), not against a strict validator — re-check if a real A2A client rejects it.
- **Origin-root files are NOT in this repo** — agenthud's `ui/public/` deploys to a subpath crawlers
  ignore; Track 2 must be done in `qte77/qte77.github.io`.

## At arc close

Tick the plan's remaining-work table against what merged, set this handoff `status: closed`, note any
deviations from the locked decisions (already noted: dropped `agents`; Content-Signal moved to Track 2),
and migrate any still-open rows to the next `NNNN` pair.
