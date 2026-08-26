import { describe, it, expect, vi, afterEach } from "vitest";
import { renderTrial } from "../src/agent/trial";
import type { Env } from "../src/router";

const validBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [{ id: "root", component: { Text: { text: { literalString: "hi" } } } }],
    },
  },
];

const toolResponse = (args: unknown) => ({
  choices: [
    { message: { tool_calls: [{ function: { name: "render_ui", arguments: JSON.stringify(args) } }] } },
  ],
});

const env: Env = { OPENROUTER_KEY: "trial-key" };
const messages = [{ role: "user" as const, content: "make a card" }];

describe("renderTrial", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the batch on a valid tool response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(toolResponse({ messages: validBatch })), { status: 200 }),
      ),
    );
    const batch = await renderTrial(env, messages, "openai/gpt-5.4-mini");
    expect(batch).toEqual(validBatch);
  });

  it("sends the trial key and requested model, never a :free-restricted list", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(toolResponse({ messages: validBatch })), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await renderTrial(env, messages, "openai/gpt-5.4-mini");
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { model: string };
    expect(body.model).toBe("openai/gpt-5.4-mini");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer trial-key");
  });

  it("returns null on a provider failure (HTTP error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    expect(await renderTrial(env, messages, "openai/gpt-5.4-mini")).toBeNull();
  });

  it("returns null when no OpenRouter key is configured", async () => {
    expect(await renderTrial({}, messages, "openai/gpt-5.4-mini")).toBeNull();
  });
});
