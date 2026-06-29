import { resolveUpstream, corsHeaders, isAllowedOrigin, type Env } from "./router";

type Cors = Record<string, string>;

// Forwarded-body cap — blocks cost/DoS amplification (chat payloads are far smaller than 1 MiB).
const MAX_BODY_BYTES = 1_048_576;

// Read the request body, enforcing the size cap. Returns the bytes, or a 413 Response when too
// large. Skips reading when the declared length already exceeds the cap; otherwise verifies the
// actual bytes (covers a missing or spoofed Content-Length).
async function readCappedBody(
  request: Request,
  cors: Cors,
): Promise<ArrayBuffer | Response> {
  const overByHeader = Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES;
  const body = overByHeader ? null : await request.arrayBuffer();
  if (body === null || body.byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413, headers: cors });
  }
  return body;
}

// Forward only what the upstream needs (the visitor's key + content type + body) and stream the
// response back with CORS, stripping upstream cookies / hop-by-hop headers so a misbehaving
// upstream can't set them on the proxy origin.
async function forwardToUpstream(
  request: Request,
  upstream: string,
  body: ArrayBuffer,
  cors: Cors,
): Promise<Response> {
  const fwd = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) fwd.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) fwd.set("content-type", contentType);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { method: "POST", headers: fwd, body });
  } catch (error) {
    // Upstream unreachable / timeout: return a STRUCTURED error WITH cors headers, so the browser
    // surfaces the real failure instead of an opaque CORS error.
    console.error(
      JSON.stringify({ message: "upstream fetch failed", upstream, error: String(error) }),
    );
    return Response.json({ error: "Upstream request failed" }, { status: 502, headers: cors });
  }

  const headers = new Headers(upstreamRes.headers);
  for (const h of ["set-cookie", "set-cookie2", "transfer-encoding", "connection", "keep-alive"]) {
    headers.delete(h);
  }
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers,
  });
}

// BYOK pass-through CORS proxy (US-6). The static GitHub Pages app POSTs to
// /<provider>/chat/completions; we forward it server-to-server (where browser CORS doesn't apply)
// and stream the SSE response back with CORS headers. No secret is held here — the visitor's own
// Authorization header is forwarded unchanged.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    // Only browsers on an allowlisted origin may use the proxy.
    if (!isAllowedOrigin(origin, env)) return new Response("Forbidden origin", { status: 403 });

    // Per-IP rate limit (abuse lock): the worker holds no secret, so this + the origin allowlist
    // are the only gates. Eventually-consistent / per-location — fine for throttling.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: cors });
      }
    }

    const upstream = resolveUpstream(new URL(request.url).pathname);
    if (!upstream) return new Response("Unknown provider", { status: 404, headers: cors });

    const body = await readCappedBody(request, cors);
    if (body instanceof Response) return body; // 413
    return forwardToUpstream(request, upstream, body, cors);
  },
};
