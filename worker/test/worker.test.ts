import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/worker";

const ORIGIN = "https://qte77.github.io";

function post(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request("https://proxy.example/google/chat/completions", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body,
  });
}

describe("worker fetch handler", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects an oversized body with 413 (CORS headers intact)", async () => {
    const big = "x".repeat(1_100_000); // > 1 MiB cap
    const res = await worker.fetch(post(big), {});
    expect(res.status).toBe(413);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("strips set-cookie and hop-by-hop headers from the upstream response", async () => {
    const upstream = new Response("ok", {
      status: 200,
      headers: {
        "set-cookie": "sid=abc",
        "transfer-encoding": "chunked",
        "content-type": "application/json",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));

    const res = await worker.fetch(post("{}"), {});

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("transfer-encoding")).toBeNull();
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});
