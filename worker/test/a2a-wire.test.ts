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

const rpc = (method: string, params: unknown) =>
  new Request("https://worker.example/a2a", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
        status: { state: string; message?: { role: string; parts: unknown[]; kind?: unknown } };
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
    const status = body.result?.task?.status;
    expect(status?.state).toBe("TASK_STATE_FAILED");
    expect(status?.message?.role).toBe("ROLE_AGENT");
    expect(status?.message).not.toHaveProperty("kind");
    expect(status?.message?.parts).toEqual([
      { text: "No free model produced a valid A2UI batch (provider chain exhausted)." },
    ]);
    expect(body.result?.task?.artifacts).toEqual([]);
  });

  it("returns JSON-RPC -32602 when the message has no text part", async () => {
    const body: V1Result = await (
      await a2aFetch(rpc("SendMessage", { message: { messageId: "m1", role: "ROLE_USER", parts: [{ data: {} }] } }), {})
    ).json();
    expect(body.error?.code).toBe(-32602);
    expect(render).not.toHaveBeenCalled();
  });
});
