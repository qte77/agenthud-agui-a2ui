import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import type { EventLogEntry } from "./EventStream";
import type { RecordingEvent, Recording } from "./recordings";

function extractA2UIInfo(messages: object[]): {
  count: number;
  types: string[];
} {
  const types = new Set<string>();
  let count = 0;
  for (const msg of messages as Array<Record<string, unknown>>) {
    const update = msg.surfaceUpdate as
      | { components?: Array<{ component?: Record<string, unknown> }> }
      | undefined;
    if (update?.components) {
      for (const comp of update.components) {
        count++;
        if (comp.component) {
          const type = Object.keys(comp.component)[0];
          if (type) types.add(type);
        }
      }
    }
    if (msg.beginRendering) {
      types.add("beginRendering");
    }
  }
  return { count, types: [...types] };
}

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

  const playEvents = useCallback(
    (events: RecordingEvent[], index: number, startTime: number) => {
      if (index >= events.length) {
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }

      const event = events[index];
      timerRef.current = setTimeout(() => {
        const a2uiInfo = event.a2uiMessages
          ? extractA2UIInfo(event.a2uiMessages)
          : undefined;

        const entry: EventLogEntry = {
          type: event.type,
          timestamp: Date.now() - startTime,
          text: event.text,
          a2uiComponentCount: a2uiInfo?.count,
          a2uiComponentTypes: a2uiInfo?.types,
        };
        setEventLog((prev) => [...prev, entry]);

        if (event.a2uiMessages) {
          try {
            processMessages(
              event.a2uiMessages as Parameters<typeof processMessages>[0]
            );
          } catch (e) {
            console.warn("A2UI processMessages error:", e);
          }
        }

        playEvents(events, index + 1, startTime);
      }, event.delayMs);
    },
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
