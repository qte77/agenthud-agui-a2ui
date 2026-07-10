import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/router";

const ORIGIN = "https://qte77.github.io";
const OR_KEY = "or-secret-key";
const TS_SECRET = "turnstile-secret";

function renderReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://proxy.example/agent/render", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        { id: "root", component: { Card: { child: "t" } } },
        { id: "t", component: { Text: { text: { literalString: "hi" }, usageHint: "body" } } },
      ],
    },
  },
];

const modelOk = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "render_ui", arguments: JSON.stringify({ messages: validBatch }) } },
            ],
          },
        },
      ],
    }),
    { status: 200 },
  );

// One fetch stub serves both siteverify and the model call, dispatched by URL.
function stubFetch(opts: { turnstile: boolean; model?: () => Response }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("siteverify")) {
        return Promise.resolve(new Response(JSON.stringify({ success: opts.turnstile }), { status: 200 }));
      }
      return Promise.resolve((opts.model ?? modelOk)());
    }),
  );
}

const baseEnv: Env = { OPENROUTER_KEY: OR_KEY, TURNSTILE_SECRET: TS_SECRET };

describe("keyless /agent/render", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders a batch when the turnstile token verifies", async () => {
    stubFetch({ turnstile: true });
    const res = await worker.fetch(
      renderReq({ messages: [{ role: "user", content: "make a card" }], turnstileToken: "tok" }),
      baseEnv,
    );
    expect(res.status).toBe(200);
    const body: { a2uiMessages?: unknown[] } = await res.json();
    expect(Array.isArray(body.a2uiMessages)).toBe(true);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("rejects an invalid turnstile token with 403 (no model call)", async () => {
    stubFetch({ turnstile: false });
    const res = await worker.fetch(renderReq({ messages: [], turnstileToken: "bad" }), baseEnv);
    expect(res.status).toBe(403);
  });

  it("rejects an oversized body with 413", async () => {
    const big = JSON.stringify({ messages: [], turnstileToken: "x", pad: "y".repeat(70_000) });
    const res = await worker.fetch(renderReq(big), baseEnv);
    expect(res.status).toBe(413);
  });

  it("rejects a spoofed (non-allowlisted) origin with 403", async () => {
    stubFetch({ turnstile: true });
    const res = await worker.fetch(
      renderReq({ messages: [], turnstileToken: "tok" }, { origin: "https://evil.example" }),
      baseEnv,
    );
    expect(res.status).toBe(403);
  });

  it("returns a deterministic stub (200) when every provider fails", async () => {
    stubFetch({ turnstile: true, model: () => new Response("upstream boom", { status: 500 }) });
    const res = await worker.fetch(
      renderReq({ messages: [{ role: "user", content: "x" }], turnstileToken: "tok" }),
      baseEnv,
    );
    expect(res.status).toBe(200);
    const body: { a2uiMessages?: unknown[] } = await res.json();
    expect(Array.isArray(body.a2uiMessages)).toBe(true); // deterministic stub batch
  });

  it("never echoes the OpenRouter key or Turnstile secret in the response", async () => {
    stubFetch({ turnstile: true });
    const res = await worker.fetch(
      renderReq({ messages: [{ role: "user", content: "x" }], turnstileToken: "tok" }),
      baseEnv,
    );
    const text = await res.text();
    expect(text).not.toContain(OR_KEY);
    expect(text).not.toContain(TS_SECRET);
  });
});
