import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useA2UIActions } from "@a2ui/react";
import { applyA2UIEvent, appendLogEntry, type EventLogEntry } from "./agent/applyA2UIEvent";
import { resolveAssets } from "./agent/assets";
import { accumulate, emptySnapshot } from "./replaySnapshot";
import type { Recording } from "./recordings";

interface ReplayState {
  isPlaying: boolean;
  play: (options?: { append?: boolean }) => void;
  restart: () => void;
}

export function useReplayEngine(
  recording: Recording,
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>,
  onComplete?: () => void
): ReplayState {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const onCompleteRef = useRef(onComplete);
  // eslint-disable-next-line react-hooks/refs -- latest-callback ref so scheduled timers call the current onComplete
  onCompleteRef.current = onComplete;
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Running snapshot so each replayed delta renders as a self-contained surfaceUpdate (see
  // replaySnapshot.ts) — without it, @a2ui rejects a batch whose root references a card defined in
  // an earlier batch. Reset on a fresh (non-append) play; carried across append plays (tree mode).
  const snapshotRef = useRef(emptySnapshot());

  // Inject the @a2ui renderer; applyA2UIEvent stays decoupled from @a2ui/react.
  const render = useCallback(
    (messages: unknown[]) =>
      // Resolve `asset:<name>` image tokens to bundled URLs before folding/rendering — mirrors
      // useLiveAgent (assets.ts) so a CAPTURED recording's asset tokens replay as real images
      // instead of unfetchable `asset:` URLs. The demo's overview.json is pre-resolved at build
      // time (recordings/index.ts), so this is a no-op for it and the fix for everything else.
      processMessages(
        accumulate(snapshotRef.current, resolveAssets(messages)) as Parameters<
          typeof processMessages
        >[0]
      ),
    [processMessages]
  );

  const play = useCallback(
    (options?: { append?: boolean }) => {
      if (isPlaying) return;
      setIsPlaying(true);
      if (!options?.append) {
        setEventLog([]);
        clearSurfaces();
        snapshotRef.current = emptySnapshot();
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
        // index < events.length is guaranteed by the guard above
        const event = events[index]!;
        timerRef.current = setTimeout(() => {
          const entry = applyA2UIEvent(event, Date.now() - startTime, render);
          setEventLog((prev) => appendLogEntry(prev, entry));
          step(index + 1);
        }, event.delayMs);
      };

      step(0);
    },
    [isPlaying, recording, render, clearSurfaces, setEventLog]
  );

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setEventLog([]);
    clearSurfaces();
    snapshotRef.current = emptySnapshot();
  }, [clearSurfaces, setEventLog]);

  // The event log lives in the App root now (shared across sources), so a replay timer that
  // outlives this dashboard's unmount would be a zombie writer into the shared log/surface.
  // Cancel the scheduled chain on unmount. (#128)
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { isPlaying, play, restart };
}
