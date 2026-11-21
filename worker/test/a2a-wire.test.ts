/*
 * #278: the /a2a wire format, both protocol versions.
 *
 * v0.3 ("message/send"): GOLDEN bodies captured from main at 6ff2344 before the v1.0 work, so the
 * legacy response is shown to stay byte for byte the same for existing callers.
 *
 * v1.0 ("SendMessage"): shapes follow the A2A protobuf definition at tag v1.0.0,
 * a2aproject/A2A `specification/a2a.proto` (proto field names, camelCase in JSON): the send result is
 * a `task`/`message` oneof, Message has no `kind` and an enum role, Part is a content oneof, and the
 * task state is the TaskState enum string.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/agent/render", () => ({ renderFromMessages: vi.fn() }));

import { renderFromMessages } from "../src/agent/render";
import { a2aFetch } from "../src/a2a/handler";

const BATCH = [{ beginRendering: { surfaceId: "main", root: "root" } }];
const render = vi.mocked(renderFromMessages);

const rpc = (method: string, params: unknown, headers: Record<string, string> = {}, query = "") =>
  new Request(`https://worker.example/a2a${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
  });

beforeEach(() => {
  let n = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    n += 1;
    return `00000000-0000-4000-8000-00000000000${String(n)}`;
  });
  render.mockReset();
});

describe("v0.3 message/send (golden, unchanged)", () => {
  const params = { message: { kind: "message", role: "user", messageId: "m1", parts: [{ kind: "text", text: "a card" }] } };

  it("returns the completed Task exactly as before", async () => {
    render.mockResolvedValue(BATCH);
    const body = await (await a2aFetch(rpc("message/send", params), {})).text();
    expect(body).toBe(
      '{"jsonrpc":"2.0","id":7,"result":{"kind":"task","id":"00000000-0000-4000-8000-000000000002",' +
        '"contextId":"00000000-0000-4000-8000-000000000001","status":{"state":"completed"},' +
        '"artifacts":[{"artifactId":"00000000-0000-4000-8000-000000000002-ui","name":"a2ui",' +
        '"parts":[{"kind":"data","data":{"a2uiMessages":[{"beginRendering":{"surfaceId":"main","root":"root"}}]}}]}]}}',
    );
  });

  it("returns the failed Task exactly as before when the render chain is exhausted", async () => {
    render.mockResolvedValue(null);
    const body = await (await a2aFetch(rpc("message/send", params), {})).text();
    expect(body).toBe(
      '{"jsonrpc":"2.0","id":7,"result":{"kind":"task","id":"00000000-0000-4000-8000-000000000002",' +
        '"contextId":"00000000-0000-4000-8000-000000000001","status":{"state":"failed","message":{"kind":"message",' +
        '"role":"agent","messageId":"00000000-0000-4000-8000-000000000002-err","parts":[{"kind":"text",' +
        '"text":"No free model produced a valid A2UI batch (provider chain exhausted)."}]}},"artifacts":[]}}',
    );
  });
});

describe("v1.0 SendMessage", () => {
  const params = {
    message: { messageId: "m1", contextId: "ctx-9", role: "ROLE_USER", parts: [{ text: "a login " }, { text: "card" }] },
  };
  interface V1Result {
    result?: {
      task?: {
        id: string;
        contextId: string;
        status: {
          state: string;
          message?: { role: string; parts: unknown[]; contextId?: string; taskId?: string; kind?: unknown };
        };
        artifacts: { artifactId: string; name?: string; parts: unknown[] }[];
        kind?: unknown;
      };
    };
    error?: { code: number };
  }

  it("renders the text parts (no `kind` on parts) and returns a completed task in the result oneof", async () => {
    render.mockResolvedValue(BATCH);
    const body: V1Result = await (await a2aFetch(rpc("SendMessage", params), {})).json();
    expect(render).toHaveBeenCalledWith({}, [{ role: "user", content: "a login card" }]);
    const task = body.result?.task;
    expect(task?.contextId).toBe("ctx-9");
    expect(task?.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task).not.toHaveProperty("kind");
    expect(task?.artifacts).toEqual([
      {
        artifactId: `${task?.id ?? ""}-ui`,
        name: "a2ui",
        parts: [{ data: { a2uiMessages: BATCH }, mediaType: "application/json" }],
      },
    ]);
  });

  it("returns a failed task with an agent message when the render chain is exhausted", async () => {
    render.mockResolvedValue(null);
    const body: V1Result = await (await a2aFetch(rpc("SendMessage", params), {})).json();
    const task = body.result?.task;
    expect(task?.status.state).toBe("TASK_STATE_FAILED");
    expect(task?.artifacts).toEqual([]);
    // a2a.proto: a server message about a task carries the task's contextId and taskId
    expect(task?.status.message).toEqual({
      messageId: `${task?.id ?? ""}-err`,
      contextId: "ctx-9",
      taskId: task?.id,
      role: "ROLE_AGENT",
      parts: [{ text: "No free model produced a valid A2UI batch (provider chain exhausted)." }],
    });
  });

  it("returns JSON-RPC -32602 when the message has no text part", async () => {
    const body: V1Result = await (
      await a2aFetch(rpc("SendMessage", { message: { messageId: "m1", role: "ROLE_USER", parts: [{ data: {} }] } }), {})
    ).json();
    expect(body.error?.code).toBe(-32602);
    expect(render).not.toHaveBeenCalled();
  });
});

// Spec v1.0.0 section 3.6.2: an empty A2A-Version means 0.3; an unsupported version gets
// VersionNotSupportedError (-32009) with a google.rpc.ErrorInfo in error.data (section 9.5).
// The protocol shape still follows the method name (section 9.4's own example pairs
// A2A-Version 0.3 with SendMessage).
describe("A2A-Version", () => {
  const params = { message: { messageId: "m1", role: "ROLE_USER", parts: [{ text: "a card" }] } };
  interface Err {
    error?: { code: number; data?: { "@type": string; reason: string; domain: string }[] };
  }

  it.each([[{}], [{ "A2A-Version": "" }], [{ "A2A-Version": "1.0" }], [{ "A2A-Version": "0.3" }]])(
    "answers a request with headers %j",
    async (headers) => {
      render.mockResolvedValue(BATCH);
      const body: { result?: unknown } & Err = await (await a2aFetch(rpc("SendMessage", params, headers), {})).json();
      expect(body.error).toBeUndefined();
      expect(body.result).toBeDefined();
    },
  );

  it.each(["2.0", "0.2", "1", "latest"])("refuses version %s with -32009 and an ErrorInfo", async (v) => {
    const body: Err = await (await a2aFetch(rpc("SendMessage", params, { "A2A-Version": v }), {})).json();
    expect(body.error?.code).toBe(-32009);
    expect(body.error?.data).toEqual([
      { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "VERSION_NOT_SUPPORTED", domain: "a2a-protocol.org" },
    ]);
    expect(render).not.toHaveBeenCalled();
  });

  it("reads the version from the A2A-Version query parameter too", async () => {
    const body: Err = await (await a2aFetch(rpc("SendMessage", params, {}, "?A2A-Version=2.0"), {})).json();
    expect(body.error?.code).toBe(-32009);
  });
});

describe("message/send input", () => {
  it("accepts a v1.0-style text part without `kind` (both part forms are read on purpose)", async () => {
    render.mockResolvedValue(BATCH);
    const res = await a2aFetch(rpc("message/send", { message: { parts: [{ text: "a card" }] } }), {});
    const body: { result?: { kind?: string } } = await res.json();
    expect(render).toHaveBeenCalledWith({}, [{ role: "user", content: "a card" }]);
    expect(body.result?.kind).toBe("task");
  });
});
