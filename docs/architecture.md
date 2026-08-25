---
title: Architecture
description: End-to-end data flow for the Live (BYOK) tier, showing what we own versus what we run on.
---

# Architecture

End-to-end data flow for the Live (BYOK) tier, split by **what we own** vs **what we run on**.
The app is static (GitHub Pages); the edge proxy is *our* code on Cloudflare's runtime
([ADR-0002][adr-0002]); the upstreams are third-party LLM APIs. The
proxy exists **only for the non-CORS endpoint** (Google) — CORS-friendly providers
are called directly from the browser. Worker specifics live in [`worker/README.md`][worker-readme].

```
        ┌──────────────── OURS (code we author + host) ─────────────────┐
        │   Browser — static app on GitHub Pages                        │
        │   https://qte77.github.io/agenthud-agui-a2ui/                  │
        │   ┌──────────────────────────────────────────┐                 │
        │   │ Live (BYOK) · Vercel AI SDK               │                 │
        │   │   baseURL = PROXY_BASE/google             │                 │
        │   │   Authorization: Bearer <USER's own key>  │                 │
        │   └──────────────────┬───────────────────────┘                 │
        │                      │ ① POST …/google/chat/completions         │
        │                      │    (+ CORS preflight OPTIONS)            │
        └──────────────────────┼─────────────────────────────────────────┘
                               │
        ┌──────────────────────▼──── THEIRS (Cloudflare runs our code) ──┐
        │   agenthud-proxy.<sub>.workers.dev   (worker/ — OUR source)    │
        │     • Origin ∈ allowlist? (prod: qte77.github.io)  else 403    │
        │     • path seg → fixed upstream (no open proxy / SSRF)         │
        │     • forward the USER's Authorization (holds no secret)       │
        │     • add Access-Control-Allow-Origin on the way back          │
        └──────────────────────┬─────────────────────────────────────────┘
                               │ ② server-to-server  (no browser CORS here)
                               ▼
        ┌──────────────────────────── THEIRS (upstream LLMs) ───────────┐
        │   generativelanguage.googleapis.com/v1beta/openai  (Google)   │
        └──────────────────────┬─────────────────────────────────────────┘
                               │ ③ streamed tokens
                               ▼
        ┌──────────────── OURS ─────────────────────────────────────────┐
        │   AI SDK → streamPartToEvent → applyA2UIEvent → A2UI surface   │
        └────────────────────────────────────────────────────────────────┘
```

> `PROXY_BASE` (the deployed `agenthud-proxy.<sub>.workers.dev` URL, where `<sub>` is the
> workers.dev subdomain) is defined in [`ui/src/config.ts`](../ui/src/config.ts) — the single
> source of truth for the URL.

## A2UI render pipeline (model → components)

The final box above expands to the translation that turns a model reply into rendered widgets:

1. The live model returns a **`render_ui` tool call** whose arguments are an A2UI message batch — the
   tool's `inputSchema` is the zod contract in `ui/src/agent/contract.ts`, so the SDK validates (and
   can repair) the model's output.
2. `streamPartToEvent` maps the SDK stream to AG-UI events; the completed tool call carries the batch
   as `a2uiMessages`.
3. `applyA2UIEvent` (the seam shared with replay) re-validates the batch against the contract, then
   hands it to `@a2ui`'s `processMessages`.
4. `processMessages` builds a component tree for the `main` surface **starting at
   `beginRendering.root`**, resolving `Card.child` / `Column.children`; `<A2UIRenderer surfaceId="main">`
   maps each typed component (`Card`, `Text`, …) to a catalog widget and resolves bound values
   (`literalString` / `literalNumber` / `literalBoolean`).

> Gotcha: `beginRendering.root` **must equal the id of the top component** — a missing root id paints a
> blank surface with no error. The live `SYSTEM_PROMPT` (`ui/src/agent/prompts.ts`) enforces this.

## Agent-native endpoints (Discovery + Execution)

The same Worker also answers three **unauthenticated, agent-facing** routes that wrap the keyless
render chain — `GET /.well-known/agent-card.json` (A2A card), `POST /mcp` (MCP: `render_ui` +
`validate_a2ui_batch`), and `POST /a2a` (A2A `message/send` → a completed Task). These **bypass the
origin allowlist** (programmatic agents send no `Origin`) and share the `FREE_RATE_LIMITER`; they need
no visitor key. Details in [`worker/README.md`][worker-readme] · [ADR-0005][adr-0005]; protocol
reference in [protocols.md](protocols.md).

## The ours / theirs line

- **Ours:** the GitHub Pages static app **and** the worker *source* (`worker/`), plus
  `wrangler.toml` — which *is* the worker's infrastructure-as-code.
- **Theirs:** Cloudflare's edge *runtime* (executes our worker; the only thing `wrangler deploy`
  creates) and the upstream LLM APIs.
- **The seam** is two strings: `PROXY_BASE` (app → worker, in `ui/src/config.ts`) and the
  fixed upstream allowlist (worker → API, in `worker/src/router.ts`). **No secret crosses into
  "theirs" that the user didn't already own** — BYOK pass-through.

## Why CORS, and why the allowlist is the lock

Google sends no browser CORS headers, so the browser refuses to call it directly;
the worker relays server-to-server (where CORS doesn't apply) and stamps the response with
`Access-Control-Allow-Origin`. Because the worker **holds no secret**, that **origin allowlist is its
only access gate** — production echoes only `https://qte77.github.io`; localhost is added only in dev
(`ALLOW_LOCALHOST`). CORS is browser-enforced, so non-browser callers (curl, CI) pass the gate by
sending an allowlisted `Origin`.

[adr-0002]: decisions/0002-edge-proxy-platform.md
[adr-0005]: decisions/0005-agent-native-endpoints.md
[worker-readme]: ../worker/README.md
