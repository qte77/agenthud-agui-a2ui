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

The "(via proxy)" endpoints need a localhost-allowed worker (production rejects `localhost`). Full loop:

```bash
cd worker
printf 'ALLOW_LOCALHOST="true"\n' >> .dev.vars   # gitignored; lets wrangler dev accept localhost origins
npx wrangler dev                                  # http://localhost:8787 — keep this running
# in ui/.env set VITE_PROXY_BASE="http://localhost:8787", then (re)start the UI:
npm --prefix ui run dev
```

Now "GitHub Models (via proxy)" / "Google (via proxy)" resolve to the local worker. Notes:

- **`compatibility_date` must be ≤ the date the installed wrangler's runtime supports**, or
  `wrangler dev` refuses to start (`requires compatibility date "…"` error). Bump it alongside
  wrangler upgrades, not blindly to "today".
- **Restart `npm run dev` after editing `ui/.env`** — Vite reads env at startup, not via HMR.
- Non-browser callers (curl, CI) need no localhost entry: send `Origin: https://qte77.github.io` and
  the `isAllowedOrigin` gate passes (CORS is browser-only). Or deploy the dev env
  (`wrangler deploy --env dev`).

## Deferred

- **Keyless** mode (worker holds its own token) — abuse/secret surface; see US-6.
- Azure (per-resource URL) and Mammouth.
