# Cloudflare / Wrangler runbook

Concise, actionable notes for deploying + operating the BYOK edge proxy (`worker/`). Companion to
[`worker/README.md`](../worker/README.md) (routes + deploy), [ADR-0002](decisions/0002-edge-proxy-platform.md)
(why Cloudflare Workers), and [architecture](architecture.md) (data flow).

## Deploy

```bash
# Auth — interactive (local) OR token (CI):
wrangler login                        # OAuth, stores creds locally
#   …or token-based:
set -a; source worker/.env; set +a    # deploy does NOT auto-load .env — source it first
cd worker && npx wrangler deploy --env=""   # --env="" = the top-level (production) env
```

- **Token:** the **"Edit Cloudflare Workers"** template (dash → API Tokens), scoped to your account
  + a TTL. Minimal custom equivalent = `Workers Scripts: Edit` + `Account Settings: Read`. Never the
  Global API Key.
- **Account ID:** `wrangler whoami`, or dash → Workers & Pages → right sidebar.
- **`worker/.env`** holds `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`) for non-interactive
  deploys; gitignored, template in `worker/.env.example`. **`wrangler deploy` does NOT read it
  automatically** — `source` it first. (`.env` / `.dev.vars` are loaded only by `wrangler dev`.)

## Infrastructure-as-code

`worker/wrangler.toml` **is** the IaC — there are no other resources (stateless; the only binding is
the rate limiter). `wrangler deploy` is the apply. Terraform/Pulumi is overkill for one worker
(ADR-0002). Config may be TOML or JSONC (CF recommends `.jsonc` — newer features are JSON-only).

## Config gotchas (learned)

- **Named environments** (`[env.dev]`) **don't inherit bindings/vars** — redeclare per env. With
  multiple envs, plain `wrangler deploy` warns; pass `--env=""` (prod) or `--env dev`.
- **Rate limit** (`[[ratelimits]]`): `period` must be **10 or 60** seconds; it's eventually-consistent
  and per-location (a throttle, not exact accounting). Works on `workers.dev` / free. Verify the
  binding with `wrangler deploy --dry-run` (prints `env.RATE_LIMITER (100 requests/60s)`).
- **Observability** (`[observability] enabled = true`): structured `console.log` JSON → searchable
  logs; `wrangler tail` streams them live.
- Pin the binding/key names against the installed schema (`node_modules/wrangler/config-schema.json`)
  before trusting a doc — a wrong key fails the deploy.

## Security / abuse model

The worker **holds no secret** (BYOK pass-through), so its only gates are:

1. **Origin allowlist** — prod echoes only `https://qte77.github.io`; `ALLOW_LOCALHOST` adds localhost
   in dev. CORS is **browser-enforced**, so non-browser callers (curl/CI) pass `isAllowedOrigin` by
   sending `Origin: https://qte77.github.io` — the rate limit is the real volume lock (Origin is
   spoofable).
2. **Per-IP rate limit** — 100 req/60s, keyed on `CF-Connecting-IP`.
3. **Fixed upstream allowlist** — first path segment is the only routing key (no open proxy / SSRF).
4. **Free-tier 429 at 100k req/day** — a natural cost ceiling (no surprise bill).

## Command cheatsheet

| Command | Use |
|---|---|
| `wrangler whoami` | auth + account id |
| `wrangler deploy --dry-run` | validate build + bindings, no deploy |
| `wrangler deploy --env=""` | deploy production (top-level) |
| `wrangler deploy --env dev` | deploy `agenthud-proxy-dev` (localhost allowed) |
| `wrangler dev` | local server on `:8787` (loads `.dev.vars`) |
| `wrangler tail` | stream live logs |
