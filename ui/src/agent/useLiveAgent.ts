import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./applyA2UIEvent";
import { resolveAssets } from "./assets";
import { runLiveAgent, type LiveSettings } from "./liveAgent";
import { candidateModels, classifyFailure } from "./fallback";
import { emptySnapshot, accumulate } from "../replaySnapshot";
import {
  actionToTurn,
  appendUserTurn,
  appendAssistantTurn,
  summarizeRender,
  type ConversationTurn,
} from "./conversation";
import {
  seedTurn,
  finalizeTurn,
  toTurnSnapshot,
  actionLabel,
  type TranscriptTurn,
} from "./transcript";
import { liveEventsToRecording, type CapturedEvent, type RecordingMeta } from "./recording";

// Live counterpart to useReplayEngine: a BYOK agent run feeds the SAME
// applyA2UIEvent seam (validated render + log entry), so the EventStream and A2UI
// surface are driven identically to replay. DRY. The event log is owned by the App
// root (shared across sources — #128) and injected as setEventLog; the display-only
// conversation transcript is owned by LiveDashboard and injected as setTranscript (#195).
export function useLiveAgent(
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>,
  setTranscript: Dispatch<SetStateAction<TranscriptTurn[]>>
) {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Conversation history — seeded by run(), grown by sendAction() and, after each successful
  // turn, an assistant summary of what was rendered (turn memory — see conversation.ts).
  const messagesRef = useRef<ConversationTurn[]>([]);
  // Capture buffer (arc 019): the WINNING attempt's raw events, committed on win (below) and reset by
  // run(). toRecording() serializes these into a shareable, deterministically-replayable Recording.
  const capturedEventsRef = useRef<CapturedEvent[]>([]);

  const render = useCallback(
    (messages: unknown[]) =>
      // Resolve `asset:<name>` image tokens to bundled URLs before rendering (self-hosted images).
      processMessages(resolveAssets(messages) as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  // Shared one-turn stream routine. `userText` is the user's side of this turn (prompt / composer
  // text / clicked-action label) — the transcript row; run + sendAction/sendMessage differ only in
  // how history + userText are prepared. Fall-through (#210): try candidate models (same provider,
  // BYOK) until one renders a valid batch — the FIRST valid render wins; retry on rate-limit / provider
  // error / no-render, stop on a bad key. Each attempt renders live; a failed attempt is reset.
  const stream = useCallback(
    async (settings: LiveSettings, messages: ConversationTurn[], userText: string) => {
      setIsRunning(true);
      setError(null);
      setTranscript((prev) => seedTurn(prev, userText));

      const start = Date.now();
      const ac = new AbortController();
      abortRef.current = ac;
      const models = candidateModels(settings.baseURL, settings.model);
      let snap = emptySnapshot();
      let winnerBatch: unknown[] | undefined;
      let lastReason = "";

      for (let i = 0; i < models.length; i++) {
        const model = models[i]!;
        snap = emptySnapshot();
        let runError: unknown = null;
        const batches: unknown[][] = [];
        // Per-attempt capture; only the winning attempt is committed to capturedEventsRef (below).
        const captured: CapturedEvent[] = [];

        if (i > 0) {
          // Reset the failed attempt's surface and note the fall-through in the EventStream (#210 #8).
          clearSurfaces();
          const note: EventLogEntry = {
            type: "FALLBACK",
            timestamp: Date.now() - start,
            text: `${models[i - 1]!} failed (${lastReason}) — trying ${model}`,
          };
          setEventLog((prev) => appendLogEntry(prev, note));
        }

        try {
          await runLiveAgent(
            { ...settings, model },
            messages,
            (event) => {
              const timestamp = Date.now() - start;
              if (event.a2uiMessages) batches.push(event.a2uiMessages);
              // Buffer this event (raw, un-asset-resolved) for capture — winner-only commit below.
              captured.push({ type: event.type, text: event.text, a2uiMessages: event.a2uiMessages, timestamp });
              const entry = applyA2UIEvent(event, timestamp, render);
              // Fold validated batches (a2uiComponentCount set on schema success), asset-resolved.
              if (event.a2uiMessages && entry.a2uiComponentCount !== undefined) {
                accumulate(snap, resolveAssets(event.a2uiMessages));
              }
              // An in-stream error part surfaces as RUN_ERROR (not a throw) — capture it as a failure.
              if (event.type === "RUN_ERROR") runError = new Error(event.text ?? "run error");
              setEventLog((prev) => appendLogEntry(prev, entry));
            },
            { signal: ac.signal }
          );
        } catch (err) {
          runError = err;
        }

        if (ac.signal.aborted) break; // user stopped — don't retry, don't error.
        // A valid self-contained snapshot = this model rendered a usable UI → first-valid-wins.
        if (toTurnSnapshot(snap)) {
          winnerBatch = batches.at(-1);
          capturedEventsRef.current = captured; // commit ONLY the winning attempt (never a discarded one).
          break;
        }
        // A clean finish with no valid render = the model ignored the tool → retryable.
        const outcome =
          runError !== null ? classifyFailure(runError) : { retry: true, message: "the model returned no UI" };
        lastReason = outcome.message;
        if (!outcome.retry || i === models.length - 1) {
          setError(outcome.message);
          break;
        }
      }

      // Turn memory: record what the WINNER rendered so the next turn sees it (never on a failure).
      if (winnerBatch) {
        messagesRef.current = appendAssistantTurn(messagesRef.current, summarizeRender(winnerBatch));
      }
      // Freeze the turn's surface (the winner's, or null if every candidate failed).
      setTranscript((prev) => finalizeTurn(prev, toTurnSnapshot(snap)));
      setIsRunning(false);
    },
    [render, setEventLog, setTranscript, clearSurfaces]
  );

  const run = useCallback(
    async (settings: LiveSettings, prompt: string) => {
      if (isRunning) return;
      // Fresh conversation: reset log, surface, transcript, and history.
      setEventLog([]);
      setTranscript([]);
      clearSurfaces();
      capturedEventsRef.current = [];
      messagesRef.current = [{ role: "user", content: prompt }];
      await stream(settings, messagesRef.current, prompt);
    },
    [isRunning, clearSurfaces, stream, setEventLog, setTranscript]
  );

  // A follow-up turn with the FULL history. No clearSurfaces(): the new beginRendering replaces the
  // surface, avoiding a blank flash. No-op before the first run. `userText` is the transcript row.
  const followUp = useCallback(
    async (settings: LiveSettings, content: string, userText: string) => {
      if (isRunning || messagesRef.current.length === 0) return;
      messagesRef.current = appendUserTurn(messagesRef.current, content);
      await stream(settings, messagesRef.current, userText);
    },
    [isRunning, stream]
  );

  // Rendered-Button click → follow-up turn (model-facing action sentence; transcript shows the label).
  const sendAction = useCallback(
    (settings: LiveSettings, name: string) => followUp(settings, actionToTurn(name).content, actionLabel(name)),
    [followUp]
  );

  // Composer free-text follow-up → the typed text is both the model turn and the transcript row.
  const sendMessage = useCallback(
    (settings: LiveSettings, text: string) => followUp(settings, text, text),
    [followUp]
  );

  // Serialize the last successful turn's captured events into a shareable, replayable Recording.
  const toRecording = useCallback(
    (meta: RecordingMeta) => liveEventsToRecording(capturedEventsRef.current, meta),
    []
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Abort any in-flight stream if this dashboard unmounts (source switch) — the shared log/surface
  // setter lives in the App root now, so a live stream must not keep writing after unmount. (#128)
  useEffect(() => () => abortRef.current?.abort(), []);

  return { isRunning, error, run, sendAction, sendMessage, stop, toRecording };
}
