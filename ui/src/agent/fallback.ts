import { ENDPOINTS } from "../config";
import { toConnectionError } from "./liveAgent";

// Model fall-through chain (#210). Two pure pieces the streaming loop in useLiveAgent composes:
// the candidate list (which models to try, in order) and the failure classifier (retry vs stop).

const FALLBACK_CAP = 3;

/**
 * Ordered candidate models for the fall-through chain: the user's chosen model FIRST, then the SAME
 * provider's other curated models (BYOK = one key = one provider, so we can't cross providers), deduped
 * and capped. An unknown / Custom baseURL (no `ENDPOINTS` match, or no `models`) yields just the chosen
 * model — no fallback.
 */
export function candidateModels(
  baseURL: string,
  chosenModel: string,
  cap: number = FALLBACK_CAP
): string[] {
  const others = ENDPOINTS.find((e) => e.baseURL === baseURL)?.models ?? [];
  return [chosenModel, ...others.filter((m) => m !== chosenModel)].slice(0, cap);
}

/** HTTP status from an unknown error (AI SDK `APICallError.statusCode`, or a plain `.status`). */
function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: unknown; status?: unknown } | null;
  const s = e?.statusCode ?? e?.status;
  return typeof s === "number" ? s : undefined;
}

/**
 * BYOK-cost-aware failure classification. Retrying another model only helps when the CURRENT model is the
 * problem (rate-limited / provider 5xx / a transient network blip) — never when the KEY is (bad key, no
 * credits), so those STOP immediately instead of burning the visitor's tokens on doomed retries. Unknown
 * errors are treated as transient (retry; the attempt cap bounds the loop).
 */
export function classifyFailure(err: unknown): { retry: boolean; message: string } {
  const status = statusOf(err);
  if (status === 401 || status === 403)
    return { retry: false, message: `Authentication failed (${String(status)}) — check your API key.` };
  if (status === 402)
    return { retry: false, message: "Out of credits (402) — this key/account has no remaining credits." };
  if (status === 429) return { retry: true, message: "Rate limited (429)" };
  if (status !== undefined && status >= 500) return { retry: true, message: `Provider error (${String(status)})` };
  return { retry: true, message: toConnectionError(err) };
}
