import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import type { EventLogEntry } from "./EventStream";

interface RecordingEvent {
  delayMs: number;
  type: string;
  text?: string;
  a2uiMessages?: object[];
  [key: string]: unknown;
}

interface Recording {
  meta: { title: string; description: string };
  events: RecordingEvent[];
}

interface ReplayState {
  isPlaying: boolean;
  eventLog: EventLogEntry[];
  play: () => void;
  restart: () => void;
}

export function useReplayEngine(recording: Recording): ReplayState {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);

  const playEvents = useCallback(
    (events: RecordingEvent[], index: number, startTime: number) => {
      if (index >= events.length) {
        setIsPlaying(false);
        return;
      }

      const event = events[index];
      timerRef.current = setTimeout(() => {
        const entry: EventLogEntry = {
          type: event.type,
          timestamp: Date.now() - startTime,
          text: event.text,
        };
        setEventLog((prev) => [...prev, entry]);

        if (event.a2uiMessages) {
          processMessages(
            event.a2uiMessages as Parameters<typeof processMessages>[0]
          );
        }

        playEvents(events, index + 1, startTime);
      }, event.delayMs);
    },
    [processMessages]
  );

  const play = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    setEventLog([]);
    clearSurfaces();
    const start = Date.now();
    startTimeRef.current = start;
    playEvents(recording.events, 0, start);
  }, [isPlaying, recording, playEvents, clearSurfaces]);

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setEventLog([]);
    clearSurfaces();
  }, [clearSurfaces]);

  return { isPlaying, eventLog, play, restart };
}
