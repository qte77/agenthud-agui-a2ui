/*
 * Keyless free-fallback render chain: try each provider in order, first VALID batch wins; null if
 * none produce one (caller → deterministic stub). The chain is built only from bindings/secrets
 * present, cheapest-first: Cloudflare Workers AI (free, no key) → OpenRouter restricted to `:free`
 * model ids (uses our key but never spends). No spend on our part — the `:free` lock is enforced in
 * code by assertFreeId. (GitHub Models was dropped — retired 2026-07-30, removed in #165.)
 *
 * Render-only slice ported from ldnmxx-hack: dropped the generic ToolSpec chain (agenthud has one
 * tool) and kept the `.bind(ai)` Workers-AI gotcha, which a plain unit-test fn would miss.
 */

import { RENDER_UI_TOOL } from "./prompts";
import { callRenderModel, toResult, type ModelResult, type ORResponse } from "./model";

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Defaults are tuning knobs (overridable via env) — a wrong pick is non-fatal (the chain falls
// through to the next id/tier, then the stub). Carried from ldnmxx (verified 2026-07-08); REFRESH
// against OpenRouter's live `:free` + tool-capable list at deploy time.
export const DEFAULT_WORKERS_AI_MODEL = "@cf/openai/gpt-oss-120b";
export const DEFAULT_OPENROUTER_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export interface CallArgs {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}

export interface Provider {
  name: string;
  tryRender(args: CallArgs): Promise<ModelResult | null>;
}

/** The $0 lock: an OpenRouter model id MUST end `:free`. (Workers AI is inherently free — no check.) */
export function assertFreeId(model: string): boolean {
  return model.endsWith(":free");
}

/**
 * Cloudflare Workers AI (free, no key) via the AI binding. Bind `run` to `ai` — the binding uses
 * private fields (this.#options), so a detached call throws "Cannot set properties of undefined
 * (setting '#options')". (Unit tests use a plain fn, so they miss this — hence the explicit .bind.)
 */
export function workersAiProvider(ai: Ai, model: string = DEFAULT_WORKERS_AI_MODEL): Provider {
  return {
    name: "workers-ai",
    async tryRender({ messages, signal }: CallArgs): Promise<ModelResult | null> {
      try {
        const run = (
          ai.run as unknown as (
            m: string,
            inputs: unknown,
            options?: { signal?: AbortSignal },
          ) => Promise<unknown>
        ).bind(ai);
        const out = (await run(
          model,
          {
            messages,
            tools: [RENDER_UI_TOOL],
            tool_choice: { type: "function", function: { name: "render_ui" } },
            temperature: 0.2,
            max_tokens: 8000,
          },
          signal ? { signal } : undefined,
        )) as ORResponse;
        return toResult(out, model);
      } catch {
        return null;
      }
    },
  };
}

/**
 * OpenRouter restricted to `:free` model ids — uses OPENROUTER_KEY but never spends. Walks the list
 * (first valid batch wins; `:free` ids rate-limit / rotate), logging each fall-through for
 * `wrangler tail`. Non-`:free` ids are filtered out up front so an env override can't leak spend.
 */
export function openRouterFreeProvider(
  key: string,
  models: string[] = DEFAULT_OPENROUTER_FREE_MODELS,
): Provider {
  const free = models.filter(assertFreeId);
  return {
    name: "openrouter-free",
    async tryRender({ messages, signal }: CallArgs): Promise<ModelResult | null> {
      for (const model of free) {
        const result = await callRenderModel({
          apiKey: key,
          model,
          baseURL: OPENROUTER_BASE,
          messages,
          ...(signal ? { signal } : {}),
        });
        if (result) return result;
        console.warn("openrouter-free: fell through", model);
      }
      return null;
    },
  };
}

/** First provider to return a valid batch wins; returns which provider won (for observability). */
export async function renderFree(
  providers: Provider[],
  args: CallArgs,
): Promise<{ result: ModelResult; provider: string } | null> {
  for (const p of providers) {
    const result = await p.tryRender(args);
    if (result) return { result, provider: p.name };
  }
  return null;
}

/** Build the chain from whatever bindings/secrets are present, cheapest-first (skips absent tiers). */
export function buildProviders(opts: {
  ai?: Ai | undefined;
  openRouterKey?: string | undefined;
  openRouterFreeModels?: string[] | undefined;
  workersAiModel?: string | undefined;
}): Provider[] {
  const list: Provider[] = [];
  if (opts.ai) list.push(workersAiProvider(opts.ai, opts.workersAiModel ?? DEFAULT_WORKERS_AI_MODEL));
  if (opts.openRouterKey) {
    list.push(openRouterFreeProvider(opts.openRouterKey, opts.openRouterFreeModels ?? DEFAULT_OPENROUTER_FREE_MODELS));
  }
  return list;
}
