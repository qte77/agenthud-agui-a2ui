import { A2UIMessageBatchSchema } from "./contract";

// One log row in the AG-UI event stream (right panel).
export interface EventLogEntry {
  type: string;
  timestamp: number;
  // exactOptionalPropertyTypes: allow explicit undefined so callers can spread {text: maybeStr}
  text?: string | undefined;
  a2uiComponentCount?: number | undefined;
  a2uiComponentTypes?: string[] | undefined;
}

// Minimal shape shared by replayed events and live AG-UI events.
export interface AgentEvent {
  type: string;
  // exactOptionalPropertyTypes: allow explicit undefined (e.g. toolName may be absent)
  text?: string | undefined;
  a2uiMessages?: unknown[] | undefined;
}

/** Count components and collect catalog types from a single A2UI message object. */
function collectFromMessage(
  msg: Record<string, unknown>,
  types: Set<string>,
): number {
  let count = 0;
  const update = msg.surfaceUpdate as
    | { components?: { component?: Record<string, unknown> }[] }
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
  if (msg.beginRendering) types.add("beginRendering");
  return count;
}

/** Summarize an A2UI batch for the log: component count + distinct catalog types. */
export function summarizeA2UI(messages: unknown[]): {
  count: number;
  types: string[];
} {
  const types = new Set<string>();
  let count = 0;
  for (const msg of messages as Record<string, unknown>[]) {
    count += collectFromMessage(msg, types);
  }
  return { count, types: [...types] };
}

interface SurfaceUpdate {
  surfaceId?: string;
  components?: { id?: string }[];
}
// Batches come from a model, so every element is treated as possibly absent/malformed.
type BatchMessage = { surfaceUpdate?: SurfaceUpdate } | null | undefined;

/** Every surface's components, keyed id → component in first-seen order (a re-declared id keeps
 *  its position and takes its latest definition — exactly what a Map does). */
function componentsBySurface(messages: unknown[]): Map<string, Map<string, unknown>> {
  const bySurface = new Map<string, Map<string, unknown>>();
  let anonymous = 0;
  for (const msg of messages as BatchMessage[]) {
    const update = msg?.surfaceUpdate;
    if (!update?.components) continue;
    const byId = bySurface.get(update.surfaceId ?? "") ?? new Map<string, unknown>();
    // An id-less component is invalid for @a2ui anyway; key it uniquely so it still reaches the
    // validator (which reports it) instead of silently collapsing onto another entry.
    for (const component of update.components) {
      byId.set(component.id ?? `#anonymous-${String(anonymous++)}`, component);
    }
    bySurface.set(update.surfaceId ?? "", byId);
  }
  return bySurface;
}

/**
 * Merge every `surfaceUpdate` of the same surface in one batch into a single message.
 *
 * A2UI v0.8 resolves child references *within* one surfaceUpdate — its schema calls `components`
 * "a list containing all UI components for the surface" — so a batch that splits them across
 * several updates is rejected wholesale ("Component 'root' references non-existent component ID
 * 'x'") even when the ids all exist somewhere in the batch. Small models split like this often
 * (observed live on tabbed UIs), and since a tool call delivers the whole batch atomically there is
 * nothing incremental to preserve: merging is semantics-preserving and makes the split harmless.
 * The merged update keeps the first update's position; a re-declared id keeps its first position
 * with its last definition (a Map does both), so @a2ui never sees a duplicate id.
 */
export function coalesceSurfaceUpdates(messages: unknown[]): unknown[] {
  const merged = componentsBySurface(messages);
  const emitted = new Set<string>();
  const out: unknown[] = [];
  for (const msg of messages as BatchMessage[]) {
    const update = msg?.surfaceUpdate;
    if (!update?.components) {
      out.push(msg);
      continue;
    }
    const surfaceId = update.surfaceId ?? "";
    if (emitted.has(surfaceId)) continue; // already folded into this surface's first update
    emitted.add(surfaceId);
    const components = [...merged.get(surfaceId)!.values()];
    out.push({ ...msg, surfaceUpdate: { ...update, components } });
  }
  return out;
}

/**
 * Apply one AG-UI-style event to the A2UI surface and return its log entry.
 *
 * The single seam shared by the pre-baked replay engine and the (Phase B) live
 * agent — both produce the same {type, text, a2uiMessages} and render through one
 * path. The A2UI payload is the EXTERNAL contract: it is validated against
 * A2UIMessageBatchSchema before it reaches `render`; an invalid batch is logged
 * and skipped (never partially rendered). `render` is injected so this module
 * stays free of any @a2ui/react coupling.
 */
export function applyA2UIEvent(
  event: AgentEvent,
  timestamp: number,
  render: (messages: unknown[]) => void
): EventLogEntry {
  const entry: EventLogEntry = {
    type: event.type,
    timestamp,
    text: event.text,
  };

  if (!event.a2uiMessages) return entry;

  // Fold split surfaceUpdates before validating/rendering — see coalesceSurfaceUpdates.
  const messages = coalesceSurfaceUpdates(event.a2uiMessages);
  const parsed = A2UIMessageBatchSchema.safeParse(messages);
  if (!parsed.success) {
    // Surface the violation in the event log instead of skipping silently (a blank surface with no
    // log entry once hid a live model emitting a batch that fails our contract). Mirrors the
    // render-error surfacing below.
    console.warn("A2UI contract violation — skipping render:", parsed.error.issues);
    const first = parsed.error.issues[0];
    entry.text = `A2UI contract violation (skipped): ${
      first ? `${first.path.join(".")} — ${first.message}` : "invalid batch"
    }`;
    return entry;
  }

  const info = summarizeA2UI(messages);
  entry.a2uiComponentCount = info.count;
  entry.a2uiComponentTypes = info.types;

  try {
    render(messages);
  } catch (e) {
    // Surface render failures (e.g. an @a2ui schema mismatch) in the event log instead of silently
    // blanking the surface — a silent swallow here once hid a Card `children` vs `child` mismatch.
    const message = e instanceof Error ? e.message : String(e);
    console.error("A2UI render error:", e);
    entry.text = `A2UI render error: ${message}`;
  }
  return entry;
}

/**
 * Append a log entry, coalescing consecutive `TEXT_MESSAGE_CONTENT` deltas into one row.
 * A streaming agent emits many tiny text deltas; merging them keeps the event log readable
 * (one row per message, not per token). Immutable — returns a new array (and a new merged
 * entry), never mutating `log` or the entries already held in React state.
 */
export function appendLogEntry(
  log: EventLogEntry[],
  entry: EventLogEntry
): EventLogEntry[] {
  const last = log[log.length - 1];
  if (entry.type === "TEXT_MESSAGE_CONTENT" && last?.type === "TEXT_MESSAGE_CONTENT") {
    // Spread `last` so the merged row keeps the first delta's timestamp.
    const merged: EventLogEntry = { ...last, text: (last.text ?? "") + (entry.text ?? "") };
    return [...log.slice(0, -1), merged];
  }
  return [...log, entry];
}
