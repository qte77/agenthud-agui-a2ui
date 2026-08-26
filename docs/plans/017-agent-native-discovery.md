---
title: Agent-Native Discovery + Execution (A2A Agent Card + MCP Server + A2A endpoint)
description: Make agenthud agent-discoverable and agent-callable (A2A card, MCP server, minimal A2A JSON-RPC endpoint) on the Worker, and seed origin-root discovery for the estate's hackathon / ora.ai agent-readiness push.
date: 2026-08-25
status: open
issues: [255]
predecessor: null
handoff: docs/handoffs/017-agent-native-discovery.md
---

# Arc 017 — Agent-Native Discovery + Execution

## Context

qte77 is applying to the **Agent Native Builders Hackathon** (6 categories: Discovery, Content, Trust,
Execution, Agent-to-Agent, Identity & Auth). Parallel signal: the **ora.ai / orank** scan of
`qte77.github.io` scores **45/100 (D)**. agenthud is the estate's strongest demo (live AG-UI + A2UI).

**Verified architecture fact that shapes everything** (confirmed empirically by the `ora-readiness`
scout this session): `qte77.github.io` is a **user site** served from a *different* repo
(`qte77/qte77.github.io`, Jekyll; checked out at `/workspaces/qte77/qte77.github.io`). agenthud deploys
to the **subpath** `qte77.github.io/agenthud-agui-a2ui/` (`ui/vite.config.ts:16`), and its Worker
(`agenthud-proxy.cloudflare-driveway392.workers.dev`) is a **third origin**. Because `robots.txt` and
`/.well-known/*` are only honored at the **origin root**, discovery files placed in agenthud's
`ui/public/` are invisible to crawlers/scanners that probe `qte77.github.io/…`. Live proof: the root
`robots.txt` has no Content-Signal, `/.well-known/agent-card.json` and `/index.md` 404, and the root
`llms.txt` has 5 dead links and never mentions agenthud.

So the work has **three homes** (owner chose "Both" + an honest real A2A endpoint):
- **Track 1 — agenthud Worker** (this repo): Execution + Agent-to-Agent. The MCP server, the A2A
  endpoint, and the A2A card. **This arc's PR.**
