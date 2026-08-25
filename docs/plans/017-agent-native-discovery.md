---
title: Agent-Native Discovery + Execution (A2A Agent Card + MCP Server)
description: Add a static A2A agent card and a real MCP server to close Discovery/Execution/partial-Trust categories for the Agent Native Builders Hackathon
date: 2026-08-25
status: open
issues: [255]
predecessor: null
handoff: docs/handoffs/017-agent-native-discovery.md
---

# Arc 017 — Agent-Native Discovery + Execution

> Designed in a `qte77/qte77`-rooted planning session (Plan Mode), not yet executed. Read the
> handoff first — it has the actual resume steps and this session's environment gotchas.

## Context

qte77 is applying to the "Agent Native Builders Hackathon" (Luma), judged on six categories:
Discovery, Content, Trust, Execution, Agent-to-Agent, Identity & Auth. This repo is the
strongest submission candidate in the qte77 estate — the only repo with a live, running
agent-native demo (AG-UI event streaming + A2UI UI composition) rather than internal tooling.
A static A2A Agent Card (Discovery) plus a real MCP server (Execution) closes 4 of 6 categories
on the existing architecture without inventing new product capability — both new MCP tools wrap
logic that already ships today.

**Explicitly OUT of scope this arc** (deferred, don't build or stub): WebMCP, Web Bot Auth
signing, OAuth Authorization Server / device grant, live A2A task-lifecycle message exchange
beyond the static card. See "Roadmap beyond this arc" below.

## Owner decisions (locked, verified live against current specs/docs — 2026-08-25)

1. **Use `createMcpHandler` (stateless), not `McpAgent`.** `McpAgent` is deprecated and
   feature-frozen per Cloudflare's current docs. `createMcpHandler` needs no Durable Object —
   both planned tools are stateless single-shot calls.
2. **No Durable Object / migration in `wrangler.toml`.** Consequence of (1). Instead add
   `compatibility_flags = ["nodejs_compat"]` (confirm the current file doesn't already have it),
   duplicated under `[env.dev]` (this repo's bindings don't inherit into `env.dev`).
3. **`/mcp` needs no pre-405 routing bypass.** MCP spec 2026-07-28 made Streamable HTTP
   POST-only (GET/DELETE stream removed) — the existing "non-POST → 405" gate in `worker.ts`
   already produces spec-correct behavior for free. Add `/mcp` as a new POST-only branch
   alongside the existing `/agent/render` branch.
4. **Agent-card GET route bypasses the origin-allowlist + rate-limit, with wildcard CORS.**
   Public, unauthenticated discovery document — crawlers won't reliably send an `Origin` header.
5. **`/mcp` should NOT require an `Origin` header.** Confirmed this session:
   `isAllowedOrigin()` in `router.ts` returns `false` on a `null` origin and is checked
   immediately after the "non-POST → 405" gate, before the `/agent/render` branch — the `/mcp`
   route's origin-bypass must be inserted at that exact check point.
6. **`/mcp` shares `FREE_RATE_LIMITER` (10/60s), not the generic `RATE_LIMITER`.** `render_ui`
   wraps the same AI-cost-bearing generation path as the existing keyless `/agent/render`.
7. **Agent card omits `supportedInterfaces` this arc.** Publishing an A2A interface entry
   implies a real task-lifecycle endpoint exists; it doesn't yet. Populate
   `skills`/`capabilities`/`defaultInputModes`/`defaultOutputModes` instead.
8. **Dependencies:** `agents` (^0.21.0 — reconfirm current version), `@modelcontextprotocol/server`
   (^2.0.0), `zod` (^4.0.0). NOT `@modelcontextprotocol/sdk` (legacy v1, deprecated path).
9. **Fold in a `Content-Signal:` robots.txt line (Trust category).** One static line, e.g.
   `Content-Signal: ai-input=yes, ai-train=no`, matching `sfclarity.com` (another qte77
   property). Belongs on `ui/public/robots.txt` (create if it doesn't exist) — the GH Pages
   origin, where the crawlable UI content lives, not the Worker.

## 🗺️ Source map (verified this session)

- `worker/src/worker.ts` — single `fetch()` handler, no router framework. Two insertion
  points: (1) right after OPTIONS→204, before "non-POST→405": `GET /.well-known/agent-card.json`.
  (2) alongside the existing `/agent/render` branch: `POST /mcp`.
- `worker/src/router.ts` (~73 lines) — `resolveUpstream()`, `UPSTREAMS`, `isAllowedOrigin`/
  `corsHeaders`, `Env` interface (~lines 23-42).
- `worker/wrangler.toml` (~64 lines) — add `compatibility_flags`. No DO/migrations needed.
- `worker/package.json` — add the 3 deps above; existing `typecheck`/`lint`/`test` scripts
  become the CI gate.
- `worker/src/agent/providers.ts`, `worker/src/agent/contract.ts` — read exact exported
  signatures before writing `worker/src/mcp/tools.ts`'s wrappers.
- `docs/protocols.md` — flip "MCP/A2A ... not yet wired in"; add an AgentCard v1.0 shape note.

New files: `worker/src/wellknown/agent-card.ts` (`buildAgentCard(env)` + `agentCardResponse`),
`worker/src/mcp/tools.ts` (`renderUiTool` wraps `handleKeylessRender()`'s path,
`validateA2uiBatchTool` wraps `contract.ts`), `worker/src/mcp/server.ts` (wires both via
`createMcpHandler`).

## Phase plan (non-blocked A/B/C)

**Phase A:**
0. Scaffold: open a tracking Issue, this plan + its handoff (this commit).
1. Read `router.ts`'s `isAllowedOrigin` (already confirmed, see decision 5) +
   `providers.ts`/`contract.ts`'s real exported signatures.
2. Add deps, `npm install`, `npm run typecheck`.
3. TDD RED-first: `worker/test/mcp-tools.test.ts` + `worker/test/agent-card.test.ts` before
   implementing.
4. Implement `agent-card.ts`, `mcp/tools.ts`, `mcp/server.ts`, the two `worker.ts` insertion
   points, `wrangler.toml`'s `nodejs_compat` flag, and `ui/public/robots.txt`'s Content-Signal
   line.
5. Update `docs/protocols.md` AND `worker/README.md` (the repo's authoritative doc for the
   proxy's routes, per the main `README.md`'s pointer — the two new routes belong there, not
   just in protocols.md); add a `CHANGELOG.md` entry under `[Unreleased]` (no version bump).
   Consider a new ADR (`docs/decisions/0002-*.md`, alongside the existing `0001-agent-runtime-
   stack.md`) documenting the `createMcpHandler`-over-`McpAgent` decision and why — it's the
   same class of decision-with-rationale that pattern exists for. Consider a short addition to
   `docs/UserStory.md` for the new audience this arc introduces: an *agent* consuming this site
   via MCP/A2A, distinct from the existing human Demo/Live-tier user stories.
6. `npm run typecheck && npm run lint && npm test` in `worker/`.
7. Verify by effect: `wrangler dev`, curl the agent-card, MCP Streamable HTTP handshake against
   `/mcp`.
8. Update this plan + its handoff with actual outcome.
9. Commit, push, open a PR — do not merge (human merge only, this repo's own convention).

**Phase B:** owner reviews + merges the PR. **Phase C:** verify against the live deployed
Worker URL; optionally run through ora.ai's agent-readiness scanner as an external proof point.

## Verification

- `mcp-tools.test.ts`: `renderUiTool` happy path + provider-chain-exhausted (`isError: true`).
  `validateA2uiBatchTool`: valid → `{valid:true}` no `isError`; invalid (dangling-ref/cycle) →
  `{valid:false, issues}` no `isError` (a successful call, not a tool error); malformed → `isError:true`.
- `agent-card.test.ts`: shape-only assertions, no new JSON-Schema dependency.
- No unit tests for routing wiring or MCP transport — verified by effect
  (`wrangler dev` + curl + real MCP handshake).

## Roadmap beyond this arc (100% hackathon-category fit, NOT built here)

| Category | Gap | Where |
|---|---|---|
| Agent-to-Agent | Live A2A task lifecycle (`message/send`, `tasks/get`) | new `/a2a` route, this repo |
| Identity & Auth | OAuth Protected-Resource + AS Metadata, real token issuance | this repo, gating `/mcp` |
| Trust (remainder) | Web Bot Auth — verify incoming signed bot requests | this repo |
| Execution (extra) | WebMCP (`document.modelContext`) | `ui/`, this repo |

Estate-wide (not this repo): `sfclarity.com` needs the same Discovery layer this arc builds
(smaller follow-on once this pattern exists); `office-forge-orchestrator` has real OAuth-documented
MCP client integrations but is a consumer, not an issuer.
