import { describe, it, expect } from "vitest";
import { assertFreeId, buildProviders, renderFree, type Provider } from "../src/agent/providers";

const fakeProvider = (name: string, batch: unknown[] | null): Provider => ({
  name,
  tryRender: () => Promise.resolve(batch ? { batch, model: `${name}-model` } : null),
});

describe("assertFreeId", () => {
  it("accepts a :free id", () => expect(assertFreeId("meta-llama/x:free")).toBe(true));
  it("rejects a paid id", () => expect(assertFreeId("openai/gpt-4o")).toBe(false));
});

describe("buildProviders", () => {
  it("includes Workers AI only when the AI binding is present", () => {
    const ai = { run: () => Promise.resolve({}) } as unknown as Ai;
    expect(buildProviders({ ai }).map((p) => p.name)).toContain("workers-ai");
    expect(buildProviders({}).map((p) => p.name)).not.toContain("workers-ai");
  });
  it("includes OpenRouter only when a key is present", () => {
    expect(buildProviders({ openRouterKey: "k" }).map((p) => p.name)).toContain("openrouter-free");
  });
  it("skips every absent tier", () => {
    expect(buildProviders({})).toEqual([]);
  });
  it("orders Workers AI (free) before OpenRouter (cheapest-first)", () => {
    const ai = { run: () => Promise.resolve({}) } as unknown as Ai;
    expect(buildProviders({ ai, openRouterKey: "k" }).map((p) => p.name)).toEqual([
      "workers-ai",
      "openrouter-free",
    ]);
  });
});

describe("renderFree", () => {
  const args = { messages: [{ role: "user" as const, content: "hi" }] };
  it("returns the first provider that yields a batch", async () => {
    const r = await renderFree([fakeProvider("a", null), fakeProvider("b", [{ x: 1 }])], args);
    expect(r?.provider).toBe("b");
  });
  it("returns null when every provider fails", async () => {
    expect(await renderFree([fakeProvider("a", null), fakeProvider("b", null)], args)).toBeNull();
  });
});
