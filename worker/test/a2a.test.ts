import { describe, it, expect } from "vitest";
import { extractPromptFromMessage, buildCompletedTask, a2aFetch } from "../src/a2a/handler";

describe("extractPromptFromMessage", () => {
  it("concatenates the text of an A2A message's text parts", () => {
    const msg = {
      kind: "message",
      role: "user",
      messageId: "m1",
      parts: [
        { kind: "text", text: "make " },
        { kind: "text", text: "a card" },
      ],
    };
    expect(extractPromptFromMessage(msg)).toBe("make a card");
  });

  it("ignores non-text parts and returns '' when there is no text", () => {
    expect(extractPromptFromMessage({ parts: [{ kind: "data", data: {} }] })).toBe("");
    expect(extractPromptFromMessage({})).toBe("");
  });
});

describe("buildCompletedTask", () => {
  it("wraps the batch as a completed Task carrying a data artifact", () => {
    const batch = [{ beginRendering: { surfaceId: "main", root: "root" } }];
    const task = buildCompletedTask("t1", "c1", batch);
    expect(task.kind).toBe("task");
    expect(task.id).toBe("t1");
    expect(task.contextId).toBe("c1");
    expect(task.status.state).toBe("completed");
    expect(task.artifacts[0]?.parts[0]).toEqual({ kind: "data", data: { a2uiMessages: batch } });
  });
});

describe("a2aFetch", () => {
  const rpc = (method: string, params: unknown = {}) =>
    new Request("https://worker.example/a2a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
    });

  it("returns JSON-RPC -32601 for an unsupported method", async () => {
    const res = await a2aFetch(rpc("tasks/cancel"), {});
    const body: { id?: unknown; error?: { code?: number } } = await res.json();
    expect(body.id).toBe(7);
    expect(body.error?.code).toBe(-32601);
  });

  it("returns JSON-RPC -32602 when message/send has no text part", async () => {
    const res = await a2aFetch(rpc("message/send", { message: { parts: [] } }), {});
    const body: { error?: { code?: number } } = await res.json();
    expect(body.error?.code).toBe(-32602);
  });
});

describe("a2aFetch JSON-RPC edge cases (#338)", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("https://worker.example/a2a", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });
  const errCode = async (res: Response) => (await res.json<{ error?: { code?: number } }>()).error?.code;

  it("answers a literal null body with -32600, not a thrown 500", async () => {
    expect(await errCode(await a2aFetch(post("null"), {}))).toBe(-32600);
  });

  it("rejects a batch (JSON array) with -32600", async () => {
    const batch = JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "SendMessage" }]);
    expect(await errCode(await a2aFetch(post(batch), {}))).toBe(-32600);
  });

  it("rejects a request whose jsonrpc member is not \"2.0\" with -32600", async () => {
    const body = JSON.stringify({ id: 1, method: "SendMessage", params: {} });
    expect(await errCode(await a2aFetch(post(body), {}))).toBe(-32600);
  });

  it("sends no reply and renders nothing for a notification (no id)", async () => {
    const body = JSON.stringify({ jsonrpc: "2.0", method: "SendMessage", params: { message: { parts: [{ text: "hi" }] } } });
    const res = await a2aFetch(post(body), {});
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("rejects an oversized body with 413 (declared length)", async () => {
    const res = await a2aFetch(post("{}", { "content-length": String(2 * 1_048_576) }), {});
    expect(res.status).toBe(413);
  });

  it("rejects an oversized body with 413 (actual bytes, no content-length)", async () => {
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x", params: { pad: "a".repeat(1_048_577) } });
    const res = await a2aFetch(post(big), {});
    expect(res.status).toBe(413);
  });

  it("rejects an over-long prompt with -32602 before rendering", async () => {
    const text = "a".repeat(8_001);
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { parts: [{ text }] } } });
    expect(await errCode(await a2aFetch(post(body), {}))).toBe(-32602);
  });
});
