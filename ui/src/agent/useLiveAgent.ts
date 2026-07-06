import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./applyA2UIEvent";
import { resolveAssets } from "./assets";
import { runLiveAgent, toConnectionError, type LiveSettings } from "./liveAgent";
import {
  actionToTurn,
  appendUserTurn,
  appendAssistantTurn,
  summarizeRender,
  type ConversationTurn,
} from "./conversation";

// Live counterpart to useReplayEngine: a BYOK agent run feeds the SAME
// applyA2UIEvent seam (validated render + log entry), so the EventStream and A2UI
// surface are driven identically to replay. DRY.
export function useLiveAgent() {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
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

  // Shared one-turn stream routine (run + sendAction differ only in how history is prepared).
  const stream = useCallback(
    async (settings: LiveSettings, messages: ConversationTurn[]) => {
      setIsRunning(true);
      setError(null);
      // A2UI batches seen during this stream — the last one feeds the assistant summary.
      const batches: unknown[][] = [];

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
        setIsRunning(false);
      }
    },
    [render]
  );

  const run = useCallback(
    async (settings: LiveSettings, prompt: string) => {
      if (isRunning) return;
      // Fresh conversation: reset log, surface, and history.
      setEventLog([]);
      clearSurfaces();
      messagesRef.current = [{ role: "user", content: prompt }];
      await stream(settings, messagesRef.current);
    },
    [isRunning, clearSurfaces, stream]
  );

  // Button click → one follow-up turn with the FULL history. No clearSurfaces(): the new
  // beginRendering replaces the surface, avoiding a blank flash. No-op before the first run.
  const sendAction = useCallback(
    async (settings: LiveSettings, name: string) => {
      if (isRunning || messagesRef.current.length === 0) return;
      messagesRef.current = appendUserTurn(messagesRef.current, actionToTurn(name).content);
      await stream(settings, messagesRef.current);
    },
    [isRunning, stream]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { eventLog, isRunning, error, run, sendAction, stop };
}
