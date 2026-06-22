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
from an allowlisted `Origin` (`https://qte77.github.io`, `localhost`) are served.

## Deploy

```bash
cd worker
npm ci
npm test            # router allowlist + CORS unit tests
npx wrangler deploy
```

Then set `PROXY_BASE` in [`ui/src/LiveDashboard.tsx`](../ui/src/LiveDashboard.tsx) to the
deployed `https://agenthud-proxy.<your-subdomain>.workers.dev` URL — that's what the
**GitHub Models (via proxy)** / **Google (via proxy)** dropdown entries point at.

## Local dev

```bash
cd worker && npx wrangler dev          # http://localhost:8787
# point PROXY_BASE at http://localhost:8787, then: npm --prefix ui run dev
```

## Deferred

- **Keyless** mode (worker holds its own token) — abuse/secret surface; see US-6.
- Azure (per-resource URL) and Mammouth.
