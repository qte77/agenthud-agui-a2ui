import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { A2UIMessageBatchSchema } from "./contract";
import type { AgentEvent } from "./applyA2UIEvent";

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

const SYSTEM_PROMPT = `You are a UI-composing agent. Answer the user by calling the \`render_ui\` tool to draw an interface on the "main" surface with A2UI messages — never reply in prose alone.

An A2UI batch is an array of messages:
- { "beginRendering": { "surfaceId": "main", "root": "root" } }   (send first)
- { "surfaceUpdate": { "surfaceId": "main", "components": [ ...Component ] } }

A Component is { "id": string, "component": { <Type>: <props> } } with exactly one Type.
- Row / Column / List hold MANY children by id: { "Column": { "children": { "explicitList": ["a","b"] } } }
- Card holds ONE child by id: { "Card": { "child": "an-id" } } — to group several items in a Card, point its child at a Column.
- Text uses a typed literal: { "Text": { "text": { "literalString": "Hello" }, "usageHint": "h2" } }
- Bound values use a TYPED literal, never a bare "literal": strings → { "literalString": "..." }, numbers (e.g. Slider value) → { "literalNumber": 50 }, booleans (e.g. CheckBox value) → { "literalBoolean": true }.
- The root component must have id "root" and list its children.

Catalog types: Text, Image, Divider, Row, Column, Card, Button, CheckBox, Slider, Tabs.
Keep it to a handful of components.`;

/**
 * Run a BYOK live agent in the browser and stream AG-UI events to `onEvent`.
 * Portable Web-standard TS (fetch/streams) — also runnable on an edge worker.
 */
export async function runLiveAgent(
  settings: LiveSettings,
  prompt: string,
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
    prompt,
    tools: { render_ui: buildRenderUiTool() },
    stopWhen: stepCountIs(3),
    // exactOptionalPropertyTypes: only include abortSignal when defined
    ...(opts?.signal ? { abortSignal: opts.signal } : {}),
  });

  for await (const part of result.fullStream) {
    const event = streamPartToEvent(part);
    if (event) onEvent(event);
  }
}
