import { THEME_META } from "./theme";
import { useTheme } from "./useTheme";

// Single cycling theme button (system → light → dark), matching the qte77
// ui-kit convention: ◐/○/● glyph + label, dynamic accessible name, and an
// aria-live status region announcing the change. IDs/classes align with a11y.css.
export function ThemeToggle() {
  const { mode, cycle } = useTheme();
  const meta = THEME_META[mode];
  const name = `Color theme: ${meta.label} (click to change)`;

  return (
    <>
      <button
        id="theme-toggle"
        type="button"
        onClick={cycle}
        aria-label={name}
        title={name}
        className="flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-sm text-text transition-colors hover:border-primary"
      >
        <span className="theme-glyph" aria-hidden="true">
          {meta.glyph}
        </span>
        <span className="theme-label">{meta.label}</span>
      </button>
      <span id="theme-status" role="status" aria-live="polite" className="sr-only">
        {`Theme: ${meta.label}`}
      </span>
    </>
  );
}
