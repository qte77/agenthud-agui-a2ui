import { resolveUpstream, corsHeaders, isAllowedOrigin, type Env } from "./router";
import { buildProviders, renderFree } from "./agent/providers";
import { SYSTEM_PROMPT } from "./agent/prompts";
import type { ChatMessage } from "./agent/model";
import { verifyTurnstile } from "./turnstile";
import { agentCardResponse } from "./wellknown/agent-card";
import { mcpFetch } from "./mcp/server";
import { a2aFetch } from "./a2a/handler";

type Cors = Record<string, string>;

// Forwarded-body cap — blocks cost/DoS amplification (chat payloads are far smaller than 1 MiB).
const MAX_BODY_BYTES = 1_048_576;

// Tighter cap for the keyless render endpoint: the system prompt lives server-side and turn history
// is compact summaries, so 64 KiB is generous while shrinking the abuse surface.
const MAX_RENDER_BODY_BYTES = 65_536;

// Deterministic fallback UI — "the demo can never break". Returned (200) when every free provider
// fails, so the browser always gets a valid, self-contained batch instead of an error.
const STUB_BATCH: unknown[] = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        { id: "root", component: { Card: { child: "stub-text" } } },
        {
          id: "stub-text",
          component: {
            Text: {
              text: {
                literalString: "The free demo model is busy right now — please try again in a moment.",
              },
              usageHint: "body",
            },
          },
        },
      ],
    },
  },
];

// Read the request body, enforcing the size cap. Returns the bytes, or a 413 Response when too
// large. Skips reading when the declared length already exceeds the cap; otherwise verifies the
// actual bytes (covers a missing or spoofed Content-Length).
async function readCappedBody(
  request: Request,
  cors: Cors,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<ArrayBuffer | Response> {
  const overByHeader = Number(request.headers.get("content-length") ?? 0) > maxBytes;
  const body = overByHeader ? null : await request.arrayBuffer();
  if (body === null || body.byteLength > maxBytes) {
    return Response.json({ error: "Request body too large" }, { status: 413, headers: cors });
  }
  return body;
}

// Keep only well-formed user/assistant turns; DROP any client-sent system message (the worker owns
// the system prompt on a keyless endpoint) and ignore any client-chosen model (`:free` only).
function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    const msg = m as { role?: unknown; content?: unknown };
    if ((msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string") {
      out.push({ role: msg.role, content: msg.content });
    }
  }
  return out;
}

// Keyless "Free (no key)" render (US-6 keyless): run free models server-side so a visitor needs no
// key. Inherits the shared gates (CORS/OPTIONS/POST/origin/RATE_LIMITER) from the caller; adds a
// tight per-IP limit, Turnstile proof-of-human, a small body cap, and a $0 `:free`-only chain.
// Never breaks: provider exhaustion → deterministic stub. The key rides only in the upstream header.
async function handleKeylessRender(request: Request, env: Env, cors: Cors): Promise<Response> {
  if (env.FREE_RATE_LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.FREE_RATE_LIMITER.limit({ key: ip });
    if (!success) return Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: cors });
  }

  const raw = await readCappedBody(request, cors, MAX_RENDER_BODY_BYTES);
  if (raw instanceof Response) return raw; // 413

  let parsed: { messages?: unknown; turnstileToken?: unknown };
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw)) as typeof parsed;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
  }

  // Proof-of-human before any model spend (closes the Origin-spoof drain).
  const token = typeof parsed.turnstileToken === "string" ? parsed.turnstileToken : "";
  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  if (!env.TURNSTILE_SECRET || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
    return Response.json({ error: "Turnstile verification failed" }, { status: 403, headers: cors });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sanitizeMessages(parsed.messages),
  ];
  const providers = buildProviders({
    ai: env.AI,
    openRouterKey: env.OPENROUTER_KEY,
    openRouterFreeModels: env.OPENROUTER_FREE_MODELS
      ? env.OPENROUTER_FREE_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const free = await renderFree(providers, { messages, signal: ac.signal });
    return Response.json({ a2uiMessages: free ? free.result.batch : STUB_BATCH }, { headers: cors });
  } finally {
    clearTimeout(timer);
  }
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

// Agent-native endpoints bypass the browser origin allowlist + generic rate limit (programmatic
// agents send no Origin): the public A2A discovery card (GET, answered before the 405 gate), and the
// MCP + A2A execution endpoints (POST, each with its own FREE_RATE_LIMITER). null → normal proxy flow.
function agentNativeRoute(
  request: Request,
  env: Env,
  pathname: string,
): Response | Promise<Response> | null {
  if (request.method === "GET" && pathname === "/.well-known/agent-card.json") {
    return agentCardResponse(request);
  }
  if (request.method === "POST" && pathname === "/mcp") return mcpFetch(request, env);
  if (request.method === "POST" && pathname === "/a2a") return a2aFetch(request, env);
  return null;
}

// BYOK pass-through CORS proxy (US-6). The static GitHub Pages app POSTs to
// /<provider>/chat/completions; we forward it server-to-server (where browser CORS doesn't apply)
// and stream the SSE response back with CORS headers. No secret is held here — the visitor's own
// Authorization header is forwarded unchanged.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, env);
    const pathname = new URL(request.url).pathname;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // Agent-native routes (public A2A discovery card + MCP/A2A execution) bypass the browser origin
    // allowlist + generic rate limit — programmatic agents send no Origin. See agentNativeRoute.
    const agentRoute = agentNativeRoute(request, env, pathname);
    if (agentRoute) return agentRoute;

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

    // Keyless free-inference tier — the worker runs free models server-side (no visitor key).
    // Inherits every gate above; adds Turnstile + a tighter per-IP limit inside the handler.
    if (pathname === "/agent/render") return handleKeylessRender(request, env, cors);

    const upstream = resolveUpstream(pathname);
    if (!upstream) return new Response("Unknown provider", { status: 404, headers: cors });

    const body = await readCappedBody(request, cors);
    if (body instanceof Response) return body; // 413
    return forwardToUpstream(request, upstream, body, cors);
  },
};
