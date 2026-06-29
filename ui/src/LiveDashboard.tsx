import { useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { type ViewMode } from "./ModeToggle";
import { useLiveAgent } from "./agent/useLiveAgent";
import type { LiveSettings } from "./agent/liveAgent";

// BYOK connection — kept in sessionStorage only (cleared on tab close), per US-7.
const SETTINGS_KEY = "agenthud-byok";

const BASE_DEFAULTS: LiveSettings = {
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "",
  model: "",
};
// Dev-only: prefill the connection from ui/.env (VITE_BYOK_*) so you don't retype keys while
// developing. Read ONLY in dev — the prod branch below carries no VITE_ reference (so keys can't
// leak into a production build) and ui/.env is gitignored. See ui/.env.example.
const DEFAULTS: LiveSettings = import.meta.env.DEV
  ? {
      baseURL: import.meta.env.VITE_BYOK_BASE_URL ?? BASE_DEFAULTS.baseURL,
      apiKey: import.meta.env.VITE_BYOK_API_KEY ?? BASE_DEFAULTS.apiKey,
      model: import.meta.env.VITE_BYOK_MODEL ?? BASE_DEFAULTS.model,
    }
  : BASE_DEFAULTS;

// OpenAI-compatible BYOK endpoints. The CORS-friendly ones work in-browser as-is.
// GitHub Models + Google have no browser CORS, so they would route through the edge proxy
// (US-6 / ADR-0001 — see worker/README.md). Mammouth + Azure stay `experimental` (still fail
// from a static page). `editable` reveals the freeform URL field (Custom, plus Azure's template).
//
// PROXY_BASE points at the deployed edge proxy (US-6 / worker/) — the "(via proxy)" options below
// route GitHub Models + Google through it so they work in-browser despite no upstream CORS. In dev,
// VITE_PROXY_BASE (ui/.env) overrides it to target a local `wrangler dev` worker that allows the
// localhost origin (prod rejects localhost by design); prod ignores it since DEV is false.
const PROXY_BASE =
  import.meta.env.DEV && import.meta.env.VITE_PROXY_BASE
    ? import.meta.env.VITE_PROXY_BASE
    : "https://agenthud-proxy.cloudflare-driveway392.workers.dev";
const ENDPOINTS: {
  label: string;
  baseURL: string;
  experimental?: boolean;
  editable?: boolean;
}[] = [
  { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseURL: "https://api.groq.com/openai/v1" },
  { label: "Together", baseURL: "https://api.together.ai/v1" },
  { label: "Fireworks", baseURL: "https://api.fireworks.ai/inference/v1" },
  { label: "DeepSeek", baseURL: "https://api.deepseek.com" },
  { label: "GitHub Models (via proxy)", baseURL: `${PROXY_BASE}/github-models` },
  { label: "Google (via proxy)", baseURL: `${PROXY_BASE}/google` },
  { label: "Mammouth", baseURL: "https://api.mammouth.ai/v1", experimental: true },
  { label: "Azure OpenAI", baseURL: "https://<resource>.openai.azure.com/openai/v1", experimental: true, editable: true },
  { label: "Custom…", baseURL: "", editable: true },
];
// ENDPOINTS is a non-empty literal array; provide an explicit fallback to satisfy noUncheckedIndexedAccess
const CUSTOM = ENDPOINTS[ENDPOINTS.length - 1] ?? { label: "Custom…", baseURL: "", editable: true };

function loadSettings(): LiveSettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LiveSettings>) };
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
    <DashboardShell
      view={mode}
      onView={onMode}
      headerMiddle={
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
          Live · BYOK
        </span>
      }
      surfaceSubtitle="composed live by the agent via the render_ui tool"
      eventsSubtitle="live protocol stream driving the surface"
      eventLog={eventLog}
      footerLead="Live BYOK agent · Vercel AI SDK → AG-UI → A2UI"
    >

          <form
            className="mt-6 max-w-md mx-auto space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !isRunning) void run(settings, prompt);
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
                <p className="text-[11px] leading-snug text-text-muted">
                  🔒 Your key is sent only to the chosen provider — proxy endpoints forward it
                  without storing it, and nothing is kept server-side. It lives only in this
                  browser tab (sessionStorage) and is cleared when you close the tab.
                </p>
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
    </DashboardShell>
  );
}
