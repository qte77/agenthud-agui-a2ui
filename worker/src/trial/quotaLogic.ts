/*
 * Pure, storage-agnostic counting decision for the trial-key feature. No I/O — the caller (the
 * TrialQuotaDO Durable Object, see quota.ts) owns reading/persisting the count; this function only
 * decides allow/deny and the count to persist on an allow. Kept pure and unit-testable with plain
 * vitest (this worker has no @cloudflare/vitest-pool-workers dependency to simulate a real DO's
 * ctx.storage), mirroring agent/contract.ts's validateBatch pattern.
 */

export interface QuotaDecision {
  allowed: boolean;
  /** Uses left AFTER this decision (0 on denial). */
  remaining: number;
  /** The count the caller should persist — unchanged from `current` on a denial (never over-counts). */
  next: number;
}

/** Decide whether one more use is allowed under `cap`, given the persisted `current` count. */
export function tryConsume(current: number, cap: number): QuotaDecision {
  if (current >= cap) return { allowed: false, remaining: 0, next: current };
  const next = current + 1;
  return { allowed: true, remaining: cap - next, next };
}
