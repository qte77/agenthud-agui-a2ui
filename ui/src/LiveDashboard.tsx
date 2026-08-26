import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { DashboardShell } from "./DashboardShell";
import { SurfaceSkeleton } from "./SurfaceSkeleton";
import { Transcript } from "./Transcript";
import { Composer } from "./Composer";
import { type ViewMode } from "./ModeToggle";
import { useLiveAgent } from "./agent/useLiveAgent";
import { useTrialRender } from "./agent/useTrialRender";
import { getTurnstileToken } from "./agent/trialRender";
import { setActionHandler } from "./agent/actionBridge";
import type { LiveSettings } from "./agent/liveAgent";
import type { EventLogEntry } from "./agent/applyA2UIEvent";
import type { TranscriptTurn } from "./agent/transcript";
import { ENDPOINTS, TURNSTILE_SITE_KEY } from "./config";

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

// The composer drives a follow-up turn, so it needs a ready connection and an existing conversation,
// and must stay inert mid-stream. (Kept module-level to hold LiveDashboard under the complexity gate.)
function composerDisabled(isRunning: boolean, turnCount: number, connectionReady: boolean): boolean {
  return isRunning || turnCount === 0 || !connectionReady;
}

// Live and trial runs share one surface — either being in-flight should gate the other (Run button,
// Composer, Save). Extracted so the boolean OR doesn't count against LiveDashboard's complexity.
function combinedRunning(live: boolean, trial: boolean): boolean {
  return live || trial;
}

// Paged-transcript pager index (#209): the ◀/▶ selection, snapped to the latest turn whenever the turn
// count changes (a new turn or a fresh-run reset). Adjust-during-render (ref-guarded) — not an effect.
// `viewingPast` is true when a non-latest turn is shown, so the live surface is hidden for it.
function usePagerIndex(count: number): {
  index: number;
  setIndex: Dispatch<SetStateAction<number>>;
  viewingPast: boolean;
} {
  const [index, setIndex] = useState(0);
  const [prevCount, setPrevCount] = useState(count);
  if (prevCount !== count) {
    // Store-prev-and-adjust during render (the React-endorsed alternative to a reset effect).
    setPrevCount(count);
    setIndex(Math.max(0, count - 1));
  }
  return { index, setIndex, viewingPast: count > 0 && index !== count - 1 };
}

const MODEL_PLACEHOLDER = "Model id (e.g. openai/gpt-5.4-mini)";

// Submittable default prompt (not a placeholder): Run works out of the box; cleared on first focus.
export const DEFAULT_PROMPT = "Output an interactive fairytale";

/** Pending-render skeleton while a run streams and the surface is still empty (kept out of
 *  LiveDashboard to stay under the complexity gate). */
function pendingSurfaceFallback(isRunning: boolean) {
  return isRunning ? <SurfaceSkeleton /> : null;
}

// Save-recording control (arc 019): enabled once a turn has captured a rendered surface and no run is
// in flight. Extracted so its disabled/title branches don't count against LiveDashboard's complexity.
function SaveButton({
  isRunning,
  hasCapture,
  onSave,
}: {
  isRunning: boolean;
  hasCapture: boolean;
  onSave: () => void;
}) {
  return (
    <button
      onClick={onSave}
      disabled={isRunning || !hasCapture}
      title={
        hasCapture
          ? "Download this session as a replayable recording"
          : "Run the agent first to capture a session"
      }
      className="px-3 py-1 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary disabled:opacity-40"
    >
      Save
    </button>
  );
}

// Trial tier (US-13 / ADR-0006): a distinct "try before you bring a key" affordance — NOT the same
// as the still-deferred "Free (no key)" BYOK dropdown entry (that's the $0 :free-model tier; this is
// 2-3 real-model renders, hard-capped server-side). Stays dormant (renders nothing) until a real
// Turnstile site key is provisioned — see config.ts. Extracted to keep LiveDashboard under the
// complexity gate.
function TrialButton({
  isRunning,
  remaining,
  error,
  turnstileContainerRef,
  onTry,
}: {
  isRunning: boolean;
  remaining: number | null;
  error: string | null;
  turnstileContainerRef: React.RefObject<HTMLDivElement | null>;
  onTry: () => void;
}) {
  if (!TURNSTILE_SITE_KEY) return null;
  if (remaining === 0) {
    return (
      <p className="text-xs text-text-muted">
        Trial used up — bring your own key above to keep going.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onTry}
        disabled={isRunning}
        className="px-3 py-1.5 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary disabled:opacity-40"
      >
        Try {remaining ?? "2-3"} free prompt{remaining === 1 ? "" : "s"} — no key needed
      </button>
      {error && <p className="text-xs text-data-negative break-words">{error}</p>}
      <div ref={turnstileContainerRef} />
    </div>
  );
}

