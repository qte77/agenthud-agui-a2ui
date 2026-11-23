import { describe, it, expect } from "vitest";
import { readCappedBody, MAX_BODY_BYTES } from "../src/body";
import { mcpFetch } from "../src/mcp/server";

const CHUNK = 64 * 1024;

// A body stream with no Content-Length; `limit` chunks of CHUNK bytes, or endless when omitted.
function streamed(limit?: number): { request: Request; pulled: () => number } {
  let n = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (limit !== undefined && n >= limit) return controller.close();
      n += 1;
      controller.enqueue(new Uint8Array(CHUNK));
    },
  });
  const request = new Request("https://w.example/a2a", { method: "POST", body, duplex: "half" } as RequestInit);
  return { request, pulled: () => n };
}

describe("readCappedBody", () => {
  it("stops reading an endless chunked body at the cap and answers 413", async () => {
    const { request, pulled } = streamed();
    const res = await readCappedBody(request);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(413);
    // never buffered far past the cap
    expect(pulled() * CHUNK).toBeLessThanOrEqual(MAX_BODY_BYTES + 2 * CHUNK);
  });

  it("returns a streamed body of exactly the cap, byte for byte", async () => {
    const { request } = streamed(MAX_BODY_BYTES / CHUNK);
    const res = await readCappedBody(request);
    expect(res).toBeInstanceOf(ArrayBuffer);
    expect((res as ArrayBuffer).byteLength).toBe(MAX_BODY_BYTES);
  });

  it("rejects a body one byte over the cap", async () => {
    const request = new Request("https://w.example/a2a", { method: "POST", body: new Uint8Array(MAX_BODY_BYTES + 1) });
    const res = await readCappedBody(request);
    expect((res as Response).status).toBe(413);
  });

  it("returns an empty buffer for a request with no body", async () => {
    const res = await readCappedBody(new Request("https://w.example/a2a", { method: "POST" }));
    expect((res as ArrayBuffer).byteLength).toBe(0);
  });
});

describe("POST /mcp body cap", () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request("https://w.example/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      body,
    });

  it("rejects an oversized body with 413 (declared length)", async () => {
    const res = await mcpFetch(post("{}", { "content-length": String(2 * MAX_BODY_BYTES) }), {});
    expect(res.status).toBe(413);
  });

  it("rejects an oversized body with 413 (actual bytes)", async () => {
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { pad: "a".repeat(MAX_BODY_BYTES) } });
    const res = await mcpFetch(post(big), {});
    expect(res.status).toBe(413);
  });

  it("hands a small request on to the MCP handler with its body intact", async () => {
    const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } };
    const res = await mcpFetch(post(JSON.stringify(init)), {});
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"serverInfo"');
  });
});
