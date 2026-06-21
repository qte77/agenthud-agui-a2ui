// Shared theme cycler — pure logic ported from qte77 ui-kit/theme.js.
// DOM-free and unit-testable; React glue lives in useTheme.ts / ThemeToggle.tsx.
// Conventions kept in sync with the qte77 ecosystem (decisions D2/D4):
// cycle system → light → dark, glyphs ◐ ○ ●, localStorage key "qte77-theme".

export type ThemeMode = "system" | "light" | "dark";

export const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"];
export const STORAGE_KEY = "qte77-theme";

export const THEME_META: Record<ThemeMode, { glyph: string; label: string }> = {
  system: { glyph: "◐", label: "System" },
  light: { glyph: "○", label: "Light" },
  dark: { glyph: "●", label: "Dark" },
};

// Widest label — kept here as the single source for the a11y.css width-sizer.
export const WIDEST_LABEL = "System";

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "system" || v === "light" || v === "dark";
}

/** Resolve the active mode by precedence: ?theme= › localStorage › "system". Pure. */
export function resolveTheme(
  urlValue: string | null,
  lsValue: string | null
): ThemeMode {
  if (isThemeMode(urlValue)) return urlValue;
  if (isThemeMode(lsValue)) return lsValue;
  return "system";
}

/** Next mode in the cycle (wraps). */
export function nextTheme(mode: ThemeMode): ThemeMode {
  const i = THEME_CYCLE.indexOf(mode);
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length];
}

/** Effective light|dark for a mode (resolves "system" against the OS preference). */
export function effectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  const dark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark" : "light";
}
