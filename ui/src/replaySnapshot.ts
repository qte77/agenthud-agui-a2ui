// Replay self-containment.
//
// @a2ui validates each surfaceUpdate message in isolation — every component id referenced inside it
// must be present in that same message's `components`. The pre-baked demo replays *incremental*
// deltas (a later batch re-declares `root` to reference cards defined in earlier batches), so each
// raw delta would fail that check. We keep a running snapshot of every component seen so far and
// re-emit a single self-contained surfaceUpdate each step, which renders the same accumulating UI
// while satisfying @a2ui. The live agent emits one complete batch already, so it needs none of this.

export interface SurfaceSnapshot {
  /** The most recent beginRendering message, replayed first so the surface keeps its root. */
  begin: unknown;
  surfaceId: string;
  /** id → latest component instance (later batches update in place). Insertion order is preserved. */
  components: Map<string, unknown>;
  /** Two-way-binding seed values folded from dataModelUpdate, as a plain nested object (path → value). */
  data: Record<string, unknown>;
}

export function emptySnapshot(): SurfaceSnapshot {
  return { begin: null, surfaceId: "main", components: new Map(), data: {} };
}

// ---- dataModelUpdate → plain nested object (#206) ----
// @a2ui seeds path-bound CheckBox/Slider values via `dataModelUpdate` (a ValueMap wire array). Its own
// ValueMap→object conversion is private, so we hand-roll the same shape: A2UIViewer's `data` prop and the
// path bindings resolve against a plain nested object (`/form/agree` → `{ form: { agree: true } }`).

/** One @a2ui ValueMap entry — the wire shape for a two-way-binding seed. */
interface ValueEntry {
  key: string;
  valueBoolean?: boolean;
  valueNumber?: number;
  valueString?: string;
  valueMap?: ValueEntry[];
}
interface DataModelUpdate {
  path?: string;
  contents?: ValueEntry[];
}

/** A ValueMap entry's value: a nested map recurses; otherwise the one present typed literal. */
function entryValue(e: ValueEntry): unknown {
  if (e.valueMap !== undefined) return valueMapToObject(e.valueMap);
  return e.valueBoolean ?? e.valueNumber ?? e.valueString;
}

/** Convert a ValueMap array into a plain nested object (`{ key: value }`). */
function valueMapToObject(entries: ValueEntry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of entries) out[e.key] = entryValue(e);
  return out;
}

/** Fold a dataModelUpdate's contents into `data` (mutates), nesting under its optional `/a/b` path. */
function foldDataModelUpdate(data: Record<string, unknown>, update: DataModelUpdate): void {
  const segments = update.path ? update.path.split("/").filter(Boolean) : [];
  let target = data;
  for (const seg of segments) {
    if (typeof target[seg] !== "object" || target[seg] === null) target[seg] = {};
    target = target[seg] as Record<string, unknown>;
  }
  Object.assign(target, valueMapToObject(update.contents ?? []));
}

/**
 * Fold one batch of A2UI messages into `snapshot` (mutates it) and return the self-contained batch
 * to render: the latest beginRendering (if any) plus one surfaceUpdate listing every component seen
 * so far — so any cross-batch reference resolves within this single message.
 */
export function accumulate(snapshot: SurfaceSnapshot, messages: unknown[]): unknown[] {
  const dataUpdates: unknown[] = [];
  for (const msg of messages as Record<string, unknown>[]) {
    if (msg.beginRendering) snapshot.begin = msg;
    if (msg.dataModelUpdate) {
      foldDataModelUpdate(snapshot.data, msg.dataModelUpdate);
      dataUpdates.push(msg);
    }
    const update = msg.surfaceUpdate as
      | { surfaceId?: string; components?: { id: string }[] }
      | undefined;
    if (!update) continue;
    if (typeof update.surfaceId === "string") snapshot.surfaceId = update.surfaceId;
    for (const comp of update.components ?? []) snapshot.components.set(comp.id, comp);
  }

  const batch: unknown[] = [];
  if (snapshot.begin) batch.push(snapshot.begin);
  // Only emit a surfaceUpdate once components exist — @a2ui rejects an empty components array
  // (min 1), which a begin-only "(surface init)" event would otherwise produce on a fresh path.
  if (snapshot.components.size > 0) {
    batch.push({
      surfaceUpdate: { surfaceId: snapshot.surfaceId, components: [...snapshot.components.values()] },
    });
  }
  // Pass THIS batch's dataModelUpdate(s) through, LAST (the live "send last" convention) so the rendered
  // surface seeds its path-bound controls; snapshot.data already holds them for the frozen A2UIViewer.
  batch.push(...dataUpdates);
  return batch;
}
