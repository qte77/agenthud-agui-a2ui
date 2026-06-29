# agenthud edge proxy (US-6)

A tiny Cloudflare Worker that lets the static GitHub Pages app reach **non-CORS**
OpenAI-compatible endpoints (GitHub Models, Google). Browsers can't call those directly —
they send no CORS headers — so this worker forwards the request **server-to-server**
(where CORS doesn't apply) and streams the response back.

**BYOK pass-through — holds no secret.** It forwards the visitor's own `Authorization`
header upstream; the key never lives in the worker.

## Routes

`POST /<provider>/chat/completions` → forwarded to a fixed-allowlist upstream:

| provider | upstream |
|---|---|
| `github-models` | `https://models.github.ai/inference` |
| `google` | `https://generativelanguage.googleapis.com/v1beta/openai` |

The first path segment is the only routing key (no open proxy / SSRF). Only `POST`/`OPTIONS`
from an allowlisted `Origin` are served — **production allows only `https://qte77.github.io`**;
localhost dev origins are added only when `ALLOW_LOCALHOST="true"` (see Local dev). CORS is the
worker's sole access gate, since it holds no secret.

## Deploy

```bash
cd worker
npm ci
npm test                       # router allowlist + CORS unit tests
npx wrangler deploy --env=""   # top-level (production); use --env dev for the localhost-allowed dev worker
```

Then set `PROXY_BASE` in [`ui/src/LiveDashboard.tsx`](../ui/src/LiveDashboard.tsx) to the
deployed `https://agenthud-proxy.<your-subdomain>.workers.dev` URL — that's what the
**GitHub Models (via proxy)** / **Google (via proxy)** dropdown entries point at.

## Local dev

```bash
cd worker && npx wrangler dev          # http://localhost:8787
# then set VITE_PROXY_BASE=http://localhost:8787 in ui/.env and: npm --prefix ui run dev
```

`wrangler dev` rejects a `localhost` origin unless `ALLOW_LOCALHOST="true"` is set — add it to a
gitignored `worker/.dev.vars` (`wrangler dev` loads it), or deploy the dev env
(`wrangler deploy --env dev`). Non-browser callers (curl, CI) need no localhost entry: send
`Origin: https://qte77.github.io` and the `isAllowedOrigin` gate passes (CORS is browser-only).

## Deferred

- **Keyless** mode (worker holds its own token) — abuse/secret surface; see US-6.
- Azure (per-resource URL) and Mammouth.
