import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import type { EventLogEntry } from "./EventStream";

interface A2UIComponent {
  id: string;
  component?: Record<string, unknown>;
}

interface A2UIMessage {
  beginRendering?: unknown;
  surfaceUpdate?: { components?: A2UIComponent[] };
  [key: string]: unknown;
}

interface RecordingEvent {
  delayMs: number;
  type: string;
  text?: string;
  a2uiMessages?: A2UIMessage[];
  [key: string]: unknown;
}

function extractA2UIInfo(messages: A2UIMessage[]): {
  count: number;
  types: string[];
} {
  const types = new Set<string>();
  let count = 0;
  for (const msg of messages) {
    if (msg.surfaceUpdate?.components) {
      for (const comp of msg.surfaceUpdate.components) {
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
