import { describe, it, expect } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/router";

// No bindings → rate limiters skipped; these paths never reach model calls (card / unknown method).
const env: Env = {};

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://worker.example${path}`, { method: "GET", headers });
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://worker.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("agent-native routing", () => {
  it("serves the A2A card on GET /.well-known/agent-card.json without an Origin", async () => {
    const res = await worker.fetch(get("/.well-known/agent-card.json"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body: { name?: string } = await res.json();
    expect(body.name).toBe("agenthud");
  });

  it("reaches /a2a with no Origin (origin-bypass) — unknown method → JSON-RPC -32601", async () => {
    const res = await worker.fetch(post("/a2a", { jsonrpc: "2.0", id: 1, method: "tasks/cancel" }), env);
    const body: { error?: { code?: number } } = await res.json();
    expect(body.error?.code).toBe(-32601);
  });

  it("reaches /a2a even from a NON-allowlisted origin (not a 403 — agents bypass the allowlist)", async () => {
    const res = await worker.fetch(
      post("/a2a", { jsonrpc: "2.0", id: 1, method: "tasks/cancel" }, { origin: "https://evil.example" }),
      env,
    );
    expect(res.status).not.toBe(403);
    const body: { error?: { code?: number } } = await res.json();
    expect(body.error?.code).toBe(-32601);
  });

  it("still 405s a non-agent GET (the card route is path-specific)", async () => {
    const res = await worker.fetch(get("/"), env);
    expect(res.status).toBe(405);
  });
});
