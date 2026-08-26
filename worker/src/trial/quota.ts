/*
 * TrialQuotaDO: thin runtime glue around quotaLogic.tryConsume — reads/persists this instance's
 * count via ctx.storage (strongly consistent, single-threaded per named instance, so concurrent
 * requests to the SAME name can't race a read-then-increment; see quotaLogic.ts for the tested
 * decision logic). One class serves two roles by naming convention, not by two classes:
 *   - getByName(<visitor-ip>) — permanent per-visitor cap, never resets (resetDaily=false).
 *   - getByName("__global_daily__") — shared daily circuit-breaker, resets at UTC midnight
 *     (resetDaily=true) via a Durable Object alarm.
 * Not unit-tested (this worker has no @cloudflare/vitest-pool-workers harness to simulate a real
 * DO's ctx.storage) — verified by effect: `wrangler dev` + curl the trial route repeatedly.
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../router";
import { tryConsume as decide, type QuotaDecision } from "./quotaLogic";

const COUNT_KEY = "count";

/** Ms until the next UTC midnight from `now` (exposed for the one thing worth isolating: the math). */
export function msUntilNextUtcMidnight(now: number): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now;
}

export class TrialQuotaDO extends DurableObject<Env> {
  /** Consume one use if under `cap`. `resetDaily` schedules a UTC-midnight reset alarm (idempotent —
   *  only sets one if none is currently scheduled), for the shared daily-cap instance only. */
  async tryConsume(cap: number, resetDaily = false): Promise<Omit<QuotaDecision, "next">> {
    if (resetDaily && (await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + msUntilNextUtcMidnight(Date.now()));
    }
    const current = (await this.ctx.storage.get<number>(COUNT_KEY)) ?? 0;
    const decision = decide(current, cap);
    if (decision.allowed) await this.ctx.storage.put(COUNT_KEY, decision.next);
    return { allowed: decision.allowed, remaining: decision.remaining };
  }

  /** UTC-midnight reset for the daily-cap instance; reschedules itself for the following midnight. */
  override async alarm(): Promise<void> {
    await this.ctx.storage.put(COUNT_KEY, 0);
    await this.ctx.storage.setAlarm(Date.now() + msUntilNextUtcMidnight(Date.now()));
  }

  /** Give back one use after tryConsume allowed it but the render then failed — a provider hiccup
   *  shouldn't cost the visitor one of their few tries. Floored at 0 (never goes negative). */
  async refund(): Promise<void> {
    const current = (await this.ctx.storage.get<number>(COUNT_KEY)) ?? 0;
    await this.ctx.storage.put(COUNT_KEY, Math.max(0, current - 1));
  }
}
