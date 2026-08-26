/*
 * Minimal, honest A2A endpoint (POST /a2a, JSON-RPC 2.0, stateless). Implements `message/send`:
 * extract the prompt from the incoming Message, run the shared free render chain, and return a
 * synchronously-COMPLETED Task carrying the A2UI batch as a `data` artifact (chain exhausted →
 * FAILED). Every other method → JSON-RPC -32601. No task persistence (synchronous completion), so no
 * Durable Object. Wire shape follows the A2A JSON-RPC transport (`transport:"JSONRPC"`, a2a-js SDK:
 * `kind` discriminators on Message/Part/Task); transport correctness is verified by effect (curl).
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

/** Concatenate the text of a Message's `text` parts; "" when the message carries none. */
export function extractPromptFromMessage(message: unknown): string {
  const parts = (message as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(parts)) return "";
  let out = "";
  for (const p of parts) {
    if (p && typeof p === "object" && (p as Part).kind === "text") {
      const t = (p as { text?: unknown }).text;
      if (typeof t === "string") out += t;
    }
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

type RpcId = string | number | null;
const rpcResult = (id: RpcId, result: unknown): Response =>
  Response.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcId, code: number, message: string): Response =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } });

/** Handle `message/send`: render the prompt, return a completed (or failed) Task. */
async function handleMessageSend(params: unknown, env: Env, id: RpcId): Promise<Response> {
  const message = (params as { message?: unknown } | null)?.message;
  const prompt = extractPromptFromMessage(message);
  if (!prompt) return rpcError(id, -32602, "Invalid params: message has no text part");

  const givenCtx = (message as { contextId?: unknown }).contextId;
  const contextId = typeof givenCtx === "string" && givenCtx ? givenCtx : crypto.randomUUID();
  const taskId = crypto.randomUUID();

  const batch = await renderFromMessages(env, [{ role: "user", content: prompt }]);
  return rpcResult(
    id,
    batch
      ? buildCompletedTask(taskId, contextId, batch)
      : buildFailedTask(taskId, contextId, "No free model produced a valid A2UI batch (provider chain exhausted)."),
  );
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

  if (req.method !== "message/send") {
    return rpcError(id, -32601, `Method not found: ${String(req.method)}`);
  }
  return handleMessageSend(req.params, env, id);
}
