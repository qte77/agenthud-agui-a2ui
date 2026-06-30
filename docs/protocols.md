---
title: Agentic Protocols — Reference
description: Concise reference for AG-UI, A2UI, MCP, and A2A and how they stack for this project.
---

# Agentic Protocols — Reference

Concise notes on the protocols this project sits on (**AG-UI**, **A2UI**) and the
adjacent agent-interaction stack (**MCP**, **A2A**, …). As of June 2026.

## TL;DR — how they stack

The four core protocols are complementary **layers**, not competitors. A single agent
run can use all four at once.

```text
USER / BROWSER
  └─ A2UI    — the declarative UI the agent composes (catalog components, no code)
AG-UI        — real-time event stream (tokens, tool calls, state, A2UI surfaces) agent <-> app
AGENT LOGIC  — LLM + orchestration (Vercel AI SDK / Google ADK / LangGraph …)
  ├─ A2A     — agent <-> agent: discovery (AgentCard) + task delegation
  └─ MCP     — agent <-> tools / resources / prompts
```

- **MCP** = what the agent can *do and know* (tools/data)
- **A2A** = how agents *collaborate* (delegate tasks)
- **AG-UI** = how the agent *talks to the app* in real time
- **A2UI** = what *UI the agent composes* inside that stream

| Protocol | Layer | Creator | Transport | Status (mid-2026) |
|---|---|---|---|---|
| **MCP** | agent ⇄ tools | Anthropic → Linux Foundation | Streamable HTTP, JSON-RPC 2.0 | Mature; de-facto standard |
| **A2A** | agent ⇄ agent | Google → Linux Foundation | HTTP + JSON-RPC 2.0 / SSE | Production; 150+ orgs |
| **AG-UI** | agent ⇄ frontend | CopilotKit | HTTP POST + SSE | Active; widely adopted |
| **A2UI** | agent ⇄ UI payload | Google | transport-agnostic (often AG-UI) | Candidate (v1.0); early-stage |

## MCP — Model Context Protocol

- **What / who:** Anthropic (Nov 2024); donated to the Linux Foundation's Agentic AI
  Foundation (Dec 2025). Spec is date-versioned (`2025-06-18`). "USB-C for AI."
- **Reasoning:** every app rebuilt bespoke connectors to each tool/data source; MCP is
  one interface that any host and any server implement once and reuse everywhere.
- **Goals:** stateful, secure, discoverable agent↔tool connectivity with capability negotiation.
- **Use cases:** read files/DBs (Resources), call functions (Tools), inject templates (Prompts).
- **Example** — a `tools/call` request:

  ```json
  {"jsonrpc":"2.0","id":1,"method":"tools/call",
   "params":{"name":"create_issue","arguments":{"title":"Fix login bug","project":"PROD"}}}
  ```

- **Relation:** the tools layer; orthogonal to A2A (agents). The Vercel AI SDK aligns its
  tool schema to MCP (`inputSchema` / `outputSchema`).

## A2A — Agent2Agent

- **What / who:** Google (Apr 2025); Linux Foundation (Jun 2025). Spec v0.3.0. Apache-2.0.
- **Reasoning:** agents in different frameworks/vendors could not discover or delegate to
  one another safely without custom glue.
- **Goals:** cross-vendor discovery + secure asynchronous task delegation (minutes→days).
- **Use cases:** enterprise multi-agent orchestration (HR bot → coding agent → analyst),
  supply chain, IT-ops automation.
- **Key bits:** an **AgentCard** at `/.well-known/agent-card.json` declares
  capabilities/auth; task lifecycle is
  `submitted → working → input/auth-required → completed | failed | canceled`.
- **Example** — a task response:

  ```json
  {"jsonrpc":"2.0","id":1,"result":{"id":"225d…","status":{"state":"submitted"},"kind":"task"}}
  ```

- **Relation:** agent↔agent; complements MCP. IBM's ACP merged into A2A (Aug 2025). Can
  carry A2UI payloads as task artifacts.

## AG-UI — Agent-User Interaction

- **What / who:** CopilotKit (`ag-ui-protocol`), Apache-2.0, early 2025. Framework-agnostic;
  25+ event types.
- **Reasoning:** no standard existed for streaming agent tokens, tool progress, state, and
  generative UI to a frontend — every framework had a bespoke format.
- **Goals:** standardize the agent↔app event stream: token deltas, tool calls, shared-state
  sync (snapshot + JSON-Patch deltas), human-in-the-loop, and carrying A2UI surfaces.
- **Use cases:** streaming chat with live tool visibility, copilots, generative-UI surfaces,
  state-synced apps.
- **Transport:** the frontend POSTs prompt + current state, then listens on an SSE stream.
- **Events:** lifecycle `RUN_*` / `STEP_*`; text `TEXT_MESSAGE_*`; tools
  `TOOL_CALL_START/ARGS/END/RESULT`; state `STATE_SNAPSHOT` / `STATE_DELTA`; plus `CUSTOM`,
  `INTERRUPT`, reasoning.
