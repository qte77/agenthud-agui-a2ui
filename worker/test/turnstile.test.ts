import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTurnstile } from "../src/turnstile";

describe("verifyTurnstile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns false for an empty token without calling siteverify", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await verifyTurnstile("", "secret")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true when siteverify reports success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    expect(await verifyTurnstile("tok", "secret")).toBe(true);
  });

  it("returns false when siteverify reports failure (expired/duplicate)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), {
          status: 200,
        }),
      ),
    );
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
  });

  it("returns false on a non-OK siteverify response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("err", { status: 500 })));
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
  });
});
