/*
 * Shared keyless render seam: one natural-language prompt → the free provider chain (Cloudflare
 * Workers AI first, then OpenRouter `:free`) → a validated A2UI batch, or null when the chain is
 * exhausted. Extracted once the pattern stabilised across three callers — the keyless HTTP endpoint
 * (`handleKeylessRender`), the MCP `render_ui` tool, and the A2A `message/send` handler.
 */

import type { Env } from "../router";
import type { ChatMessage } from "./model";
import { buildProviders, renderFree } from "./providers";
import { SYSTEM_PROMPT } from "./prompts";

/** Run the free chain for one prompt (server-owned system prompt prepended). Batch, or null. */
export async function renderFromPrompt(
  env: Env,
  prompt: string,
  timeoutMs = 20_000,
): Promise<unknown[] | null> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
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
    const free = await renderFree(providers, { messages, signal: ac.signal });
    return free ? free.result.batch : null;
  } finally {
    clearTimeout(timer);
  }
}
