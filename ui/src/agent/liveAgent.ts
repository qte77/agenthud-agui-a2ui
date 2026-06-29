import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { A2UIMessageBatchSchema } from "./contract";
import type { AgentEvent } from "./applyA2UIEvent";

// BYOK connection details — supplied by the visitor, held in sessionStorage only
// (never persisted), per US-7. Any CORS-friendly OpenAI-compatible endpoint works
// (e.g. OpenRouter); GitHub Models / Google route via the edge proxy — see worker/README.md (US-6).
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

/** Convert an unknown stream error value to a safe string message. */
function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
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
      return { type: "RUN_ERROR", text: errorText(part.error) };
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
- Containers list children by id: { "Column": { "children": { "explicitList": ["a","b"] } } }
- Text uses a literal: { "Text": { "text": { "literal": "Hello" }, "usageHint": "h2" } }
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
