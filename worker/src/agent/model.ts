/*
 * Server-side forced-tool render call: the model answers by calling the single forced `render_ui`
 * tool, grounded in the conversation. Hand-rolled OpenAI-compatible fetch (no SDK) to stay light on
 * Workers. Returns a validated batch, or null on ANY failure (HTTP, no/empty tool call, invalid,
 * throw) so the caller falls back to its deterministic stub — the demo can never break.
 *
 * Render-only slice ported from ldnmxx-hack (dropped the generic multi-tool ToolSpec layer + usage
 * tracing — agenthud has exactly one tool). The api key rides ONLY in the Authorization header.
 */

import { RENDER_UI_TOOL } from "./prompts";
import { isValidBatch } from "./contract";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelCall {
  apiKey: string;
  model: string;
  baseURL: string; // OpenAI-compatible base, e.g. https://openrouter.ai/api/v1
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface ModelResult {
  batch: unknown[];
  model: string;
}

/** The OpenAI-compatible tool-call response shape we consume (OpenRouter + Workers AI both emit it). */
export interface ORResponse {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
}

// Tool JSON can be large (esp. the A2UI batch); too low truncates it → fallback.
const MAX_TOKENS = 8000;

/** Pull the named tool's parsed arguments. Null if the first tool call is absent/different/non-JSON. */
export function extractToolArgs(data: ORResponse, toolName: string): Record<string, unknown> | null {
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (call?.name !== toolName || typeof call.arguments !== "string") return null;
  try {
    return JSON.parse(call.arguments) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Pull the render_ui batch (its `messages` array) out of a tool-call response. Null if malformed. */
export function extractBatch(data: ORResponse): unknown[] | null {
  const args = extractToolArgs(data, "render_ui");
  return args && Array.isArray(args.messages) ? (args.messages as unknown[]) : null;
}

/** Extract + structurally validate a tool response into a ModelResult, or null. Shared by fetch + AI. */
export function toResult(data: ORResponse, model: string): ModelResult | null {
  const batch = extractBatch(data);
  if (!batch || !isValidBatch(batch)) return null;
  return { batch, model };
}

/** Force render_ui over an OpenAI-compatible endpoint, extract + validate the batch. Null on failure. */
export async function callRenderModel(opts: ModelCall): Promise<ModelResult | null> {
  try {
    const res = await fetch(`${opts.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: [RENDER_UI_TOOL],
        tool_choice: { type: "function", function: { name: "render_ui" } },
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (!res.ok) {
      console.warn("model fallback: HTTP", res.status);
      return null;
    }
    const data: ORResponse = await res.json();
    const result = toResult(data, opts.model);
    if (!result) console.warn("model fallback: no/invalid render_ui batch (raise max_tokens if truncated)");
    return result;
  } catch {
    return null; // network error, timeout (AbortSignal), bad JSON — caller uses its stub
  }
}
