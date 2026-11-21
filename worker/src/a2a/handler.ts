/*
 * Minimal, honest A2A endpoint (POST /a2a, JSON-RPC 2.0, stateless). Sends a message: extract the
 * prompt from the incoming Message, run the shared free render chain, and return a
 * synchronously-COMPLETED Task carrying the A2UI batch as a `data` artifact (chain exhausted →
 * FAILED). No task persistence (synchronous completion), so no Durable Object.
 *
 * #278: two protocol versions on one endpoint, chosen by the JSON-RPC method name; every other
 * method → -32601.
 * - `SendMessage` (A2A v1.0, a2aproject/A2A `specification/a2a.proto` at tag v1.0.0): the result is
 *   the `task` member of a task/message oneof; no `kind` fields; enum strings for role
 *   (`ROLE_AGENT`) and task state (`TASK_STATE_COMPLETED` / `TASK_STATE_FAILED`); parts are a
 *   content oneof (`{ text }`, `{ data, mediaType }`).
 * - `message/send` (v0.3, a2a-js SDK shape with `kind` discriminators): unchanged for existing callers.
 * `A2A-Version` (header, or the query parameter of the same name; spec section 3.6): missing or
 * empty means 0.3; 0.3 and 1.0 are served; any other value gets VersionNotSupportedError (-32009)
 * with a google.rpc.ErrorInfo in `error.data` (section 9.5). Documented deviation: the response
 * shape follows the method name, not the header, so a v1.0 `SendMessage` sent with no header (or
 * with 0.3, as in the spec's own section 9.2 example) is still answered.
 */

import type { Env } from "../router";
import { renderFromMessages } from "../agent/render";

type Part =
  | { kind: "text"; text: string }
  | { kind: "data"; data: Record<string, unknown> };

interface Message {
  kind: "message";
  role: "agent" | "user";
  messageId: string;
  parts: Part[];
}

interface Artifact {
  artifactId: string;
  name?: string;
  parts: Part[];
}

interface Task {
  kind: "task";
  id: string;
  contextId: string;
  status: { state: "completed" | "failed"; message?: Message };
  artifacts: Artifact[];
}

/** Concatenate the text of a Message's text parts; "" when the message carries none. A text part is
 *  `{ kind: "text", text }` in v0.3 and `{ text }` (no `kind`) in v1.0. */
export function extractPromptFromMessage(message: unknown): string {
  const parts = (message as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(parts)) return "";
  let out = "";
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    const { kind, text } = p as { kind?: unknown; text?: unknown };
    if ((kind === undefined || kind === "text") && typeof text === "string") out += text;
  }
  return out.trim();
}

/** A synchronously-completed Task wrapping the A2UI batch as a single `data` artifact. */
export function buildCompletedTask(id: string, contextId: string, batch: unknown[]): Task {
  return {
    kind: "task",
    id,
    contextId,
    status: { state: "completed" },
    artifacts: [
      {
        artifactId: `${id}-ui`,
        name: "a2ui",
        parts: [{ kind: "data", data: { a2uiMessages: batch } }],
      },
    ],
  };
}

/** A failed Task carrying the reason as an agent message (render chain exhausted). */
function buildFailedTask(id: string, contextId: string, reason: string): Task {
  return {
    kind: "task",
    id,
    contextId,
    status: {
      state: "failed",
      message: { kind: "message", role: "agent", messageId: `${id}-err`, parts: [{ kind: "text", text: reason }] },
    },
    artifacts: [],
  };
}

const FAILED_REASON = "No free model produced a valid A2UI batch (provider chain exhausted).";

