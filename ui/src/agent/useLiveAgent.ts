import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./applyA2UIEvent";
import { resolveAssets } from "./assets";
import { runLiveAgent, toConnectionError, type LiveSettings } from "./liveAgent";
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

  const render = useCallback(
    (messages: unknown[]) =>
      // Resolve `asset:<name>` image tokens to bundled URLs before rendering (self-hosted images).
      processMessages(resolveAssets(messages) as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  // Shared one-turn stream routine. `userText` is the user's side of this turn (prompt / composer
  // text / clicked-action label) — the transcript row; run + sendAction/sendMessage differ only in
  // how history + userText are prepared.
  const stream = useCallback(
    async (settings: LiveSettings, messages: ConversationTurn[], userText: string) => {
      setIsRunning(true);
      setError(null);
      setTranscript((prev) => seedTurn(prev, userText));
      // A2UI batches seen during this stream — the last one feeds the assistant summary.
      const batches: unknown[][] = [];
      // Fold this turn's validated batches into one self-contained snapshot to freeze in the transcript.
      const snap = emptySnapshot();

      const start = Date.now();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        await runLiveAgent(
          settings,
          messages,
          (event) => {
            if (event.a2uiMessages) batches.push(event.a2uiMessages);
            const entry = applyA2UIEvent(event, Date.now() - start, render);
            // Only fold validated batches (a2uiComponentCount is set on schema success) and resolve
            // asset tokens first, so a frozen turn renders exactly what the live surface showed.
            if (event.a2uiMessages && entry.a2uiComponentCount !== undefined) {
              accumulate(snap, resolveAssets(event.a2uiMessages));
            }
            setEventLog((prev) => appendLogEntry(prev, entry));
          },
          { signal: ac.signal }
        );
        // Turn memory: record what this turn rendered so the NEXT turn sees it.
        const lastBatch = batches.at(-1);
        if (lastBatch) {
          messagesRef.current = appendAssistantTurn(messagesRef.current, summarizeRender(lastBatch));
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(toConnectionError(err));
        }
      } finally {
        // Freeze this turn's surface (null if it rendered nothing / failed before any valid batch).
        setTranscript((prev) => finalizeTurn(prev, toTurnSnapshot(snap)));
        setIsRunning(false);
      }
    },
    [render, setEventLog, setTranscript]
  );

  const run = useCallback(
    async (settings: LiveSettings, prompt: string) => {
      if (isRunning) return;
      // Fresh conversation: reset log, surface, transcript, and history.
      setEventLog([]);
      setTranscript([]);
      clearSurfaces();
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

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Abort any in-flight stream if this dashboard unmounts (source switch) — the shared log/surface
  // setter lives in the App root now, so a live stream must not keep writing after unmount. (#128)
  useEffect(() => () => abortRef.current?.abort(), []);

  return { isRunning, error, run, sendAction, sendMessage, stop };
}
