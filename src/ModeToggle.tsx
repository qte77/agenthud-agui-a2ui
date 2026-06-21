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
    <div
      className="flex rounded border border-border overflow-hidden text-sm"
      role="tablist"
      aria-label="Agent mode"
    >
      {(["demo", "live"] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
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
