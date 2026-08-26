// Fixed upstream allowlist — the first path segment is the ONLY routing key, so the
// proxy can never be aimed at an arbitrary host (no open proxy / SSRF). BYOK pass-through:
// this worker holds no secret; the visitor's own key is forwarded upstream unchanged.
const UPSTREAMS: Record<string, string> = {
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

/** Map `/<provider>/<rest...>` to its allowlisted upstream URL, or null if unknown. */
export function resolveUpstream(pathname: string): string | null {
  const [, provider, ...rest] = pathname.split("/");
  if (!provider) return null;
  const base = UPSTREAMS[provider];
  if (!base) return null;
  return rest.length ? `${base}/${rest.join("/")}` : base;
}

/** A Workers Rate Limiting binding (wrangler `[[ratelimits]]`). */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Worker bindings + vars (wrangler `[vars]` / `[env.<name>.vars]` / local `.dev.vars`). */
export interface Env {
  /** "true" adds localhost dev origins to the CORS allowlist. Set it only in dev
   *  (`[env.dev.vars]` or a gitignored `.dev.vars`) — NEVER in the production deploy,
   *  so prod echoes only the gh-pages origin. */
  ALLOW_LOCALHOST?: string;
  /** Per-IP rate limiter (abuse lock). Absent in local dev / tests → rate-limit skipped. */
  RATE_LIMITER?: RateLimit;

  // ---- Keyless free-inference tier (US-6 keyless, `/agent/render`) ----
  /** Server-held OpenRouter key (secret). Shared with the trial tier below — the `:free`-only lock
   *  for the keyless tier is enforced in providers.ts's code, not by the key itself, so the SAME
   *  key is safe to reuse for a real (non-`:free`, spend-bearing) trial-tier model call. Absent →
   *  both the keyless tier's OpenRouter fallback AND the trial tier are off. */
  OPENROUTER_KEY?: string;
  /** CSV override for the OpenRouter `:free` model list (non-`:free` ids are filtered out in code). */
  OPENROUTER_FREE_MODELS?: string;
  /** Cloudflare Workers AI binding (`[ai]`). Free tier, tried first. Absent → skipped. */
  AI?: Ai;
  /** Turnstile secret (secret). Required for `/agent/render` and `/agent/trial-render`; absent →
   *  both endpoints 403. */
  TURNSTILE_SECRET?: string;
  /** Tighter per-IP limit for the server-funded render endpoint. Absent in dev/tests → skipped. */
  FREE_RATE_LIMITER?: RateLimit;

  // ---- Trial-key tier (spend-bearing; `/agent/trial-render`) ----
  /** Durable Object namespace backing TrialQuotaDO's per-visitor + shared-daily hard caps. Absent
   *  → the trial endpoint is off (never silently falls back to an unmetered call). */
  TRIAL_DO?: DurableObjectNamespace<import("./trial/quota").TrialQuotaDO>;
  /** Real (non-`:free`) OpenRouter model id the trial tier calls. Defaulted in code if absent. */
  TRIAL_MODEL?: string;
  /** Shared daily cap across all visitors combined (the spend circuit-breaker). Defaulted in code. */
  TRIAL_DAILY_CAP?: string;
}

// Production allows ONLY the gh-pages site; localhost dev origins are added when
// ALLOW_LOCALHOST="true". CORS is the worker's only access gate (it holds no secret).
const PROD_ORIGINS = [/^https:\/\/qte77\.github\.io$/];
const LOCALHOST_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function allowedOrigins(env?: Env): RegExp[] {
  return env?.ALLOW_LOCALHOST === "true"
    ? [...PROD_ORIGINS, ...LOCALHOST_ORIGINS]
    : PROD_ORIGINS;
}

/** Is this request `Origin` one we return CORS headers for? */
export function isAllowedOrigin(origin: string | null, env?: Env): boolean {
  return origin !== null && allowedOrigins(env).some((re) => re.test(origin));
}

/** CORS headers for an allowed origin; empty object when the origin isn't allowed. */
export function corsHeaders(origin: string | null, env?: Env): Record<string, string> {
  if (!isAllowedOrigin(origin, env)) return {};
  return {
    "access-control-allow-origin": origin!,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
