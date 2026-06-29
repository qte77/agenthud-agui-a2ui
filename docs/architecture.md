---
title: Architecture
description: End-to-end data flow for the Live (BYOK) tier, showing what we own versus what we run on.
---

# Architecture

End-to-end data flow for the Live (BYOK) tier, split by **what we own** vs **what we run on**.
The app is static (GitHub Pages); the edge proxy is *our* code on Cloudflare's runtime
([ADR-0002][adr-0002]); the upstreams are third-party LLM APIs. The
proxy exists **only for the non-CORS endpoints** (GitHub Models, Google) — CORS-friendly providers
are called directly from the browser. Worker specifics live in [`worker/README.md`][worker-readme].

```
        ┌──────────────── OURS (code we author + host) ─────────────────┐
        │   Browser — static app on GitHub Pages                        │
        │   https://qte77.github.io/agenthud-agui-a2ui/                  │
        │   ┌──────────────────────────────────────────┐                 │
        │   │ Live (BYOK) · Vercel AI SDK               │                 │
        │   │   baseURL = PROXY_BASE/github-models      │                 │
        │   │   Authorization: Bearer <USER's own key>  │                 │
        │   └──────────────────┬───────────────────────┘                 │
        │                      │ ① POST …/github-models/chat/completions  │
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
        │   models.github.ai/inference         (GitHub Models)          │
        │   generativelanguage.googleapis.com/v1beta/openai  (Google)   │
        └──────────────────────┬─────────────────────────────────────────┘
                               │ ③ streamed tokens
                               ▼
        ┌──────────────── OURS ─────────────────────────────────────────┐
        │   AI SDK → streamPartToEvent → applyA2UIEvent → A2UI surface   │
        └────────────────────────────────────────────────────────────────┘
```

## The ours / theirs line

- **Ours:** the GitHub Pages static app **and** the worker *source* (`worker/`), plus
  `wrangler.toml` — which *is* the worker's infrastructure-as-code.
- **Theirs:** Cloudflare's edge *runtime* (executes our worker; the only thing `wrangler deploy`
  creates) and the upstream LLM APIs.
- **The seam** is two strings: `PROXY_BASE` (app → worker, in `ui/src/LiveDashboard.tsx`) and the
  fixed upstream allowlist (worker → API, in `worker/src/router.ts`). **No secret crosses into
  "theirs" that the user didn't already own** — BYOK pass-through.

## Why CORS, and why the allowlist is the lock

GitHub Models / Google send no browser CORS headers, so the browser refuses to call them directly;
the worker relays server-to-server (where CORS doesn't apply) and stamps the response with
`Access-Control-Allow-Origin`. Because the worker **holds no secret**, that **origin allowlist is its
only access gate** — production echoes only `https://qte77.github.io`; localhost is added only in dev
(`ALLOW_LOCALHOST`). CORS is browser-enforced, so non-browser callers (curl, CI) pass the gate by
sending an allowlisted `Origin`.

[adr-0002]: decisions/0002-edge-proxy-platform.md
[worker-readme]: ../worker/README.md
