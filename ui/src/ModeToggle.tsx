export type ViewMode = "demo" | "live";

// Segmented Demo | Live switch shown in both headers.
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
      className="flex rounded border border-border overflow-hidden text-sm"
      role="group"
      aria-label="Agent mode"
    >
      {(["demo", "live"] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={
            mode === m
              ? "px-2.5 py-1 bg-primary text-primary-on"
              : "px-2.5 py-1 bg-surface text-text-muted hover:text-text transition-colors"
          }
        >
          {m === "demo" ? "Demo" : "Live"}
        </button>
      ))}
    </div>
  );
}
