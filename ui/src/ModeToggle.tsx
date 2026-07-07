export type ViewMode = "demo" | "live";

// Lightweight Demo | Live source selector shown in both headers: the surface + event stream are
// shared now (#128), so this just picks which source drives them — a tinted (not filled) active
// pill keeps it feeling like a selector, not a mode switch.
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    // Plain aria-pressed toggle buttons: the previous role="tablist"/"tab" markup was an
    // INCOMPLETE tabs pattern (no aria-controls/tabpanel), which also hid the buttons from
    // role=button queries (screen readers + testing tools alike).
    <div
      className="flex rounded border border-border overflow-hidden text-xs"
      role="group"
      aria-label="Event source"
    >
      {(["demo", "live"] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={
            mode === m
              ? "px-2.5 py-1 bg-primary/10 text-primary font-medium"
              : "px-2.5 py-1 bg-surface text-text-muted hover:text-text transition-colors"
          }
        >
          {m === "demo" ? "Demo" : "Live"}
        </button>
      ))}
    </div>
  );
}