/** v1.0 result: the `task` member of the send result oneof. */
function v1Task(id: string, contextId: string, batch: unknown[] | null) {
  const status = batch
    ? { state: "TASK_STATE_COMPLETED" }
    : {
        state: "TASK_STATE_FAILED",
        message: { messageId: `${id}-err`, contextId, taskId: id, role: "ROLE_AGENT", parts: [{ text: FAILED_REASON }] },
      };
  const artifacts = batch
    ? [{ artifactId: `${id}-ui`, name: "a2ui", parts: [{ data: { a2uiMessages: batch }, mediaType: "application/json" }] }]
    : [];
  return { task: { id, contextId, status, artifacts } };
}

/** v0.3 result: the bare Task (unchanged). */
function v03Task(id: string, contextId: string, batch: unknown[] | null): Task {
  return batch ? buildCompletedTask(id, contextId, batch) : buildFailedTask(id, contextId, FAILED_REASON);
}

// JSON-RPC method name → the result shape for that protocol version. A Map, so a method name such as
// "toString" can never resolve to an inherited object property.
const SEND_METHODS = new Map<string, (id: string, contextId: string, batch: unknown[] | null) => unknown>([
  ["SendMessage", v1Task],
  ["message/send", v03Task],
]);

type RpcId = string | number | null;

const SUPPORTED_VERSIONS = new Set(["0.3", "1.0"]);

/** True when the request names an A2A version this endpoint does not serve. */
function unsupportedVersion(request: Request): boolean {
  const raw = request.headers.get("A2A-Version") ?? new URL(request.url).searchParams.get("A2A-Version") ?? "";
  const v = raw.trim();
  if (v === "") return false; // empty or missing = 0.3
  const majorMinor = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(v);
  return !majorMinor || !SUPPORTED_VERSIONS.has(`${majorMinor[1] ?? ""}.${majorMinor[2] ?? ""}`);
}
const rpcResult = (id: RpcId, result: unknown): Response =>
  Response.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcId, code: number, message: string, data?: unknown[]): Response =>
  Response.json({ jsonrpc: "2.0", id, error: data ? { code, message, data } : { code, message } });

const VERSION_NOT_SUPPORTED_INFO = [
  { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "VERSION_NOT_SUPPORTED", domain: "a2a-protocol.org" },
];

/** Send a message: render the prompt, return a completed (or failed) task in the caller's version. */
async function handleMessageSend(
  params: unknown,
  env: Env,
  id: RpcId,
  shape: (id: string, contextId: string, batch: unknown[] | null) => unknown,
): Promise<Response> {
  const message = (params as { message?: unknown } | null)?.message;
  const prompt = extractPromptFromMessage(message);
  if (!prompt) return rpcError(id, -32602, "Invalid params: message has no text part");

  const givenCtx = (message as { contextId?: unknown }).contextId;
  const contextId = typeof givenCtx === "string" && givenCtx ? givenCtx : crypto.randomUUID();
  const taskId = crypto.randomUUID();

  const batch = await renderFromMessages(env, [{ role: "user", content: prompt }]);
  return rpcResult(id, shape(taskId, contextId, batch));
}

/** Stateless A2A JSON-RPC handler for POST /a2a. */
export async function a2aFetch(request: Request, env: Env): Promise<Response> {
  // Shares the AI-cost-bearing free limiter with /agent/render and /mcp.
  if (env.FREE_RATE_LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.FREE_RATE_LIMITER.limit({ key: ip });
    if (!success) return rpcError(null, -32000, "Rate limit exceeded");
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const req = parsed as { id?: unknown; method?: unknown; params?: unknown };
  const id: RpcId = typeof req.id === "string" || typeof req.id === "number" ? req.id : null;

  if (unsupportedVersion(request)) {
    return rpcError(id, -32009, "Version not supported (this agent serves A2A 0.3 and 1.0)", VERSION_NOT_SUPPORTED_INFO);
  }
  const shape = typeof req.method === "string" ? SEND_METHODS.get(req.method) : undefined;
  if (!shape) return rpcError(id, -32601, `Method not found: ${String(req.method)}`);
  return handleMessageSend(req.params, env, id, shape);
}
