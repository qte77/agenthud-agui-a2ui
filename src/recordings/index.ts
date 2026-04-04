import recording from "./overview.json";
import aiProjectsRec from "./ai-projects.json";
import devToolsRec from "./dev-tools.json";
import filtersRec from "./interactive-filters.json";

export interface RecordingEvent {
  delayMs: number;
  type: string;
  text?: string;
  segment?: string;
  a2uiMessages?: object[];
  [key: string]: unknown;
}

export interface TreeChoice {
  label: string;
  hint: string;
  segment: string;
  next: string | null;
}

export interface TreeNode {
  prompt: string;
  choices: TreeChoice[];
}

export type DecisionTree = Record<string, TreeNode>;

export interface Recording {
  meta: { title: string; description: string };
  events: RecordingEvent[];
  tree?: DecisionTree;
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

export interface Tour {
  id: string;
  label: string;
  description: string;
  recording: Recording;
}

export const fullRecording = recording as unknown as Recording;
export const segments = extractSegments(fullRecording);
export const decisionTree = fullRecording.tree ?? {};

export const tours: Tour[] = [
  { id: "overview", label: "Full Portfolio", description: "Complete tour with all segments and decision tree", recording: fullRecording },
  { id: "ai-projects", label: "AI Projects", description: "Deep dive into AI and ML repositories", recording: aiProjectsRec as unknown as Recording },
  { id: "dev-tools", label: "Developer Tools", description: "Tooling and orchestration repos", recording: devToolsRec as unknown as Recording },
  { id: "filters", label: "Interactive Filters", description: "CheckBox, Slider, Button components", recording: filtersRec as unknown as Recording },
];

/**
 * Patch root Column's explicitList to only reference IDs that exist
 * in the same surfaceUpdate. Prevents broken references when playing
 * a single segment that shares the root with other segments.
 */
function patchRootChildren(event: RecordingEvent): RecordingEvent {
  if (!event.a2uiMessages) return event;

  const patched = structuredClone(event);
  for (const msg of patched.a2uiMessages as Array<Record<string, unknown>>) {
    const update = msg.surfaceUpdate as
      | { components?: Array<{ id: string; component?: Record<string, unknown> }> }
      | undefined;
    if (!update?.components) continue;

    const definedIds = new Set(update.components.map((c) => c.id));
    const root = update.components.find((c) => c.id === "root");
    if (!root?.component) continue;

    const rootType = Object.keys(root.component)[0];
    const rootProps = root.component[rootType] as Record<string, unknown> | undefined;
    const children = rootProps?.children as { explicitList?: string[] } | undefined;
    if (!children?.explicitList) continue;

    children.explicitList = children.explicitList.filter((id) => definedIds.has(id));
  }
  return patched;
}

/** Filter recording events to only those in the given segment.
 *  When append=true, skip root patching (tree mode accumulates). */
export function getSegmentEvents(
  rec: Recording,
  segmentId: string | null,
  options?: { append?: boolean }
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
      filtered.push(options?.append ? event : patchRootChildren(event));
    }
  }

  return filtered;
}
