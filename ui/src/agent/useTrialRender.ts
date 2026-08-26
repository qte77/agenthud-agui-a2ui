import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./applyA2UIEvent";
import { resolveAssets } from "./assets";
import { postTrialRender } from "./trialRender";
import { emptySnapshot, accumulate } from "../replaySnapshot";
import { seedTurn, finalizeTurn, toTurnSnapshot, type TranscriptTurn } from "./transcript";

// Trial-tier counterpart to useLiveAgent (US-13): a single non-streaming JSON render, no BYOK
// settings, no model fall-through chain (one paid model, one attempt — the server already refunds a
// failure). Deliberately NOT a mode of useLiveAgent — that hook's shape (settings, fall-through,
// capture-for-replay) is BYOK-streaming-specific and doesn't fit a single owner-funded call. Feeds
// the SAME render seam (applyA2UIEvent) and the SAME transcript/event-log state as Live, via
// useA2UIActions() — a second consumer of the same provider-scoped surface, not a separate one.
export function useTrialRender(
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>,
  setTranscript: Dispatch<SetStateAction<TranscriptTurn[]>>
) {
  const { processMessages } = useA2UIActions();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const render = useCallback(
    (messages: unknown[]) =>
      processMessages(resolveAssets(messages) as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  const runTrial = useCallback(
    async (prompt: string, turnstileToken: string) => {
      setIsRunning(true);
      setError(null);
      setTranscript((prev) => seedTurn(prev, prompt));

      const start = Date.now();
      const snap = emptySnapshot();
      const result = await postTrialRender(prompt, turnstileToken);
      if (result.remaining !== undefined) setRemaining(result.remaining);

      if (result.a2uiMessages) {
        const entry = applyA2UIEvent(
          { type: "TRIAL_RENDER", a2uiMessages: result.a2uiMessages },
          Date.now() - start,
          render
        );
        if (entry.a2uiComponentCount !== undefined) accumulate(snap, resolveAssets(result.a2uiMessages));
        setEventLog((prev) => appendLogEntry(prev, entry));
      } else {
        setError(result.error ?? "The trial render didn't produce a UI — please try again.");
      }

      setTranscript((prev) => finalizeTurn(prev, toTurnSnapshot(snap)));
      setIsRunning(false);
    },
    [render, setEventLog, setTranscript]
  );

  return { isRunning, error, remaining, runTrial };
}
