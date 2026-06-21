import { describe, it, expect } from "vitest";
import { THEME_CYCLE, isThemeMode, nextTheme, resolveTheme } from "../src/theme/theme";

describe("theme cycler", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("resolves by precedence: url › localStorage › system", () => {
    expect(resolveTheme("dark", "light")).toBe("dark"); // url wins
    expect(resolveTheme(null, "light")).toBe("light"); // falls back to storage
    expect(resolveTheme(null, null)).toBe("system"); // default
    expect(resolveTheme("bogus", "garbage")).toBe("system"); // invalid → default
  });

  it("validates theme modes", () => {
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("midnight")).toBe(false);
    expect(THEME_CYCLE).toEqual(["system", "light", "dark"]);
  });
});
