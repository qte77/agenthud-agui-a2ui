import { describe, it, expect, vi, afterEach } from "vitest";
import { extractToolArgs, extractBatch, callRenderModel, type ModelCall } from "../src/agent/model";

const toolResponse = (name: string, args: string) => ({
  choices: [{ message: { tool_calls: [{ function: { name, arguments: args } }] } }],
});

const validBatchArgs = JSON.stringify({
  messages: [
    { beginRendering: { surfaceId: "main", root: "root" } },
    {
      surfaceUpdate: {
        surfaceId: "main",
        components: [{ id: "root", component: { Text: { text: { literalString: "hi" } } } }],
      },
    },
  ],
});

describe("extractToolArgs / extractBatch", () => {
  it("pulls parsed args for the named tool", () => {
    expect(extractToolArgs(toolResponse("render_ui", '{"messages":[]}'), "render_ui")).toEqual({
      messages: [],
    });
  });
  it("returns null for a different tool name", () => {
    expect(extractToolArgs(toolResponse("other", "{}"), "render_ui")).toBeNull();
  });
  it("returns null for non-JSON arguments", () => {
    expect(extractToolArgs(toolResponse("render_ui", "not json"), "render_ui")).toBeNull();
  });
  it("extractBatch returns the messages array", () => {
    expect(extractBatch(toolResponse("render_ui", validBatchArgs))).toHaveLength(2);
  });
  it("extractBatch returns null when messages missing", () => {
    expect(extractBatch(toolResponse("render_ui", "{}"))).toBeNull();
  });
});

describe("callRenderModel", () => {
  afterEach(() => vi.unstubAllGlobals());
  const call: ModelCall = {
    apiKey: "k",
    model: "m:free",
    baseURL: "https://x/v1",
    messages: [{ role: "user", content: "hi" }],
  };

  it("returns the validated batch on a valid tool response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(toolResponse("render_ui", validBatchArgs)), { status: 200 }),
      ),
    );
    const r = await callRenderModel(call);
    expect(r?.batch).toHaveLength(2);
    expect(r?.model).toBe("m:free");
  });
  it("returns null on non-OK HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    expect(await callRenderModel(call)).toBeNull();
  });
  it("returns null when no tool call is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })),
    );
    expect(await callRenderModel(call)).toBeNull();
  });
  it("returns null for an invalid (non-self-contained) batch", async () => {
    const bad = JSON.stringify({ messages: [{ beginRendering: { surfaceId: "main", root: "ghost" } }] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(toolResponse("render_ui", bad)), { status: 200 })),
    );
    expect(await callRenderModel(call)).toBeNull();
  });
  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect(await callRenderModel(call)).toBeNull();
  });
  it("sends the api key only in the Authorization header", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(toolResponse("render_ui", validBatchArgs)), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await callRenderModel(call);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer k");
    expect(init.body as string).not.toContain("Bearer k");
  });
});
