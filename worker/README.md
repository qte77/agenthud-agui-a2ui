# agenthud edge proxy (US-6)

A tiny Cloudflare Worker that lets the static GitHub Pages app reach a **non-CORS**
OpenAI-compatible endpoint (Google). Browsers can't call it directly —
it sends no CORS headers — so this worker forwards the request **server-to-server**
(where CORS doesn't apply) and streams the response back.

**BYOK pass-through — holds no secret.** It forwards the visitor's own `Authorization`
header upstream; the key never lives in the worker.

## Routes

`POST /<provider>/chat/completions` → forwarded to a fixed-allowlist upstream:

| provider | upstream |
|---|---|
| `google` | `https://generativelanguage.googleapis.com/v1beta/openai` |

The first path segment is the only routing key (no open proxy / SSRF). For the BYOK relay, only
`POST`/`OPTIONS` from an allowlisted `Origin` are served — **production allows only
`https://qte77.github.io`**; localhost dev origins are added only when `ALLOW_LOCALHOST="true"` (see
Local dev). CORS is the relay's sole access gate, since it holds no secret.

## Agent-native routes (Discovery + Execution)

Alongside the relay, the Worker exposes three **unauthenticated, agent-facing** endpoints that wrap
the keyless free render chain (Cloudflare Workers AI → OpenRouter `:free`) — **no visitor key, no new
env vars**. They **bypass the browser origin allowlist** (programmatic agents send no `Origin`) and
the two execution endpoints share a tighter `FREE_RATE_LIMITER` (10/60s). See
[ADR-0005](../docs/decisions/0005-agent-native-endpoints.md) and
[protocols.md](../docs/protocols.md).

| method + path | what |
|---|---|
| `GET /.well-known/agent-card.json` | Static **A2A Agent Card** — name, skills, capabilities, and `supportedInterfaces` → `/a2a`. Public, wildcard CORS. |
| `POST /mcp` | Stateless **MCP** server (Streamable HTTP, `createMcpHandler`). Tools: `render_ui` (prompt → A2UI batch), `validate_a2ui_batch` (structural check → `{valid, issues}`). |
| `POST /a2a` | Minimal **A2A** JSON-RPC. `message/send` renders a prompt into a synchronously-completed Task (A2UI batch as a `data` artifact); other methods → `-32601`. |

Quick check against a local `wrangler dev`:

```bash
curl http://localhost:8787/.well-known/agent-card.json
curl -X POST http://localhost:8787/a2a -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"parts":[{"kind":"text","text":"a login card"}]}}}'
```

## Keyless free-inference render (browser, not agent-native)

`POST /agent/render` lets a visitor render a UI **without their own key**, server-side, using the
same free chain (Cloudflare Workers AI → OpenRouter `:free`) the agent-native tools above share.
Unlike those three routes it is **origin-locked like the BYOK relay** (not wildcard CORS — it sits
behind the same `isAllowedOrigin` gate) and requires **Turnstile proof-of-human** before any model
call. Body: `{ messages: [{role,content}...], turnstileToken }`. Shares `FREE_RATE_LIMITER` with
`/mcp`/`/a2a`; provider-exhaustion never errors — it returns a deterministic stub batch (200).

Env vars/bindings this route needs beyond the base relay: `TURNSTILE_SECRET` (secret, required —
absent → the route 403s every request), `AI` (Workers AI binding, free tier), `OPENROUTER_KEY`
(secret) + optional `OPENROUTER_FREE_MODELS` (CSV override), `FREE_RATE_LIMITER` (optional —
absent → rate limit skipped in dev/test). See `worker/src/router.ts`'s `Env` interface for the
full doc comment on each.

## Deploy

```bash
cd worker
npm ci
npm test                       # router allowlist + CORS unit tests
npx wrangler deploy --env=""   # top-level (production); use --env dev for the localhost-allowed dev worker
```

Then set `PROXY_BASE` in [`ui/src/config.ts`](../ui/src/config.ts) to the deployed
`https://agenthud-proxy.<your-subdomain>.workers.dev` URL — `config.ts` is the single source of
truth for that URL, and the **Google (via proxy)** dropdown entry points at it.

## Local dev

The "(via proxy)" endpoints need a localhost-allowed worker (production rejects `localhost`). Full loop:

```bash
cd worker
printf 'ALLOW_LOCALHOST="true"\n' >> .dev.vars   # gitignored; lets wrangler dev accept localhost origins
npx wrangler dev                                  # http://localhost:8787 — keep this running
# in ui/.env set VITE_PROXY_BASE="http://localhost:8787", then (re)start the UI:
npm --prefix ui run dev
```

Now "Google (via proxy)" resolves to the local worker. Notes:

- **`compatibility_date` must be ≤ the date the installed wrangler's runtime supports**, or
  `wrangler dev` refuses to start (`requires compatibility date "…"` error). Bump it alongside
  wrangler upgrades, not blindly to "today".
- **Restart `npm run dev` after editing `ui/.env`** — Vite reads env at startup, not via HMR.
- Non-browser callers (curl, CI) need no localhost entry: send `Origin: https://qte77.github.io` and
  the `isAllowedOrigin` gate passes (CORS is browser-only). Or deploy the dev env
  (`wrangler deploy --env dev`).

## Deferred

- The **browser Live UI** for the keyless tier (a "Free (no key)" endpoint entry in the BYOK
  connection picker) — the worker-side render route above ships today; only the UI wiring is
  deferred. See US-6.
- Azure (per-resource URL) and Mammouth.
