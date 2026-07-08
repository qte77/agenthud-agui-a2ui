import { describe, it, expect } from "vitest";
import { emptySnapshot, accumulate } from "../src/replaySnapshot";
import {
  seedTurn,
  finalizeTurn,
  toTurnSnapshot,
  type TranscriptTurn,
  type TurnSnapshot,
} from "../src/agent/transcript";

// The transcript is the display-only history the composer/actions build on: one row per turn
// (user text + that turn's frozen render). Pure list helpers + the SurfaceSnapshot → viewer-props fold.
describe("transcript", () => {
  const snapshot = (root: string): TurnSnapshot => ({
    root,
    components: [{ id: root, component: { Text: { text: { literalString: "x" } } } }],
  });

  describe("seedTurn", () => {
    it("appends a pending turn without mutating the input", () => {
      const turns: TranscriptTurn[] = [{ userText: "first", snapshot: snapshot("t1") }];

      const next = seedTurn(turns, "second");

      expect(next).toHaveLength(2);
      expect(next[1]).toEqual({ userText: "second", snapshot: null });
      expect(turns).toHaveLength(1); // immutable
    });
  });

  describe("finalizeTurn", () => {
    it("replaces only the last turn's snapshot, immutably", () => {
      const turns: TranscriptTurn[] = [
        { userText: "first", snapshot: snapshot("t1") },
        { userText: "second", snapshot: null },
      ];
      const snap = snapshot("t2");

      const next = finalizeTurn(turns, snap);

      expect(next[0]?.snapshot?.root).toBe("t1"); // earlier turn untouched
      expect(next[1]).toEqual({ userText: "second", snapshot: snap });
      expect(turns[1]?.snapshot).toBeNull(); // immutable
    });

    it("is a no-op on an empty transcript", () => {
      expect(finalizeTurn([], snapshot("t1"))).toEqual([]);
    });
  });

  describe("toTurnSnapshot", () => {
    it("folds a begin+update snapshot into {root, components} in insertion order", () => {
      const snap = emptySnapshot();
      accumulate(snap, [
        { beginRendering: { surfaceId: "main", root: "root" } },
        {
          surfaceUpdate: {
            surfaceId: "main",
            components: [
              { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
              { id: "a", component: { Text: { text: { literalString: "A" } } } },
            ],
          },
        },
      ]);

      const result = toTurnSnapshot(snap);

      expect(result?.root).toBe("root");
      expect(result?.components.map((c) => c.id)).toEqual(["root", "a"]);
    });

    it("returns null when no beginRendering set the root", () => {
      const snap = emptySnapshot();
      accumulate(snap, [
        { surfaceUpdate: { surfaceId: "main", components: [{ id: "a", component: {} }] } },
      ]);

      expect(toTurnSnapshot(snap)).toBeNull();
    });

    it("returns null when no components accumulated (begin-only)", () => {
      const snap = emptySnapshot();
      accumulate(snap, [{ beginRendering: { surfaceId: "main", root: "root" } }]);

      expect(toTurnSnapshot(snap)).toBeNull();
    });
  });
});
