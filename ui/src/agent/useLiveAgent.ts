import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./applyA2UIEvent";
import { runLiveAgent, toConnectionError, type LiveSettings } from "./liveAgent";

// Live counterpart to useReplayEngine: a BYOK agent run feeds the SAME
// applyA2UIEvent seam (validated render + log entry), so the EventStream and A2UI
// surface are driven identically to replay. DRY.
export function useLiveAgent() {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const render = useCallback(
    (messages: unknown[]) =>
      processMessages(messages as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  const run = useCallback(
    async (settings: LiveSettings, prompt: string) => {
      if (isRunning) return;
      setIsRunning(true);
      setError(null);
      setEventLog([]);
      clearSurfaces();

      const start = Date.now();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        await runLiveAgent(
          settings,
          prompt,
          (event) => {
            const entry = applyA2UIEvent(event, Date.now() - start, render);
            setEventLog((prev) => appendLogEntry(prev, entry));
          },
          { signal: ac.signal }
        );
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(toConnectionError(err));
        }
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, clearSurfaces, render]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { eventLog, isRunning, error, run, stop };
}
