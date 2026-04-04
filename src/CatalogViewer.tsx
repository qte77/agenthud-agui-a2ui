import { useState } from "react";

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

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-sm hover:bg-gray-600"
      >
        {open ? "Hide" : "Catalog"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-alt rounded-lg shadow-xl max-w-xl w-full max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-accent">A2UI Standard Component Catalog</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 flex-1 space-y-3">
              <p className="text-xs text-text-secondary">
                The agent selects from this pre-approved catalog at runtime.
                No arbitrary code — only declarative JSON referencing these types.
              </p>
              <div className="space-y-1">
                {CATALOG.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 py-1">
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        c.usedInDemo
                          ? "bg-accent/20 text-accent font-semibold"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {c.name}
                    </span>
                    <span className="text-xs text-text-secondary">{c.description}</span>
                    {c.usedInDemo && (
                      <span className="text-[10px] text-green-400 ml-auto shrink-0">in demo</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-text-secondary mb-2">First-party references</p>
                <div className="space-y-1">
                  {LINKS.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-accent hover:underline"
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