// Solve the Turnstile challenge in `container`, then fire one trial render. A challenge failure
// (or the trial tier not being provisioned yet — see getTurnstileToken) already surfaces its own
// user-readable message; there's nothing else to do here. Extracted to keep LiveDashboard under
// the complexity gate.
async function handleTrialClick(
  container: HTMLDivElement | null,
  prompt: string,
  runTrial: (prompt: string, turnstileToken: string) => Promise<void>,
): Promise<void> {
  if (!container) return;
  try {
    const token = await getTurnstileToken(container);
    await runTrial(prompt, token);
  } catch {
    /* getTurnstileToken/runTrial already surface a message via the hook's error state */
  }
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
  eventLog,
  setEventLog,
}: {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  eventLog: EventLogEntry[];
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>;
}) {
  const [settings, setSettings] = useState<LiveSettings>(loadSettings);
  // Starts as a real (submittable) default prompt — clicking Run untouched uses it; the first
  // focus into the field clears it so the visitor types on a blank slate.
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptTouched, setPromptTouched] = useState(false);
  // Tracks an explicit "Custom…" model choice — mirrors the provider's editable reveal (the provider
  // uses a static `editable` flag; a model id can't, so we remember the Custom selection).
  const [modelCustom, setModelCustom] = useState(false);
  // Display-only conversation history (#195): one row per turn, prior turns frozen. Local to Live
  // (like the LLM history it visualizes) — resets on a Demo↔Live switch; the shared surface persists.
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  // Paged turn view (#209): which turn the ◀/▶ pager shows. A new turn (or a reset) snaps to latest.
  const { index: turnIndex, setIndex: setTurnIndex, viewingPast } = usePagerIndex(transcript.length);
  const { isRunning, error, run, sendAction, sendMessage, stop, toRecording } = useLiveAgent(
    setEventLog,
    setTranscript,
  );
  const {
    isRunning: trialRunning,
    error: trialError,
    remaining: trialRemaining,
    runTrial,
  } = useTrialRender(setEventLog, setTranscript);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const anyRunning = combinedRunning(isRunning, trialRunning);
  // A capture exists once any turn has frozen a rendered surface (arc 019). Reuses transcript state —
  // no separate flag to keep in sync.
  const hasCapture = transcript.some((t) => t.snapshot != null);

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

  // Save the last successful turn as a shareable, deterministically-replayable Recording (arc 019):
  // serialize → Blob → object-URL → hidden download. No backend, no dependency (self-host policy).
  function handleSave() {
    const recording = toRecording({
      title: prompt.trim() || DEFAULT_PROMPT,
      description: `Live capture · ${settings.model || "agent"}`,
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(recording, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "agenthud-recording.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Connection alone gates the composer (a follow-up needs no fresh prompt); + prompt gates Run.
  const connectionReady =
    settings.baseURL.trim() && settings.apiKey.trim() && settings.model.trim();
  const ready = connectionReady && prompt.trim();

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
          if (ready && !anyRunning) void run(settings, prompt);
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
            disabled={!ready || anyRunning}
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
          <>
            <p className="text-xs text-text-muted">
              Bring your own key for any CORS-friendly OpenAI-compatible endpoint. Demo mode needs no
              key.
            </p>
            <TrialButton
              isRunning={anyRunning}
              remaining={trialRemaining}
              error={trialError}
              turnstileContainerRef={turnstileContainerRef}
              onTry={() => void handleTrialClick(turnstileContainerRef.current, prompt, runTrial)}
            />
          </>
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
      extraControls={<SaveButton isRunning={anyRunning} hasCapture={hasCapture} onSave={handleSave} />}
      surfaceSubtitle="composed live by the agent via the render_ui tool"
      eventsSubtitle="live protocol stream driving the surface"
      eventLog={eventLog}
      asidePanel={
        <>
          {connectionPanel}
          {promptPanel}
        </>
      }
      beforeSurface={
        <Transcript
          turns={transcript}
          selected={turnIndex}
          onPrev={() => setTurnIndex((i) => Math.max(0, i - 1))}
          onNext={() => setTurnIndex((i) => Math.min(transcript.length - 1, i + 1))}
        />
      }
      surfaceHidden={viewingPast}
      surfaceFallback={pendingSurfaceFallback(anyRunning)}
      surfaceBusy={anyRunning}
      footerLead="Live BYOK agent · Vercel AI SDK → AG-UI → A2UI"
    >
      <Composer
        disabled={composerDisabled(anyRunning, transcript.length, Boolean(connectionReady))}
        onSend={(text) => void sendMessage(settings, text)}
      />
    </DashboardShell>
  );
}
