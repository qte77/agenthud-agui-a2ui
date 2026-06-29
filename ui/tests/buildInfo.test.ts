import { describe, it, expect } from "vitest";
import { formatBuildInfo } from "../src/buildInfo";
import { REPO_URL } from "../src/config";

describe("formatBuildInfo", () => {
  it("links a real build to its full commit, shown as a 7-char sha", () => {
    const info = formatBuildInfo("0.2.0", "abc1234def5678");

    expect(info.label).toBe("v0.2.0 · abc1234");
    expect(info.href).toBe(`${REPO_URL}/commit/abc1234def5678`);
    expect(info.title).toContain("abc1234def5678");
  });

  it("falls back to a 'dev' label and the repo root when there is no sha", () => {
    const info = formatBuildInfo("0.2.0", "");

    expect(info.label).toBe("v0.2.0 · dev");
    expect(info.href).toBe(REPO_URL);
  });
});
