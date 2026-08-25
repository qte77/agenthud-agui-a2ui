import { coalesceSurfaceUpdates } from "./applyA2UIEvent";
import {
  A2UIMessageBatchSchema,
  RecordingSchema,
  type A2UIMessageBatch,
  type Recording,
  type RecordingEvent,
} from "./contract";

// Serialize a live/agent-generated session into the SAME Recording the replay engine already plays,
// so a captured session replays identically (zero key, zero cost) from a file/link. One DRY core
// (`batchesToRecording`) is shared by the browser Save adapter and the headless-agent script — don't
// fork it. Asset tokens (`asset:<name>`) are kept verbatim; they resolve at replay time (see
// useReplayEngine → assets.ts), so recordings stay portable and self-hosted.

export interface RecordingMeta {
  title: string;
  description: string;
}

/** One captured live AG-UI event (the applyA2UIEvent shape + a capture timestamp, ms since start). */
export interface CapturedEvent {
  type: string;
  text?: string | undefined;
  a2uiMessages?: unknown[] | undefined;
  timestamp: number;
}

// Delay between batch-only events when explicit timing isn't supplied (the headless path has no
// stream timing) — a readable pace for replay, not a faithful reproduction.
const DEFAULT_DELAY_MS = 600;

/** Coalesce + validate one batch against the render contract; null if it violates it. */
function sanitizeBatch(batch: unknown[]): A2UIMessageBatch | null {
  const parsed = A2UIMessageBatchSchema.safeParse(coalesceSurfaceUpdates(batch));
  return parsed.success ? parsed.data : null;
}

/**
 * Pure core: turn a list of A2UI batches into a replayable Recording — one `TOOL_CALL_END` event per
 * batch, each coalesced + validated against the same contract the renderer uses. A batch that fails
 * the contract yields an event with no `a2uiMessages` (kept, never partially rendered). `delaysMs[i]`
 * sets event i's replay delay. The final `RecordingSchema.parse` is the output invariant.
 */
export function batchesToRecording(
  batches: unknown[][],
  meta: RecordingMeta,
  delaysMs?: number[]
): Recording {
  const events = batches.map((batch, i) => {
    const clean = sanitizeBatch(batch);
    return {
      delayMs: delaysMs?.[i] ?? DEFAULT_DELAY_MS,
      type: "TOOL_CALL_END",
      ...(clean ? { a2uiMessages: clean } : {}),
    } satisfies RecordingEvent;
  });
  return RecordingSchema.parse({ meta, events });
}

/**
 * Browser adapter: serialize the WINNING model attempt's captured events into a Recording. `delayMs`
 * is the gap between consecutive kept events; internal `FALLBACK` notes are excluded; an event whose
 * batch fails the contract keeps its row but drops the batch. Shares `sanitizeBatch` + the schema
 * invariant with the pure core above.
 */
export function liveEventsToRecording(events: CapturedEvent[], meta: RecordingMeta): Recording {
  const kept = events.filter((e) => e.type !== "FALLBACK");
  let prev = 0;
  const recEvents = kept.map((e) => {
    const delayMs = Math.max(0, e.timestamp - prev);
    prev = e.timestamp;
    const clean = e.a2uiMessages ? sanitizeBatch(e.a2uiMessages) : null;
    return {
      delayMs,
      type: e.type,
      ...(e.text !== undefined ? { text: e.text } : {}),
      ...(clean ? { a2uiMessages: clean } : {}),
    } satisfies RecordingEvent;
  });
  return RecordingSchema.parse({ meta, events: recEvents });
}
