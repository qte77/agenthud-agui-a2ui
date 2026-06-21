import { A2UIMessageBatchSchema } from "./contract";

// One log row in the AG-UI event stream (right panel).
export interface EventLogEntry {
  type: string;
  timestamp: number;
  text?: string;
  a2uiComponentCount?: number;
  a2uiComponentTypes?: string[];
}

// Minimal shape shared by replayed events and live AG-UI events.
export interface AgentEvent {
  type: string;
  text?: string;
  a2uiMessages?: unknown[];
}

/** Summarize an A2UI batch for the log: component count + distinct catalog types. */
export function summarizeA2UI(messages: unknown[]): {
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
    if (msg.beginRendering) types.add("beginRendering");
  }
  return { count, types: [...types] };
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

  const parsed = A2UIMessageBatchSchema.safeParse(event.a2uiMessages);
  if (!parsed.success) {
    console.warn(
      "A2UI contract violation — skipping render:",
      parsed.error.issues
    );
    return entry;
  }

  const info = summarizeA2UI(event.a2uiMessages);
  entry.a2uiComponentCount = info.count;
  entry.a2uiComponentTypes = info.types;

  try {
    render(event.a2uiMessages);
  } catch (e) {
    console.warn("A2UI render error:", e);
  }
  return entry;
}
