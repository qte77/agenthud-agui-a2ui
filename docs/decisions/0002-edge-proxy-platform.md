# ADR-0002 — Edge proxy platform: Cloudflare Workers

**Status:** Accepted (2026-06-22)
**Relates to:** [US-6](../UserStory.md), [ADR-0001 amendment](0001-agent-runtime-stack.md)

## Context

The BYOK pass-through CORS proxy (`worker/`) needs a serverless host. Requirements for
this *specific* job: relay-only (**no database/auth**), **always-on** for a public demo,
**stream** LLM responses (SSE), set CORS headers, and run on a generous **free tier**.
Candidates considered: Cloudflare Workers, Supabase Edge Functions, Vercel Functions.

## Decision

**Cloudflare Workers** — purpose-built for a no-DB edge relay, and it wins on the factors
that matter here.

| | Cloudflare Workers | Supabase Edge Fn | Vercel Fn |
|---|---|---|---|
| Runtime | V8 isolate (edge) | Deno (edge) | Node (Lambda) / Edge (V8) |
| Cold start | ~<5 ms | low | 50–250 ms edge / 200–800 ms node |
| Streaming | no duration cap | yes | yes |
| Always-on (public) | yes | **free tier pauses after ~1 wk idle** | yes |
| Free tier | 100k req/day, no card | DB-centric + pause caveat | 100 GB-hrs/mo |
| Fit for a no-DB relay | purpose-built | overkill (full backend) | ecosystem-tied |

Deciding deltas:

- **Supabase** free projects **pause after ~1 week of inactivity** — disqualifying for a
  public, possibly-idle demo proxy — and its real value (Postgres/auth/storage/realtime) is
  unused here.
- **Cold start** strongly favours Workers (isolates <5 ms vs Vercel 50–800 ms); the first
  request after idle is exactly when a low-traffic proxy gets hit.
- **Streaming** has no duration cap on Workers — best for long LLM token streams.
- **Vercel Edge** is the closest analogue (near-identical `fetch(request)` code) and would
  be the natural pick only if the app moved to Vercel/Next.js — it has not (static GitHub
  Pages), so there is no ecosystem pull.

## Consequences

- **Not locked in.** The relay is ~50 lines of Web-standard `fetch`: `CF fetch(request,
  env, ctx)` ≈ Vercel Edge `fetch(request)` ≈ Supabase `Deno.serve(req)`. Porting is a small
  env-access + deploy-config change, so the choice is cheaply reversible.
- A browser-called proxy **cannot hold a secret** on *any* platform (the key is visible in
  the network tab); the only real locks are an **origin allowlist** (implemented in
  `worker/src/router.ts`), an optional API key, and rate limiting (Cloudflare offers a native
  rate-limit binding). This reinforces the BYOK, hold-no-secret model.

## References

- [Cloudflare Workers — pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Functions](https://vercel.com/docs/functions)
