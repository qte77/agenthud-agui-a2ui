import { useState } from "react";
import { A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { CatalogViewer } from "./CatalogViewer";
import { BrandHeader } from "./BrandHeader";
import { ThemeToggle } from "./theme/ThemeToggle";
import { ModeToggle, type ViewMode } from "./ModeToggle";
import { useLiveAgent } from "./agent/useLiveAgent";
import type { LiveSettings } from "./agent/liveAgent";

// BYOK connection — kept in sessionStorage only (cleared on tab close), per US-7.
const SETTINGS_KEY = "agenthud-byok";
const DEFAULTS: LiveSettings = {
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "",
  model: "",
};

// OpenAI-compatible BYOK endpoints. The first group is CORS-friendly and works
// in-browser as-is; `experimental` ones lack browser CORS, so they fail from a
// static page until the deferred proxy lands (ADR-0001 / US-6). `editable` reveals
// the freeform URL field (Custom, plus Azure's per-resource template).
const ENDPOINTS: {
  label: string;
  baseURL: string;
  experimental?: boolean;
  editable?: boolean;
}[] = [
  { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseURL: "https://api.groq.com/openai/v1" },
  { label: "Together", baseURL: "https://api.together.xyz/v1" },
  { label: "Fireworks", baseURL: "https://api.fireworks.ai/inference/v1" },
  { label: "DeepSeek", baseURL: "https://api.deepseek.com" },
  { label: "GitHub Models", baseURL: "https://models.github.ai/inference", experimental: true },
  { label: "Google", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", experimental: true },
  { label: "Mammouth", baseURL: "https://api.mammouth.ai/v1", experimental: true },
  { label: "Azure OpenAI", baseURL: "https://<resource>.openai.azure.com/openai/v1", experimental: true, editable: true },
  { label: "Custom…", baseURL: "", editable: true },
];
const CUSTOM = ENDPOINTS[ENDPOINTS.length - 1];

function loadSettings(): LiveSettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* sessionStorage disabled — fall back to defaults */
  }
  return DEFAULTS;
}

const fieldClass =
  "w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text " +
  "focus:border-primary focus:outline-none";

export function LiveDashboard({
  mode,
  onMode,
}: {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
}) {
  const [settings, setSettings] = useState<LiveSettings>(loadSettings);
  const [prompt, setPrompt] = useState("");
  const { eventLog, isRunning, error, run, stop } = useLiveAgent();

  function patchSettings(patch: Partial<LiveSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const ready =
    settings.baseURL.trim() &&
    settings.apiKey.trim() &&
    settings.model.trim() &&
    prompt.trim();

  // Selection is derived from the persisted baseURL — no extra state to keep in sync.
  const selected =
    ENDPOINTS.find((e) => e.baseURL === settings.baseURL) ?? CUSTOM;

  return (
    <div className="h-screen flex flex-col max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <BrandHeader />
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
          Live · BYOK
        </span>
        <div className="flex items-center gap-2">
          <ModeToggle mode={mode} onChange={onMode} />
          <ThemeToggle />
          <CatalogViewer />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              A2UI Surface
            </span>
            <span className="text-xs text-text-muted">
              — composed live by the agent via the render_ui tool
            </span>
          </div>
          <A2UISurface />

          <form
            className="mt-6 max-w-md mx-auto space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !isRunning) run(settings, prompt);
            }}
          >
            <details className="text-xs text-text-muted">
              <summary className="cursor-pointer select-none">
                Connection (OpenAI-compatible · BYOK)
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  className={fieldClass}
                  value={selected.label}
                  onChange={(e) => {
                    const next = ENDPOINTS.find((x) => x.label === e.target.value);
                    if (next) patchSettings({ baseURL: next.baseURL });
                  }}
                >
                  {ENDPOINTS.map((e) => (
                    <option key={e.label} value={e.label}>
                      {e.experimental ? `${e.label} (experimental)` : e.label}
                    </option>
                  ))}
                </select>
                {selected.editable && (
                  <input
                    className={fieldClass}
                    type="url"
                    placeholder="Base URL (e.g. https://openrouter.ai/api/v1)"
                    value={settings.baseURL}
                    onChange={(e) => patchSettings({ baseURL: e.target.value })}
                  />
                )}
                {selected.experimental && (
                  <p className="text-data-negative">
                    ⚠ Experimental — not browser-callable from a static page (CORS).
                    Likely fails without the deferred proxy (ADR-0001 / US-6).
                  </p>
                )}
                <input
                  className={fieldClass}
                  type="password"
                  autoComplete="off"
                  placeholder="API key (kept in sessionStorage only)"
                  value={settings.apiKey}
                  onChange={(e) => patchSettings({ apiKey: e.target.value })}
                />
                <input
                  className={fieldClass}
                  type="text"
                  placeholder="Model id (e.g. openai/gpt-4o-mini)"
                  value={settings.model}
                  onChange={(e) => patchSettings({ model: e.target.value })}
                />
              </div>
            </details>

            <textarea
              className={`${fieldClass} resize-none`}
              rows={3}
              placeholder="Ask the agent to compose a UI — e.g. “show a card with a title and two buttons”"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!ready || isRunning}
                className="px-3 py-1.5 rounded bg-primary text-primary-on text-sm transition-opacity disabled:opacity-40"
              >
                {isRunning ? "Running…" : "Run"}
              </button>
              {isRunning && (
                <button
                  type="button"
                  onClick={stop}
                  className="px-3 py-1.5 rounded border border-border bg-surface text-text text-sm hover:border-primary"
                >
                  Stop
                </button>
              )}
            </div>

            {error && (
              <p className="text-xs text-data-negative break-words">{error}</p>
            )}
            {!settings.apiKey.trim() && (
              <p className="text-xs text-text-muted">
                Bring your own key for any CORS-friendly OpenAI-compatible endpoint.
                Demo mode needs no key.
              </p>
            )}
          </form>
        </main>
        <aside className="w-96 border-l border-border flex flex-col">
          <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
            <span className="text-xs font-semibold text-data-positive uppercase tracking-wide">
              AG-UI Events
            </span>
            <span className="text-xs text-text-muted">
              — live protocol stream driving the surface
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <EventStream events={eventLog} />
          </div>
        </aside>
      </div>
      <footer className="px-4 py-2 border-t border-border text-center text-xs text-text-muted">
        Live BYOK agent · Vercel AI SDK → AG-UI → A2UI ·{" "}
        <a
          href="https://github.com/qte77/agenthud-agui-a2ui"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          qte77/agenthud-agui-a2ui
        </a>
      </footer>
    </div>
  );
}
