import { describe, it, expect } from "vitest";
import { resolveUpstream, isAllowedOrigin } from "../src/router";

describe("resolveUpstream", () => {
  it("maps an allowlisted provider to its upstream and appends the sub-path", () => {
    expect(resolveUpstream("/github-models/chat/completions")).toBe(
      "https://models.github.ai/inference/chat/completions",
    );
    expect(resolveUpstream("/google/chat/completions")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
  });

  it("returns the bare upstream when there is no sub-path", () => {
    expect(resolveUpstream("/github-models")).toBe("https://models.github.ai/inference");
  });

  it("returns null for an unknown provider (no open proxy / SSRF)", () => {
    expect(resolveUpstream("/evil.example.com/v1")).toBeNull();
    expect(resolveUpstream("/")).toBeNull();
    expect(resolveUpstream("")).toBeNull();
    expect(resolveUpstream("/foo/github-models")).toBeNull(); // known name only counts as first segment
  });

  it("keeps the host fixed by the allowlist regardless of the sub-path", () => {
    const u = resolveUpstream("/github-models/../../etc/passwd");
    expect(u).not.toBeNull();
    expect(new URL(u as string).host).toBe("models.github.ai");
  });
});

describe("isAllowedOrigin", () => {
  it("allows the GitHub Pages origin and localhost dev origins", () => {
    expect(isAllowedOrigin("https://qte77.github.io")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://localhost:8787")).toBe(true);
  });

  it("rejects other or spoofed origins and a missing origin", () => {
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedOrigin("https://qte77.github.io.evil.com")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });
});