- **Example** — an SSE stream:

  ```text
  data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}
  data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"Hello"}
  data: {"type":"TOOL_CALL_START","toolCallId":"tc1","toolName":"search_web"}
  data: {"type":"TOOL_CALL_ARGS","toolCallId":"tc1","delta":"{\"q\":\"…\"}"}
  data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}
  ```

- **Relation:** sits above MCP (tool detail collapses into `TOOL_CALL_*`) and A2A; carries
  A2UI payloads, often as `CUSTOM` events.

## A2UI — Agent-to-UI

- **What / who:** Google; v0.9 → **v1.0 Candidate** (a2ui.org), Apache-2.0. Reference
  renderers for React (`@a2ui/react`), Flutter, Angular, Lit. **Early-stage — the API and
  message schema may still change.**
- **Reasoning:** agents could only return text or fixed widgets; server-rendered generative
  UI (e.g. `streamUI`) coupled the agent to the frontend framework and executed arbitrary code.
- **Goals:** framework-agnostic generative UI that is **safe by catalog-restriction** — the
  agent may only reference known component types, so no code runs on the client — using
  LLM-friendly streaming JSON.
- **Use cases:** agent-driven dashboards, dynamic forms, contextual cards/tables; native web,
  mobile, desktop.
- **Messages:** `createSurface` (declares the trusted `catalogId`), `updateComponents`,
  `updateDataModel`.
- **Example** — a JSONL stream:

  ```jsonl
  {"createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/…/basic_catalog.json"}}
  {"updateComponents":{"surfaceId":"main","components":[{"id":"c1","type":"Card","props":{"title":"Order #4821"}}]}}
  {"updateDataModel":{"surfaceId":"main","path":"/order/status","value":"shipped"}}
  ```

- **Relation:** a transport-agnostic payload, usually delivered over AG-UI. The client's
  catalog maps `"Card"` → a native widget; unknown types are rejected.

### What this project implements (v0.8)

This app uses `@a2ui/react`'s **v0.8** default export, whose message shapes **differ from the
v0.9/v1.0 spec shown above** (`createSurface`/`updateComponents`/bare values). Verify against the
installed renderer, not the spec:

- **Messages:** `beginRendering` (`{ surfaceId, root }`) + `surfaceUpdate` (`{ surfaceId, components }`)
  — not `createSurface`/`updateComponents`.
- **Component:** `{ id, component: { <Type>: <props> } }` (the type is the key) — not a flat
  `type` + `props`.
- **Containers:** `Card` holds one `child` (an id); `Row`/`Column`/`List` hold `children.explicitList`.
- **Bound values:** **typed literals** — `{ literalString }` / `{ literalNumber }` /
  `{ literalBoolean }` (or `{ path }`). A bare `{ literal }` is non-standard: the runtime resolver
  tolerates it for some fields, but the message **schema rejects it** on typed bindings (e.g.
  `Slider.value`, `CheckBox.value`) — always use the typed key.
- **Not used:** the data-model channel (`dataModelUpdate` / `path` / `template`) — the live agent
  emits static, literal-only UIs for now.

Our zod envelope lives in `ui/src/agent/contract.ts`; examples in `ui/src/recordings/`.

## Adjacent

- **ACP (IBM / BeeAI):** agent↔agent (JSON-RPC over HTTP/WS); **merged into A2A** (Aug 2025)
  — treat as an A2A precursor.
- **AGNTCY / Internet of Agents (Cisco et al.):** Linux Foundation project for multi-agent
  infrastructure (OASF schema, an Agent Connect Protocol over REST, an agent gateway, SLIM
  messaging). Parallel to A2A; still evolving — a "watch space."
- **OpenAI function / tool calling:** the model-level mechanism (a structured JSON call) that
  all of the above build on. MCP standardizes *where* tools come from, not *how* they're called.
- **Vercel AI SDK (v5 / v6):** a TypeScript multi-provider model + tools abstraction; v5
  aligned its tool schema to MCP. It is the common backend layer inside agents that speak
  AG-UI / A2A — and this project's planned live-agent layer.

## Relevance to this project

agenthud already sits at the **AG-UI + A2UI** layers:

- `@ag-ui/core` — the app replays AG-UI event streams (`RUN_STARTED` / `TEXT_MESSAGE_*` /
  `TOOL_CALL_*`) via `useReplayEngine` and the shared `applyA2UIEvent` seam.
- `@a2ui/react` — renders A2UI catalog components on the surface.

A live **BYOK** agent (planned) adds the **agent-logic** layer (Vercel AI SDK) emitting the
same AG-UI events a real agent would — the replay engine and a live SSE stream share one
event schema. **MCP** (tools) and **A2A** (multi-agent) are natural future layers, not yet
wired in. See [ADR-0001][adr-0001].

## Sources

Primary specs: MCP <https://modelcontextprotocol.io> · A2A <https://a2a-protocol.org> ·
AG-UI <https://docs.ag-ui.com> · A2UI <https://a2ui.org>. Governance/announcements via the
Linux Foundation, CopilotKit, and the Google Developers Blog.

> **Caveat:** A2UI v1.0 is a Candidate spec (last updated Jun 2026) and AGNTCY is still
> evolving — verify message shapes against the live spec before relying on them.

[adr-0001]: decisions/0001-agent-runtime-stack.md