- **Track 2 — `qte77/qte77.github.io`** (separate repo, checked out locally): origin-root Discovery
  files (where ora's points are). Own branch/PR in that repo.
- **Track 3 — `qte77/qte77` hub**: a reusable estate baseline. Own effort.

## Owner decisions (locked, verified at source — 2026-08-25)

1. **`createMcpHandler` from `@modelcontextprotocol/server@2.0.0`, stateless, no Durable Object.**
   Verified in the installed `dist/index.d.mts`. Default `legacy:'stateless'` → GET/DELETE auto-405.
2. **DROP the `agents` dep** (plan-8 revision). `createMcpHandler` is NOT in `agents`; we use no
   `McpAgent`. `agents` was unused and pulled legacy `@modelcontextprotocol/sdk@1.30.0`. Keep only
   `@modelcontextprotocol/server ^2.0.0` + `zod ^4.4.0`.
3. **Add a minimal, honest A2A endpoint** (`POST /a2a`, JSON-RPC 2.0, stateless). `message/send` runs
   the render chain and returns a synchronously-**completed Task**; other methods → `-32601`. This
   makes the card's `supportedInterfaces` real (points at `/a2a`), resolving the proto-requires-
   interfaces tension honestly and closing Agent-to-Agent.
4. **Card advertises real endpoints.** `supportedInterfaces:[{transport:"JSONRPC",url:<worker>/a2a}]`;
   skills 1:1 with the MCP tools; `documentationUrl` → `https://qte77.github.io/agenthud-agui-a2ui/`.
   Served by the Worker at `GET /.well-known/agent-card.json` (origin+rate bypass, wildcard CORS).
5. **No new env vars.** `render_ui` + `/a2a` reuse `AI`/`OPENROUTER_KEY`/`OPENROUTER_FREE_MODELS`
   (Workers AI first → OpenRouter `:free`). Not Turnstile-gated (not browser-facing).
6. **`/mcp` + `/a2a` routing:** POST-only (existing 405 gate is spec-correct), **origin-bypass**
   inserted **before** `isAllowedOrigin` (`worker.ts:174`), each shares **`FREE_RATE_LIMITER`**.
7. **Content-Signal / robots / well-known move to Track 2** (origin root), NOT agenthud (corrects the
   original decision 9 — agenthud's subpath robots.txt is ignored by crawlers).
8. **ADR is 0005** (0002–0004 already exist). **No version bump** in this PR (maintainer-owned release).

## 🗺️ Source map (verified this session — the next session must NOT re-map)

### Files to modify
- `worker/src/worker.ts` — single default `fetch(request, env)` handler (lines 164-199). Current gate
  order: OPTIONS→204 (`:169`) · non-POST→405 (`:170`) · `isAllowedOrigin`→403 (`:174`) · `RATE_LIMITER`
  (`:178`) · pathname (`:186`) · `/agent/render` branch (`:190`) · `resolveUpstream`/forward (`:192`).
  Insert: (a) after OPTIONS, before 405 — `if (method==="GET" && pathname==="/.well-known/agent-card.json")
  return agentCardResponse(request)`; (b) after 405, before `isAllowedOrigin` — `if (pathname==="/mcp")
  return mcpFetch(request, env)` and `if (pathname==="/a2a") return a2aFetch(request, env)` (each does
  its own `FREE_RATE_LIMITER` check internally, mirroring `handleKeylessRender` lines 76-80).
- `worker/src/router.ts` — `Env` interface (`:23-42`, has `AI`, `OPENROUTER_KEY`, `OPENROUTER_FREE_MODELS`,
  `FREE_RATE_LIMITER`), `isAllowedOrigin` (`:59`), `corsHeaders` (`:64`). Reuse as-is.
- `worker/src/agent/contract.ts` — internal `buildBatchGraph`/`allRefsDefined`/`hasCycle`/`extractChildIds`
  (module-private), public `isValidBatch` (`:84`). **Add** `validateBatch(batch:unknown):{valid,issues}`
  reusing those internals; make `isValidBatch` delegate (`return validateBatch(batch).valid`).
- `worker/wrangler.toml` — add `compatibility_flags=["nodejs_compat"]` top-level (after `compatibility_date`
  `:8`) AND a `[env.dev]` block with the same (named envs don't inherit; `[env.dev.vars]`/`[env.dev.ai]`
  already exist at `:58`/`:64`).
- `worker/package.json` — `dependencies`: add `@modelcontextprotocol/server ^2.0.0`, `zod ^4.4.0`;
  do NOT add `agents`. Scripts `typecheck`/`lint`/`test` are the CI gate (`:10-12`).

### Reused signatures (read; do not re-read)
- `providers.ts`: `buildProviders({ai,openRouterKey,openRouterFreeModels}):Provider[]` (`:123`),
  `renderFree(providers,{messages,signal}):Promise<{result:ModelResult;provider}|null>` (`:111`).
- `model.ts`: `ChatMessage{role,content}` (`:14`), `ModelResult{batch:unknown[];model}` (`:27`).
- `prompts.ts`: `SYSTEM_PROMPT` (`:27`).
- `worker.ts`: `handleKeylessRender` (`:75`) is the reference wrapper for the render chain + FREE limiter.

### MCP SDK API (verified in node_modules/@modelcontextprotocol/server/dist/*.d.mts)
- `import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"`.
- `new McpServer({ name, version })`.
- `server.registerTool(name, { title?, description?, inputSchema: <zod object>, outputSchema? }, (args, ctx) => CallToolResult)`.
- `CallToolResult = { content: [{type:"text", text}], structuredContent?, isError? }`.
- `createMcpHandler((ctx)=>McpServer, options?): McpHttpHandler`; call via `handler.fetch(request)`.
  (Also available for later: `requireBearerAuth`, `oauthMetadataResponse`, `WebStandardStreamableHTTPServerTransport` — Workers-native.)

### A2A shapes (verified against a2a.proto; JSON-RPC wire shape TO CONFIRM before coding a2a/handler.ts)
- AgentCard required: `name, description, supported_interfaces, version, capabilities,
  default_input_modes, default_output_modes, skills`; optional `provider, documentation_url, icon_url`.
- AgentSkill required: `id, name, description, tags`. AgentProvider: `url, organization`.
  AgentCapabilities: `streaming?, push_notifications?, extensions?`.
- TaskState enum: submitted/working/completed/failed/canceled/input-required/rejected/auth-required.
- **Watch-out:** the proto is gRPC/HTTP+JSON (`oneof` parts, no `kind`); the **JSON-RPC transport**
  (`transport:"JSONRPC"`, a2a-js SDK) uses `kind` discriminators + method `message/send`. Confirm the
  exact JSON-RPC envelope (Message/Part/Task/Artifact `kind` fields) against a2a-js types via polyfetch
  before writing `a2a/handler.ts`.

### New files (Track 1)
- `worker/src/mcp/tools.ts` — `runRenderUi(env,{prompt}):Promise<ToolResult>`,
  `runValidateBatch({batch}):ToolResult`, `ToolResult{content,structuredContent?,isError?}`, + zod schemas.
- `worker/src/mcp/server.ts` — `buildMcpServer(env)`, `mcpFetch(request,env)`.
- `worker/src/a2a/handler.ts` — `a2aFetch(request,env)` + pure helpers `extractPromptFromMessage`,
  `buildCompletedTask`, JSON-RPC error shaping.
- `worker/src/wellknown/agent-card.ts` — `buildAgentCard(selfOrigin)`, `agentCardResponse(request)`.
- Tests: `worker/test/{mcp-tools,agent-card,a2a}.test.ts` + `validateBatch` block in `contract.test.ts`.

## Tests (strict RED-first; modules only — routing/transport/config verified by effect)

- `contract.test.ts::validateBatch` — valid/no-issues, non-array, missing-root, dangling, cycle,
  isValidBatch-delegation. **(DRAFTED, RED.)**
- `mcp-tools.test.ts` — `runRenderUi` happy (fake `AI` binding) + exhausted→isError; `runValidateBatch`
  valid / invalid-with-issues (not isError) / malformed-non-array→isError. **(DRAFTED, RED.)**
- `a2a.test.ts` — `extractPromptFromMessage`, `buildCompletedTask` shape (completed + data artifact),
  unknown method → -32601.
- `agent-card.test.ts` — shape-only: skills ⊇ {render_ui, validate_a2ui_batch}, provider/capabilities
  present, `supportedInterfaces[0].url` ends `/a2a`; `agentCardResponse` → 200 + wildcard CORS.
- **By effect:** `wrangler dev` + curl the card, an MCP `tools/list`+`tools/call render_ui` handshake,
  an A2A `message/send` → completed Task with `a2uiMessages`.

## Docs audit (answers the recurring question — all in THIS PR)

| Doc | Update |
|-----|--------|
| `worker/README.md` | document the 3 new routes (authoritative route doc) |
| `docs/protocols.md` | flip "MCP/A2A not yet wired"; add AgentCard + tools + A2A note |
| `CHANGELOG.md` | `[Unreleased]`: 3 routes + drop-`agents`; **no version bump** |
| `docs/decisions/0005-*.md` | NEW ADR: createMcpHandler-over-McpAgent, stateless-no-DO, honest-A2A-interface, dropped-`agents` |
| `docs/README.md` | index ADR-0005 (+ fix the already-missing ADR-0004 link) |
| `docs/UserStory.md` | new agent-as-consumer story |
| root `README.md` / `architecture.md` | add the routes IF they enumerate routes (check during impl) |
- **URL/env/CLI:** 3 new **URLs** (`/.well-known/agent-card.json`, `/mcp`, `/a2a`); **NO new env vars**;
  no new CLI switches. **Issues:** #255 tracks (close on merge).

## Cross-repo & follow-on (Tracks 2/3 + ora phases — pointers, not this PR's code)

- **Track 2 (origin-root, `qte77/qte77.github.io`, local):** per `ora-readiness` — fix llms.txt dead
  links + add agenthud + when-to-use; `/index.md`; origin `/.well-known/agent-card.json` +
  `ai-catalog.json` + `agent-skills/index.json` + `mcp/server-card.json` (thin pointers to the Worker);
  robots AI-crawler tiers + Content-Signal + schemamap; JSON-LD breadth; `/auth.md`; api-catalog;
  agent-friendly 404. **Verify GH-Pages header limits with `curl -I` first** (Link-header checks may be capped).
- **Phase 1.5 (cheap Worker wins, THIS repo):** JSON error envelope shipped (PR #259 — 405/403 on the
  BYOK relay + agent-native routes; only the `/<provider>` 404 stays plain text); `WWW-Authenticate`
  hint and the keyless-tier "sandbox" doc note remain open (the latter now partly covered by
  `worker/README.md`'s new "Keyless free-inference render" section). OpenAPI spec (`/openapi.json`)
  = Phase 2, M.
- **Track 3 (`qte77/qte77` hub):** estate baseline template — pending `estate-strategy` scout.

## Shipped (Track 1 + Track 2)

Rows 1-11 of the original table are done: the agent-native MCP/A2A/card endpoints on the Worker
(Track 1) shipped in PR #257 (closes #255) — verified live per `docs/agent-readiness.md`. Track 2
origin-root discovery files shipped in the separate `qte77/qte77.github.io` repo, per
`docs/agent-readiness.md`'s own record (PR #55 there).

## Remaining-work table (SINGLE source of open work)

| # | Item | Track | Gate | Done-when |
|---|------|-------|------|-----------|
| 12 | Phase 1.5 remainder: `WWW-Authenticate` hint on 401/403; keyless-tier sandbox doc | 1→next | agent | ora rescan; own PR |
| 13 | Track 3 estate baseline in `qte77/qte77` | 3 | owner | per estate-strategy scout |
| 14 | Dependabot: squash #254/#247/#244/#230; close #250/#248; #228 CI-fix | x | owner | 0 stale dependabot branches |

## Verification (end-to-end)
- **Track 1 local:** `cd worker && npm run typecheck && npm run lint && npm test` (RED→GREEN); then
  `wrangler dev` + curl the card + MCP `tools/list`/`tools/call` + A2A `message/send`.
- **Deployed (Phase C):** re-run curls vs the live Worker; **polyfetch** for the deployed UI
  (console/DOM/aria/screenshots) per its USING.md.
- **Track 2:** `POST https://ora.ai/api/scan {"url":"qte77.github.io"}` → `GET .../api/score/...`; expect ↑.
- **Gotchas:** `env -u GH_TOKEN -u GITHUB_TOKEN` on every git/gh; `-c commit.gpgsign=false` (no secret
  key); `/workspaces` disk ~400 MB free — no big installs; sandbox blocks Bash pipes/compound.
