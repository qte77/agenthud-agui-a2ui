/*
 * Trial-key render: ONE call against a real, non-`:free` OpenRouter model, using the SAME
 * OPENROUTER_KEY secret the keyless free chain already holds (the `:free` restriction lives in
 * providers.ts's code, not the key itself, so no new secret is needed). Deliberately no
 * buildProviders/renderFree fallback chain — that machinery exists to walk multiple free tiers;
 * a single-provider paid trial doesn't need it. Null on any failure (caller decides how to
 * surface it — unlike the free chain, a trial failure should NOT be masked by a stub, since
 * silently hiding a failure on a real-money, hard-capped resource would be dishonest about what
 * happened).
 */

import type { Env } from "../router";
import type { ChatMessage } from "./model";
import { callRenderModel } from "./model";
import { OPENROUTER_BASE } from "./providers";
import { SYSTEM_PROMPT } from "./prompts";

/** Run one trial render against `model` using the server-held OpenRouter key. Batch, or null. */
export async function renderTrial(
  env: Env,
  messages: ChatMessage[],
  model: string,
): Promise<unknown[] | null> {
  if (!env.OPENROUTER_KEY) return null;
  const result = await callRenderModel({
    apiKey: env.OPENROUTER_KEY,
    model,
    baseURL: OPENROUTER_BASE,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });
  return result?.batch ?? null;
}
