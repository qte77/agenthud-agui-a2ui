import { describe, it, expect } from "vitest";
import { candidateModels, classifyFailure } from "../src/agent/fallback";
import { ENDPOINTS } from "../src/config";

// #210 fall-through: the pure pieces — the candidate-model list (same provider, chosen-first, capped)
// and the BYOK-cost-aware failure classifier (retry on 429/5xx/network; stop on bad key / no credits).
const OR = "https://openrouter.ai/api/v1";
const orModels = ENDPOINTS.find((e) => e.baseURL === OR)?.models ?? [];

describe("candidateModels", () => {
  it("puts the chosen model first, then the provider's others, deduped", () => {
    const chosen = orModels[1]!;
    const out = candidateModels(OR, chosen);

    expect(out[0]).toBe(chosen);
    expect(new Set(out).size).toBe(out.length);
    expect(out.every((m) => m === chosen || orModels.includes(m))).toBe(true);
  });

  it("caps the candidate count (default 3)", () => {
    expect(candidateModels(OR, orModels[0]!).length).toBeLessThanOrEqual(3);
  });

  it("returns only the chosen model for an unknown/custom provider", () => {
    expect(candidateModels("https://unknown.example/v1", "some-model")).toEqual(["some-model"]);
  });

  it("keeps the chosen model first even when it isn't in the provider's list", () => {
    const out = candidateModels(OR, "my-custom-id");
    expect(out[0]).toBe("my-custom-id");
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe("classifyFailure", () => {
  it("does not retry a bad key (401/403)", () => {
    expect(classifyFailure({ statusCode: 401 }).retry).toBe(false);
    expect(classifyFailure({ statusCode: 403 }).retry).toBe(false);
  });

  it("does not retry on no credits (402), with a credit hint", () => {
    const r = classifyFailure({ statusCode: 402 });
    expect(r.retry).toBe(false);
    expect(r.message).toMatch(/credit|payment/i);
  });

  it("retries on rate limit (429) and provider 5xx", () => {
    expect(classifyFailure({ statusCode: 429 }).retry).toBe(true);
    expect(classifyFailure({ statusCode: 503 }).retry).toBe(true);
  });

  it("retries on a network error", () => {
    expect(classifyFailure(new TypeError("Failed to fetch")).retry).toBe(true);
  });

  it("retries on an unknown error (transient by default)", () => {
    expect(classifyFailure(new Error("weird")).retry).toBe(true);
  });
});
