import { useEffect, useState } from "react";

interface CatalogEntry {
  name: string;
  description: string;
  usedInDemo: boolean;
}

const CATALOG: CatalogEntry[] = [
  { name: "Text", description: "Renders text with usageHint (h1-h5, body, caption)", usedInDemo: true },
  { name: "Image", description: "Renders an image from URL (avatar, hero, thumbnail)", usedInDemo: true },
  { name: "Icon", description: "Renders a predefined icon by name", usedInDemo: false },
  { name: "Divider", description: "Visual separator (horizontal or vertical)", usedInDemo: true },
  { name: "Row", description: "Horizontal layout with flex distribution", usedInDemo: true },
  { name: "Column", description: "Vertical layout with flex distribution", usedInDemo: true },
  { name: "Card", description: "Elevated container for grouping content", usedInDemo: true },
  { name: "List", description: "Ordered items with title + child content", usedInDemo: false },
  { name: "Button", description: "Clickable action trigger", usedInDemo: true },
  { name: "TextField", description: "Text input with label and validation", usedInDemo: false },
  { name: "CheckBox", description: "Boolean toggle with label", usedInDemo: true },
  { name: "Slider", description: "Numeric range input", usedInDemo: true },
  { name: "DateTimeInput", description: "Date and time picker", usedInDemo: false },
  { name: "MultipleChoice", description: "Single or multi-select options", usedInDemo: false },
  { name: "Tabs", description: "Tabbed content navigation", usedInDemo: true },
  { name: "Modal", description: "Overlay dialog", usedInDemo: false },
  { name: "Video", description: "Video player for a given URL", usedInDemo: false },
  { name: "AudioPlayer", description: "Audio player with optional description", usedInDemo: false },
];

const LINKS = [
  { label: "A2UI Specification", url: "https://a2ui.org/specification/v0.9-a2ui/" },
  { label: "A2UI React Renderer", url: "https://github.com/google/A2UI/tree/main/renderers/react" },
  { label: "AG-UI Protocol", url: "https://docs.ag-ui.com/introduction" },
  { label: "AG-UI GitHub", url: "https://github.com/ag-ui-protocol/ag-ui" },
];

export function CatalogViewer() {
  const [open, setOpen] = useState(false);

  // Standard modal dismissal: Escape closes while open (✕ and backdrop click below).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary"
      >
        {open ? "Hide" : "Catalog"}
      </button>
      {open && (
        <div
          data-testid="catalog-backdrop"
          onClick={(e) => {
            // Outside click: only when the backdrop itself is the target (not dialog content).
            if (e.target === e.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="A2UI Standard Component Catalog"
            className="bg-surface rounded-lg shadow-xl max-w-xl w-full max-h-[80vh] flex flex-col m-4"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-primary">A2UI Standard Component Catalog</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close catalog"
                className="text-text-muted hover:text-text text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 flex-1 space-y-3">
              <p className="text-xs text-text-muted">
                The agent selects from this pre-approved catalog at runtime.
                No arbitrary code — only declarative JSON referencing these types.
              </p>
              <div className="space-y-1">
                {CATALOG.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 py-1">
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        c.usedInDemo
                          ? "bg-primary/20 text-primary font-semibold"
                          : "bg-bg text-text-muted"
                      }`}
                    >
                      {c.name}
                    </span>
                    <span className="text-xs text-text-muted">{c.description}</span>
                    {c.usedInDemo && (
                      <span className="text-[10px] text-data-positive ml-auto shrink-0">in demo</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs font-semibold text-text-muted mb-2">First-party references</p>
                <div className="space-y-1">
                  {LINKS.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-primary hover:underline"
                    >
                      {l.label} &rarr;
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
