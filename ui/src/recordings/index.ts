import recording from "./overview.json";
import qte77Avatar from "./qte77-avatar.png";
import type {
  RecordingEvent,
  Recording,
  TreeChoice,
  TreeNode,
  DecisionTree,
} from "../agent/contract";

// Single source of truth for these shapes is the validated contract.
export type { RecordingEvent, Recording, TreeChoice, TreeNode, DecisionTree };

export interface Segment {
  id: string;
  label: string;
  componentHint: string;
}

interface RecordingComponent {
  id: string;
  component?: Record<string, unknown>;
}

/** Run `fn` over each surfaceUpdate's components array in an event's A2UI messages. */
function forEachComponentList(
  event: RecordingEvent,
  fn: (components: RecordingComponent[]) => void,
): void {
  if (!event.a2uiMessages) return;
  for (const msg of event.a2uiMessages as Record<string, unknown>[]) {
    const update = msg.surfaceUpdate as { components?: RecordingComponent[] } | undefined;
    if (update?.components) fn(update.components);
  }
}

/** Collect component catalog types from one event into the per-segment type set. */
function trackComponentTypes(event: RecordingEvent, types: Set<string>): void {
  forEachComponentList(event, (components) => {
    for (const comp of components) {
      const type = comp.component && Object.keys(comp.component)[0];
      if (type) types.add(type);
    }
  });
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
      const types = componentsBySegment.get(currentSegment);
      if (types) trackComponentTypes(event, types);
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

// Resolve the recording's logical avatar reference (brand neutral variant) to
// the bundled, base-path-correct asset URL so the demo self-hosts the avatar
// and makes zero external requests (works under the GitHub Pages base path).
const AVATAR_TOKEN = "asset:qte77-avatar";
export const fullRecording = JSON.parse(
  JSON.stringify(recording).replaceAll(AVATAR_TOKEN, qte77Avatar)
) as Recording;
export const segments = extractSegments(fullRecording);
export const decisionTree = fullRecording.tree ?? {};

// Streamlined to the single decision-tree tour — the one that shows the core
// "different intents → different layouts from one catalog" idea. The three
// redundant linear tours were dropped.
export const tours: Tour[] = [
  {
    id: "overview",
    label: "Full Portfolio",
    description: "Complete tour with all segments and decision tree",
    recording: fullRecording,
  },
];

/**
 * Patch root's explicitList to drop references to component IDs not defined anywhere in the
 * segment so far. `definedIds` accumulates across the segment's surfaceUpdates, mirroring the
 * @a2ui processor's cumulative component Map — so cards added by earlier batches in the same
 * segment are kept, while truly-dangling cross-segment references are stripped.
 */
function patchRootChildren(
  event: RecordingEvent,
  definedIds: Set<string>
): RecordingEvent {
  if (!event.a2uiMessages) return event;

  const patched = structuredClone(event);
  forEachComponentList(patched, (components) => {
    for (const c of components) definedIds.add(c.id);
    const root = components.find((c) => c.id === "root");
    if (!root?.component) return;

    // root.component is a non-empty map (one catalog type per component)
    const rootType = Object.keys(root.component)[0]!;
    const rootProps = root.component[rootType] as Record<string, unknown> | undefined;
    const children = rootProps?.children as { explicitList?: string[] } | undefined;
    if (!children?.explicitList) return;

    children.explicitList = children.explicitList.filter((id) => definedIds.has(id));
  });
  return patched;
}

/**
 * Inject a synthetic beginRendering event before the first A2UI batch in a segment
 * if the batch does not already include one. Returns true once beginRendering is confirmed.
 */
function maybeInjectBeginRendering(
  event: RecordingEvent,
  foundBeginRendering: boolean,
  filtered: RecordingEvent[],
): boolean {
  if (!event.a2uiMessages || foundBeginRendering) return foundBeginRendering;
  const hasBegin = (event.a2uiMessages as Record<string, unknown>[]).some(
    (m) => m.beginRendering,
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
  return true;
}

/** Resolve which of a tree node's choices a rendered Button's A2UI action name triggers. */
export function findChoiceByAction(
  node: TreeNode | undefined,
  action: string
): TreeChoice | null {
  return node?.choices.find((c) => c.action === action) ?? null;
}

/** Collect every component id defined by the given segments' events. */
function collectSegmentIds(rec: Recording, segmentIds: readonly string[]): Set<string> {
  const wanted = new Set(segmentIds);
  const ids = new Set<string>();
  let current: string | null = null;
  for (const event of rec.events) {
    if (event.type === "STEP_STARTED" && event.segment) current = event.segment;
    else if (event.type === "STEP_FINISHED") current = null;
    else if (current && wanted.has(current)) {
      forEachComponentList(event, (components) => {
        for (const c of components) ids.add(c.id);
      });
    }
  }
  return ids;
}

interface RootPatchMode {
  patch: boolean;
  definedIds: Set<string>;
}

/** Resolve how root refs are patched: fresh mode patches from an empty seed; append mode patches
 *  seeded with the played segments' ids, or (legacy, no `playedSegments`) passes events through. */
function resolveRootPatchMode(
  rec: Recording,
  options?: { append?: boolean; playedSegments?: readonly string[] }
): RootPatchMode {
  if (options?.append) {
    if (options.playedSegments === undefined) return { patch: false, definedIds: new Set() };
    return { patch: true, definedIds: collectSegmentIds(rec, options.playedSegments) };
  }
  return { patch: true, definedIds: new Set() };
}

/** Filter recording events to only those in the given segment.
 *  Tree mode (append=true) accumulates the surface across the segments the visitor actually
 *  played, so root patching is seeded with `playedSegments`' component ids: refs to visited
 *  sections keep stacking, while refs to never-played segments are stripped (the recording's
 *  roots optimistically list ALL prior sections — dangling ids fail the processor's referential
 *  check and nothing renders). Without `playedSegments`, append keeps the legacy raw pass-through. */
export function getSegmentEvents(
  rec: Recording,
  segmentId: string | null,
  options?: { append?: boolean; playedSegments?: readonly string[] }
): RecordingEvent[] {
  if (!segmentId) return rec.events;

  const filtered: RecordingEvent[] = [];
  let inSegment = false;
  let foundBeginRendering = false;
  const { patch, definedIds } = resolveRootPatchMode(rec, options);

  for (const event of rec.events) {
    if (event.type === "RUN_STARTED" || event.type === "RUN_FINISHED") {
      filtered.push(event);
    } else if (event.type === "STEP_STARTED" && event.segment) {
      inSegment = event.segment === segmentId;
    } else if (event.type === "STEP_FINISHED") {
      if (inSegment) {
        filtered.push(event);
        inSegment = false;
      }
    } else if (inSegment) {
      foundBeginRendering = maybeInjectBeginRendering(event, foundBeginRendering, filtered);
      filtered.push(patch ? patchRootChildren(event, definedIds) : event);
    }
  }

  return filtered;
}
