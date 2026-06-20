import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, type EventLogEntry } from "./agent/applyA2UIEvent";
import type { Recording } from "./recordings";

interface ReplayState {
  isPlaying: boolean;
  eventLog: EventLogEntry[];
  play: (options?: { append?: boolean }) => void;
  restart: () => void;
}

export function useReplayEngine(
  recording: Recording,
  onComplete?: () => void
): ReplayState {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject the @a2ui renderer; applyA2UIEvent stays decoupled from @a2ui/react.
  const render = useCallback(
    (messages: unknown[]) =>
      processMessages(messages as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  const play = useCallback(
    (options?: { append?: boolean }) => {
      if (isPlaying) return;
      setIsPlaying(true);
      if (!options?.append) {
        setEventLog([]);
        clearSurfaces();
      }

      const events = recording.events;
      const startTime = Date.now();

      // Schedule events one at a time: each fires after its delayMs, logs, then
      // queues the next. Plain inner recursion — no memoized self-reference.
      const step = (index: number) => {
        if (index >= events.length) {
          setIsPlaying(false);
          onCompleteRef.current?.();
          return;
        }
        const event = events[index];
        timerRef.current = setTimeout(() => {
          const entry = applyA2UIEvent(event, Date.now() - startTime, render);
          setEventLog((prev) => [...prev, entry]);
          step(index + 1);
        }, event.delayMs);
      };

      step(0);
    },
    [isPlaying, recording, render, clearSurfaces]
  );

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setEventLog([]);
    clearSurfaces();
  }, [clearSurfaces]);

  return { isPlaying, eventLog, play, restart };
}
