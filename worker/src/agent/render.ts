/*
 * Shared keyless render seam: a message history → the free provider chain (Cloudflare Workers AI
 * first, then OpenRouter `:free`) → a validated A2UI batch, or null when the chain is exhausted.
 * Extracted once the pattern stabilised across three callers — the keyless HTTP endpoint
 * (`handleKeylessRender`), the MCP `render_ui` tool, and the A2A `message/send` handler — all of
 * which go through this one function; none talks to `./providers` directly.
 */

import type { Env } from "../router";
import type { ChatMessage } from "./model";
import { buildProviders, renderFree } from "./providers";
import { SYSTEM_PROMPT } from "./prompts";

/** Run the free chain for a turn history (server-owned system prompt prepended). Batch, or null. */
export async function renderFromMessages(
  env: Env,
  messages: ChatMessage[],
  timeoutMs = 20_000,
): Promise<unknown[] | null> {
  const withSystem: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
  const providers = buildProviders({
    ai: env.AI,
    openRouterKey: env.OPENROUTER_KEY,
    openRouterFreeModels: env.OPENROUTER_FREE_MODELS
      ? env.OPENROUTER_FREE_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
  });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const free = await renderFree(providers, { messages: withSystem, signal: ac.signal });
    return free ? free.result.batch : null;
  } finally {
    clearTimeout(timer);
  }
}
