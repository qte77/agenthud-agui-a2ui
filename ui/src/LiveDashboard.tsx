import { useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { type ViewMode } from "./ModeToggle";
import { useLiveAgent } from "./agent/useLiveAgent";
import type { LiveSettings } from "./agent/liveAgent";
import { ENDPOINTS } from "./config";

// BYOK connection — base URL + model persist in sessionStorage; the API key stays in memory only
// (never written to storage, so it's gone on reload/close/reopen), per US-7.
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

// ENDPOINTS live in ./config (single source of truth for URLs). CUSTOM is the UI-side fallback for
// the freeform option; the explicit literal satisfies noUncheckedIndexedAccess on the array tail.
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
        // Persist only the non-secret fields — the API key stays in memory (gone on reload/close).
        sessionStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({ baseURL: next.baseURL, model: next.model }),
        );
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

  // Connection setup (endpoint / key / model) — pinned to the sidebar, expanded by default,
  // collapses to its summary. Setup chrome lives here so the center stays the A2UI surface.
  const connectionPanel = (
    <details open className="shrink-0 border-b border-border text-xs text-text-muted">
      <summary className="px-2 py-2 cursor-pointer select-none marker:text-text-muted">
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
          Connection
        </span>{" "}
        <span className="text-text-muted">— OpenAI-compatible · BYOK</span>
      </summary>
      <div className="px-2 pb-2 space-y-2">
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
              {e.label}
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
        <input
          className={fieldClass}
          type="password"
          autoComplete="off"
          placeholder="API key (in memory only — never stored)"
          value={settings.apiKey}
          onChange={(e) => patchSettings({ apiKey: e.target.value })}
        />
        <p className="text-[11px] leading-snug text-text-muted">
          🔒 Your key is sent only to the chosen provider — proxy endpoints forward it without
          storing it, and nothing is kept server-side. It's held in memory for this tab only (never
          written to storage), so it's gone on refresh or close.
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
  );

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
      asidePanel={connectionPanel}
      footerLead="Live BYOK agent · Vercel AI SDK → AG-UI → A2UI"
    >
      <form
        className="mt-6 max-w-md mx-auto space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !isRunning) void run(settings, prompt);
        }}
      >
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

        {error && <p className="text-xs text-data-negative break-words">{error}</p>}
        {!settings.apiKey.trim() && (
          <p className="text-xs text-text-muted">
            Bring your own key for any CORS-friendly OpenAI-compatible endpoint. Demo mode needs no
            key.
          </p>
        )}
      </form>
    </DashboardShell>
  );
}
