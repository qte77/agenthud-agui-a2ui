import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, type EventLogEntry } from "./agent/applyA2UIEvent";
import type { RecordingEvent, Recording } from "./recordings";

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
  const startTimeRef = useRef(0);

  // Inject the @a2ui renderer; applyA2UIEvent stays decoupled from @a2ui/react.
  const render = useCallback(
    (messages: unknown[]) =>
      processMessages(messages as Parameters<typeof processMessages>[0]),
    [processMessages]
  );

  const playEvents = useCallback(
    (events: RecordingEvent[], index: number, startTime: number) => {
      if (index >= events.length) {
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }

      const event = events[index];
      timerRef.current = setTimeout(() => {
        const entry = applyA2UIEvent(event, Date.now() - startTime, render);
        setEventLog((prev) => [...prev, entry]);
        playEvents(events, index + 1, startTime);
      }, event.delayMs);
    },
    [render]
  );

  const play = useCallback(
    (options?: { append?: boolean }) => {
      if (isPlaying) return;
      setIsPlaying(true);
      if (!options?.append) {
        setEventLog([]);
        clearSurfaces();
      }
      const start = Date.now();
      startTimeRef.current = start;
      playEvents(recording.events, 0, start);
    },
    [isPlaying, recording, playEvents, clearSurfaces]
  );

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setEventLog([]);
    clearSurfaces();
  }, [clearSurfaces]);

  return { isPlaying, eventLog, play, restart };
}
