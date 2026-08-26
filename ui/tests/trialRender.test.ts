import { describe, it, expect, vi, afterEach } from "vitest";
import { postTrialRender } from "../src/agent/trialRender";

describe("postTrialRender", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the prompt as a single user message plus the turnstile token", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ a2uiMessages: [{ beginRendering: {} }], remaining: 2 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await postTrialRender("make a card", "tok");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/agent/trial-render");
    const body = JSON.parse(init.body as string) as { messages: unknown[]; turnstileToken: string };
    expect(body.messages).toEqual([{ role: "user", content: "make a card" }]);
    expect(body.turnstileToken).toBe("tok");
  });

  it("returns the parsed batch + remaining count on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ a2uiMessages: [{ beginRendering: {} }], remaining: 1 }), { status: 200 }),
      ),
    );
    const result = await postTrialRender("x", "tok");
    expect(result.a2uiMessages).toEqual([{ beginRendering: {} }]);
    expect(result.remaining).toBe(1);
  });

  it("returns the server's error + remaining on a 403 (cap exhausted)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Trial limit reached", remaining: 0 }), { status: 403 }),
      ),
    );
    const result = await postTrialRender("x", "tok");
    expect(result.error).toBe("Trial limit reached");
    expect(result.remaining).toBe(0);
  });

  it("returns a graceful error instead of throwing when fetch itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await postTrialRender("x", "tok");
    expect(result.error).toBeTruthy();
    expect(result.a2uiMessages).toBeUndefined();
  });
});
