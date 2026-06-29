import { resolveUpstream, corsHeaders, isAllowedOrigin, type Env } from "./router";

// BYOK pass-through CORS proxy (US-6). The static GitHub Pages app POSTs to
// /<provider>/chat/completions; we forward it server-to-server (where browser CORS
// doesn't apply) and stream the SSE response back with CORS headers. No secret is held
// here — the visitor's own Authorization header is forwarded unchanged.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, env);

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    // Only browsers on an allowlisted origin may use the proxy.
    if (!isAllowedOrigin(origin, env)) {
      return new Response("Forbidden origin", { status: 403 });
    }

    const upstream = resolveUpstream(new URL(request.url).pathname);
    if (!upstream) {
      return new Response("Unknown provider", { status: 404, headers: cors });
    }

    // Forward only what the upstream needs: the visitor's key + content type + body.
    const fwd = new Headers();
    const auth = request.headers.get("authorization");
    if (auth) fwd.set("authorization", auth);
    const contentType = request.headers.get("content-type");
    if (contentType) fwd.set("content-type", contentType);

    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: fwd,
      body: await request.arrayBuffer(),
    });

    // Stream the response back, overlaying CORS so the browser can read it.
    const headers = new Headers(upstreamRes.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers,
    });
  },
};
