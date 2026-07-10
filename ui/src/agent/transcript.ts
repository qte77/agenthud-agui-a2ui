// Display-only conversation transcript for Live mode (#195).
//
// One row per turn: the user's text + that turn's rendered surface. Prior turns are frozen
// A2UIViewer snapshots; the latest stays the live interactive surface. This is UI history only —
// `messagesRef` in useLiveAgent remains the sole source of truth for what the model sees.

import type { SurfaceSnapshot } from "../replaySnapshot";
// Type-only: erased at build, so this module stays runtime-pure (no @a2ui/ai coupling) while
// reusing @a2ui's own shape instead of a hand-rolled structural dupe.
import type { ComponentInstance } from "@a2ui/react";

/** A completed turn's self-contained render — exactly the props A2UIViewer wants. */
export interface TurnSnapshot {
  root: string;
  components: ComponentInstance[];
  /** Folded dataModelUpdate seed so frozen data-bound controls keep their values, not defaults (#206). */
  data: Record<string, unknown>;
}

export interface TranscriptTurn {
  /** The user's side of the turn: typed prompt, composer message, or clicked-action label. */
  userText: string;
  /** null while the turn is streaming, or after a render-free / failed turn. */
  snapshot: TurnSnapshot | null;
}

/** Immutable append of a new streaming turn (snapshot pending). */
export function seedTurn(turns: TranscriptTurn[], userText: string): TranscriptTurn[] {
  return [...turns, { userText, snapshot: null }];
}

/** Immutable replace of the LAST turn's snapshot once its stream settles. No-op on []. */
export function finalizeTurn(
  turns: TranscriptTurn[],
  snapshot: TurnSnapshot | null
): TranscriptTurn[] {
  if (turns.length === 0) return turns;
  const last = turns[turns.length - 1]!;
  return [...turns.slice(0, -1), { ...last, snapshot }];
}

/**
 * Fold the running SurfaceSnapshot (see replaySnapshot.accumulate) into A2UIViewer props.
 * null when the turn never established a root or rendered no components — nothing to freeze.
 * NOTE: only validated batches reach the snapshot (gated on `a2uiComponentCount` in useLiveAgent),
 * so the Map values are guaranteed {id, component} — the cast is safe.
 */
export function toTurnSnapshot(snap: SurfaceSnapshot): TurnSnapshot | null {
  const root = (snap.begin as { beginRendering?: { root?: string } } | null)?.beginRendering?.root;
  if (root === undefined || snap.components.size === 0) return null;
  return { root, components: [...snap.components.values()] as ComponentInstance[], data: { ...snap.data } };
}

/** UI-facing label for a clicked A2UI action (the model-facing text stays actionToTurn's). */
export function actionLabel(name: string): string {
  return `Clicked "${name}"`;
}
