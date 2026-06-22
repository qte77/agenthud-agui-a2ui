// Fixed upstream allowlist — the first path segment is the ONLY routing key, so the
// proxy can never be aimed at an arbitrary host (no open proxy / SSRF). BYOK pass-through:
// this worker holds no secret; the visitor's own key is forwarded upstream unchanged.
const UPSTREAMS: Record<string, string> = {
  "github-models": "https://models.github.ai/inference",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

/** Map `/<provider>/<rest...>` to its allowlisted upstream URL, or null if unknown. */
export function resolveUpstream(pathname: string): string | null {
  const [, provider, ...rest] = pathname.split("/");
  const base = UPSTREAMS[provider];
  if (!base) return null;
  return rest.length ? `${base}/${rest.join("/")}` : base;
}

const ALLOWED_ORIGINS = [
  /^https:\/\/qte77\.github\.io$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

/** Is this request `Origin` one we return CORS headers for? */
export function isAllowedOrigin(origin: string | null): boolean {
  return origin !== null && ALLOWED_ORIGINS.some((re) => re.test(origin));
}

/** CORS headers for an allowed origin; empty object when the origin isn't allowed. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "access-control-allow-origin": origin as string,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
