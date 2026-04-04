import recording from "./overview.json";

export interface RecordingEvent {
  delayMs: number;
  type: string;
  text?: string;
  segment?: string;
  a2uiMessages?: object[];
  [key: string]: unknown;
}

export interface Recording {
  meta: { title: string; description: string };
  events: RecordingEvent[];
}

export interface Segment {
  id: string;
  label: string;
  componentHint: string;
}

/** Derive segments from STEP_STARTED events with segment field */
function extractSegments(rec: Recording): Segment[] {
  const componentsBySegment = new Map<string, Set<string>>();

  let currentSegment: string | null = null;
  for (const event of rec.events) {
    if (event.type === "STEP_STARTED" && event.segment) {
      currentSegment = event.segment;
      if (!componentsBySegment.has(currentSegment)) {
        componentsBySegment.set(currentSegment, new Set());
      }
    }
    if (currentSegment && event.a2uiMessages) {
      for (const msg of event.a2uiMessages as Array<Record<string, unknown>>) {
        const update = msg.surfaceUpdate as
          | { components?: Array<{ component?: Record<string, unknown> }> }
          | undefined;
        if (update?.components) {
          for (const comp of update.components) {
            if (comp.component) {
              const type = Object.keys(comp.component)[0];
              if (type) componentsBySegment.get(currentSegment)!.add(type);
            }
          }
        }
      }
    }
  }

  return Array.from(componentsBySegment.entries()).map(([id, types]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    componentHint: [...types].join(", "),
  }));
}

export const fullRecording = recording as Recording;
export const segments = extractSegments(fullRecording);

/** Filter recording events to only those in the given segment */
export function getSegmentEvents(
  rec: Recording,
  segmentId: string | null
): RecordingEvent[] {
  if (!segmentId) return rec.events;

  const filtered: RecordingEvent[] = [];
  let inSegment = false;
  let foundBeginRendering = false;

  for (const event of rec.events) {
    // Always include RUN lifecycle
    if (event.type === "RUN_STARTED" || event.type === "RUN_FINISHED") {
      filtered.push(event);
      continue;
    }

    // Track segment boundaries
    if (event.type === "STEP_STARTED" && event.segment) {
      inSegment = event.segment === segmentId;
    }
    if (event.type === "STEP_FINISHED") {
      if (inSegment) {
        filtered.push(event);
        inSegment = false;
      }
      continue;
    }

    if (inSegment) {
      // Ensure beginRendering is included for the surface
      if (event.a2uiMessages && !foundBeginRendering) {
        const hasBegin = (event.a2uiMessages as Array<Record<string, unknown>>).some(
          (m) => m.beginRendering
        );
        if (!hasBegin) {
          filtered.push({
            delayMs: 0,
            type: "TOOL_CALL_START",
            text: "(surface init)",
            a2uiMessages: [
              { beginRendering: { surfaceId: "main", root: "root" } },
            ],
          });
        }
        foundBeginRendering = true;
      }
      filtered.push(event);
    }
  }

  return filtered;
}
