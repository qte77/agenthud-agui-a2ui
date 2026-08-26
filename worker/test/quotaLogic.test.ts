import { describe, it, expect } from "vitest";
import { tryConsume } from "../src/trial/quotaLogic";

describe("tryConsume", () => {
  it("allows a fresh count under the cap and returns the incremented next count", () => {
    const r = tryConsume(0, 3);
    expect(r.allowed).toBe(true);
    expect(r.next).toBe(1);
    expect(r.remaining).toBe(2);
  });

  it("allows the last use exactly at the boundary (current = cap - 1)", () => {
    const r = tryConsume(2, 3);
    expect(r.allowed).toBe(true);
    expect(r.next).toBe(3);
    expect(r.remaining).toBe(0);
  });

  it("denies once current has reached the cap", () => {
    const r = tryConsume(3, 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.next).toBe(3); // unchanged — a denial never persists an increment
  });

  it("denies further attempts once already over the cap", () => {
    const r = tryConsume(5, 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("a cap of 0 denies immediately, even from a fresh count", () => {
    const r = tryConsume(0, 0);
    expect(r.allowed).toBe(false);
    expect(r.next).toBe(0);
  });
});
