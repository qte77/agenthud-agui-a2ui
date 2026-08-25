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
