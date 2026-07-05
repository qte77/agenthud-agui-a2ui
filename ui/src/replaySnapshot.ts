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
}

export function emptySnapshot(): SurfaceSnapshot {
  return { begin: null, surfaceId: "main", components: new Map() };
}

/**
 * Fold one batch of A2UI messages into `snapshot` (mutates it) and return the self-contained batch
 * to render: the latest beginRendering (if any) plus one surfaceUpdate listing every component seen
 * so far — so any cross-batch reference resolves within this single message.
 */
export function accumulate(snapshot: SurfaceSnapshot, messages: unknown[]): unknown[] {
  for (const msg of messages as Record<string, unknown>[]) {
    if (msg.beginRendering) snapshot.begin = msg;
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
  return batch;
}
