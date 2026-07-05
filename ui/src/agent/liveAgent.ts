import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { A2UIMessageBatchSchema } from "./contract";
import type { AgentEvent } from "./applyA2UIEvent";
import type { UserTurn } from "./conversation";
import { SYSTEM_PROMPT } from "./systemPrompt";

// BYOK connection details — supplied by the visitor. The API key is held in memory only (never
// persisted); base URL + model persist in sessionStorage. Per US-7. Any CORS-friendly
// OpenAI-compatible endpoint works (e.g. OpenRouter); GitHub Models / Google route via the edge
// proxy — see worker/README.md (US-6).
export interface LiveSettings {
  baseURL: string;
  apiKey: string;
  model: string;
}

/** Loose view of an AI SDK v6 `fullStream` part — only the fields we read. */
export interface StreamPart {
  type: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  error?: unknown;
}

/**
 * Friendlier connection error. The browser hides the real CORS reason from JS — a blocked or failed
 * cross-origin fetch only surfaces as a generic TypeError ("NetworkError" / "Failed to fetch") — so
 * spell out the likely causes instead of the bare message.
 */
export function toConnectionError(err: unknown): string {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
  if (/networkerror|failed to fetch|load failed/i.test(msg)) {
    return `${msg} — the request was blocked or could not connect. Likely a browser extension or tracking protection blocking cross-origin requests, a network/VPN/antivirus filter, or (for "(via proxy)" endpoints) a wrong base URL or the local worker not running.`;
  }
  return msg;
}

/**
 * Pure seam: map one Vercel AI SDK `fullStream` part to the AG-UI event vocabulary
 * the EventStream + `applyA2UIEvent` already consume. A completed `render_ui` tool
 * call carries the A2UI batch (validated downstream by the contract). Returns null
 * for parts we don't surface.
 */
export function streamPartToEvent(part: StreamPart): AgentEvent | null {
  switch (part.type) {
    case "start":
      return { type: "RUN_STARTED" };
    case "text-delta":
      return part.text ? { type: "TEXT_MESSAGE_CONTENT", text: part.text } : null;
    case "tool-input-start":
      return { type: "TOOL_CALL_START", text: part.toolName };
    case "tool-call": {
      if (part.toolName === "render_ui") {
        const messages = (part.input as { messages?: unknown[] } | undefined)?.messages;
        return {
          type: "TOOL_CALL_END",
          text: part.toolName,
          a2uiMessages: Array.isArray(messages) ? messages : [],
        };
      }
      return { type: "TOOL_CALL_END", text: part.toolName };
    }
    case "finish":
      return { type: "RUN_FINISHED" };
    case "error":
      return { type: "RUN_ERROR", text: toConnectionError(part.error) };
    default:
      return null;
  }
}

// The agent's single tool. Its inputSchema reuses the zod A2UI contract, so the SDK
// validates the model's output (and can repair it) — the same schema the renderer
// re-validates. DRY: one contract for internal + external data.
const renderUiInput = z.object({ messages: A2UIMessageBatchSchema });

function buildRenderUiTool() {
  return tool({
    description:
      "Draw the on-screen UI by emitting a batch of A2UI messages on the 'main' " +
      "surface. Use only the standard catalog component types.",
    inputSchema: renderUiInput,
    // The UI is carried by the call arguments; nothing meaningful to return.
    execute: () => "rendered",
  });
}

/**
 * Run a BYOK live agent in the browser and stream AG-UI events to `onEvent`.
 * Portable Web-standard TS (fetch/streams) — also runnable on an edge worker.
 */
export async function runLiveAgent(
  settings: LiveSettings,
  messages: UserTurn[],
  onEvent: (event: AgentEvent) => void,
  opts?: { signal?: AbortSignal }
): Promise<void> {
  const openai = createOpenAI({
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
  });

  const result = streamText({
    model: openai.chat(settings.model),
    system: SYSTEM_PROMPT,
    // Full conversation history (user turns only in the MVP) — a button click appends a
    // follow-up turn and re-runs with context. One render_ui call per turn (below).
    messages,
    tools: { render_ui: buildRenderUiTool() },
    // Force exactly one render_ui call: toolChoice removes the "print the batch as prose" failure
    // (token flood, nothing renders) at the source; stepCountIs(1) stops after that one call so the
    // model can't emit JSON-as-text or chain extra calls.
    toolChoice: { type: "tool", toolName: "render_ui" },
    stopWhen: stepCountIs(1),
    // exactOptionalPropertyTypes: only include abortSignal when defined
    ...(opts?.signal ? { abortSignal: opts.signal } : {}),
  });

  for await (const part of result.fullStream) {
    const event = streamPartToEvent(part);
    if (event) onEvent(event);
  }
}
