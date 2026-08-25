---
title: ADR-0005 — Agent-native endpoints on the Worker (A2A card + MCP server + A2A endpoint)
description: Decision to expose Discovery (A2A Agent Card) and Execution (stateless MCP server + minimal A2A JSON-RPC endpoint) on the existing edge Worker, wrapping the keyless render chain, using createMcpHandler (not McpAgent) with no Durable Object.
---

# ADR-0005 — Agent-native endpoints on the Worker

**Status:** Accepted (2026-08-25)
**Relates to:** arc 017 (#255) · [US-11][user-stories] · [ADR-0001][adr-0001] (agent runtime) ·
[ADR-0002][adr-0002] (edge proxy) · `docs/protocols.md` (MCP/A2A)

## Context

agenthud already renders A2UI from natural language (the keyless `/agent/render` chain: Cloudflare
Workers AI → OpenRouter `:free`) and validates batches structurally (`worker/src/agent/contract.ts`).
That capability was reachable only by the browser demo. To make agenthud **agent-discoverable and
agent-callable** (the Agent Native Builders Hackathon's Discovery + Execution + Agent-to-Agent
categories), it needs standard endpoints — an A2A **Agent Card**, an **MCP** server, and an **A2A**
task endpoint — without inventing new product capability. Both MCP tools and the A2A endpoint wrap
logic that already ships.

## Decision

Expose three unauthenticated, agent-facing routes on the **existing Worker** (not a new service),
each reusing the shared `renderFromPrompt` seam and the `contract.ts` validator:

- `GET /.well-known/agent-card.json` — a static A2A card; skills map 1:1 to the MCP tools,
  `supportedInterfaces` points at the live `/a2a`.
- `POST /mcp` — a **stateless** MCP server via `@modelcontextprotocol/server`'s **`createMcpHandler`**,
  tools `render_ui` + `validate_a2ui_batch`.
- `POST /a2a` — a minimal A2A JSON-RPC endpoint; `message/send` returns a **synchronously-completed
  Task** carrying the A2UI batch as a `data` artifact.

Key sub-decisions:

- **`createMcpHandler`, not `McpAgent`.** `McpAgent` (Cloudflare `agents` SDK) is deprecated and
  requires a Durable Object; both our tools are single-shot, so the stateless handler is the right
  fit. **`createMcpHandler` is exported by `@modelcontextprotocol/server`, not `agents`** — so the
  `agents` dependency was dropped as unused (it also pulled in the legacy `@modelcontextprotocol/sdk`).
- **No Durable Object / migration.** Consequence of stateless serving; the A2A endpoint completes
  synchronously, so it needs no task store either.
- **Honest A2A interface.** Rather than omit the (spec-required) interface or fabricate a task
  lifecycle we don't run, the card advertises the *real* `/a2a` endpoint — a minimal but genuine
  JSON-RPC surface.
- **Origin-bypass + shared `FREE_RATE_LIMITER`.** Programmatic agents send no `Origin`, so these
  routes branch before the browser origin allowlist; the execution endpoints share the AI-cost-bearing
  free limiter (not the generic relay limiter).

| Option | Discovery + Execution | New infra | Honest card | Verdict |
|---|---|---|---|---|
| **A2A card + MCP + A2A on the Worker, stateless (chosen)** | Yes | none (nodejs_compat only) | Yes (real /a2a) | ✅ |
| `McpAgent` + Durable Object | Yes (MCP) | DO + migration | — | ❌ deprecated, overkill for single-shot tools |
| Card only, omit interfaces / no execution | partial | none | ✗ (interface missing) | ◑ deferred earlier; superseded |
| Separate service for agent endpoints | Yes | new deploy | Yes | ❌ duplicates the render chain + ops |

## Consequences

- Four hackathon categories move on the *execution* side without new product capability; the two MCP
  tools + the A2A endpoint are thin adapters over `renderFromPrompt` + `validateBatch`.
- New runtime deps `@modelcontextprotocol/server` + `zod`; `compatibility_flags = ["nodejs_compat"]`
  added (mirrored under `[env.dev]`). Bundle ~173 KiB gzip. The 7 pre-existing `npm audit` highs are
  all wrangler dev-toolchain — these deps add none.
- **Origin-root Discovery is a separate concern:** crawlers/scanners probe `qte77.github.io`'s root
  (served by the `qte77/qte77.github.io` repo), not this Worker's origin nor agenthud's GH-Pages
  subpath — so `robots.txt`/Content-Signal and the origin-level well-known files must live there and
  *link* to this Worker. Tracked in `docs/plans/017-agent-native-discovery.md` (Track 2).
- Live MCP/A2A handshakes are verified by effect at deploy (the bundle + routing/origin-bypass are
  covered by tests + `wrangler deploy --dry-run`).

## References

- Endpoints: `worker/src/wellknown/agent-card.ts` · `worker/src/mcp/{server,tools}.ts` ·
  `worker/src/a2a/handler.ts` · wired in `worker/src/worker.ts` (`agentNativeRoute`).
- Shared render seam: `worker/src/agent/render.ts`; validator: `worker/src/agent/contract.ts`.
- Protocol reference: [protocols.md](../protocols.md) · runbook: [`worker/README.md`][worker-readme].

[user-stories]: ../UserStory.md
[adr-0001]: 0001-agent-runtime-stack.md
[adr-0002]: 0002-edge-proxy-platform.md
[worker-readme]: ../../worker/README.md
