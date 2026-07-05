import { useEffect, useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { SurfaceSkeleton } from "./SurfaceSkeleton";
import { type ViewMode } from "./ModeToggle";
import { useLiveAgent } from "./agent/useLiveAgent";
import { setActionHandler } from "./agent/actionBridge";
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

const MODEL_PLACEHOLDER = "Model id (e.g. openai/gpt-5.4-mini)";

// Submittable default prompt (not a placeholder): Run works out of the box; cleared on first focus.
export const DEFAULT_PROMPT = "Output an interactive fairytale";

/** Pending-render skeleton while a run streams and the surface is still empty (kept out of
 *  LiveDashboard to stay under the complexity gate). */
function pendingSurfaceFallback(isRunning: boolean) {
  return isRunning ? <SurfaceSkeleton /> : null;
}

// Show the model free-text field when the user explicitly picked Custom…, or the persisted model
// isn't one of the provider's suggestions. Pure helper so it stays out of LiveDashboard's complexity.
function isCustomModel(explicit: boolean, model: string, models: string[]): boolean {
  return explicit || (model.trim() !== "" && !models.includes(model));
}

// Model picker — mirrors the provider <select> + Custom… reveal: a dropdown of the provider's models
// plus Custom…, which shows a free-text field (any id still accepted). Providers with no curated list
// fall back to the plain free-text input. Extracted to keep LiveDashboard under the complexity gate.
function ModelPicker({
  models,
  value,
  isCustom,
  onPick,
  onCustom,
  onType,
}: {
  models: string[];
  value: string;
  isCustom: boolean;
  onPick: (model: string) => void;
  onCustom: () => void;
  onType: (model: string) => void;
}) {
  const freeText = (
    <input
      className={fieldClass}
      type="text"
      placeholder={MODEL_PLACEHOLDER}
      value={value}
      onChange={(e) => onType(e.target.value)}
    />
  );
  if (models.length === 0) return freeText;
  return (
    <>
      <select
        className={fieldClass}
        value={isCustom ? "__custom__" : value}
        onChange={(e) => (e.target.value === "__custom__" ? onCustom() : onPick(e.target.value))}
      >
        <option value="" disabled>
          Select a model…
        </option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {isCustom && freeText}
    </>
  );
}

export function LiveDashboard({
  mode,
  onMode,
}: {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
}) {
  const [settings, setSettings] = useState<LiveSettings>(loadSettings);
  // Starts as a real (submittable) default prompt — clicking Run untouched uses it; the first
  // focus into the field clears it so the visitor types on a blank slate.
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptTouched, setPromptTouched] = useState(false);
  // Tracks an explicit "Custom…" model choice — mirrors the provider's editable reveal (the provider
  // uses a static `editable` flag; a model id can't, so we remember the Custom selection).
  const [modelCustom, setModelCustom] = useState(false);
  const { eventLog, isRunning, error, run, sendAction, stop } = useLiveAgent();

  // Route rendered-Button clicks (A2UISurface onAction → actionBridge) into a follow-up
  // agent turn. Unregistered on unmount, so Demo mode clicks stay no-ops.
  useEffect(() => {
    setActionHandler((name) => void sendAction(settings, name));
    return () => setActionHandler(null);
  }, [sendAction, settings]);

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

  // Model field mirrors the provider's <select> + Custom… reveal: show the free-text input when the
  // user chose "Custom…" or the persisted model isn't one of this provider's suggestions.
  const modelOptions = selected.models ?? [];
  const modelIsCustom = isCustomModel(modelCustom, settings.model, modelOptions);

  // Connection setup (endpoint / key / model) — pinned to the sidebar, expanded by default,
  // collapses to its summary. Setup chrome lives here so the center stays the A2UI surface.
  const connectionPanel = (
    <details
      open
      name="sidebar-accordion"
      className="shrink-0 border-b border-border text-xs text-text-muted"
    >
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
            if (next) {
              setModelCustom(false);
              patchSettings({ baseURL: next.baseURL });
            }
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
        <ModelPicker
          models={modelOptions}
          value={settings.model}
          isCustom={modelIsCustom}
          onPick={(m) => {
            setModelCustom(false);
            patchSettings({ model: m });
          }}
          onCustom={() => setModelCustom(true)}
          onType={(m) => patchSettings({ model: m })}
        />
      </div>
    </details>
  );

  // Prompt composer — second accordion pane (collapsed by default; opening it closes Connection).
  // Lives in the sidebar so the center column stays purely the A2UI surface.
  const promptPanel = (
    <details name="sidebar-accordion" className="shrink-0 border-b border-border">
      <summary className="px-2 py-2 cursor-pointer select-none marker:text-text-muted">
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
          Prompt
        </span>{" "}
        <span className="text-xs text-text-muted">— ask the agent to compose a UI</span>
      </summary>
      <form
        className="px-2 pb-2 space-y-3"
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
          onFocus={() => {
            // First focus clears the submittable default so the visitor types on a blank slate.
            if (!promptTouched) {
              setPrompt("");
              setPromptTouched(true);
            }
          }}
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
      asidePanel={
        <>
          {connectionPanel}
          {promptPanel}
        </>
      }
      surfaceFallback={pendingSurfaceFallback(isRunning)}
      surfaceBusy={isRunning}
      footerLead="Live BYOK agent · Vercel AI SDK → AG-UI → A2UI"
    >
      {null}
    </DashboardShell>
  );
}
