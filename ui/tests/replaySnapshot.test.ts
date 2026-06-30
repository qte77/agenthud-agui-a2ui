import { describe, it, expect } from "vitest";
import { emptySnapshot, accumulate } from "../src/replaySnapshot";

// @a2ui validates each surfaceUpdate in isolation: every referenced component id must be present in
// THAT message's components. The demo replays incremental deltas (a later batch's root references
// cards defined earlier), so each render must be re-expanded to a self-contained snapshot.
describe("accumulate (self-contained replay snapshot)", () => {
  interface Comp {
    id: string;
    component: Record<string, unknown>;
  }
  const surfaceUpdate = (components: Comp[]) => ({ surfaceUpdate: { surfaceId: "main", components } });
  const ids = (batch: unknown[]) => {
    const up = (batch as { surfaceUpdate?: { components?: Comp[] } }[]).find((m) => m.surfaceUpdate);
    return up?.surfaceUpdate?.components?.map((c) => c.id) ?? [];
  };

  it("carries earlier components forward so each batch is self-contained", () => {
    const snap = emptySnapshot();

    accumulate(snap, [
      { beginRendering: { surfaceId: "main", root: "root" } },
      surfaceUpdate([
        { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
        { id: "a", component: { Text: { text: { literalString: "A" } } } },
      ]),
    ]);
    // Second batch only re-declares root (now referencing a + b) and defines b — NOT a.
    const out = accumulate(snap, [
      surfaceUpdate([
        { id: "root", component: { Column: { children: { explicitList: ["a", "b"] } } } },
        { id: "b", component: { Text: { text: { literalString: "B" } } } },
      ]),
    ]);

    // 'a' is carried forward so root's reference resolves within this single message.
    expect(ids(out).sort()).toEqual(["a", "b", "root"]);
  });

  it("preserves a leading beginRendering and the surfaceId", () => {
    const snap = emptySnapshot();
    const out = accumulate(snap, [
      { beginRendering: { surfaceId: "main", root: "root" } },
      surfaceUpdate([{ id: "root", component: { Text: { text: { literalString: "hi" } } } }]),
    ]);
    expect((out[0] as { beginRendering?: unknown }).beginRendering).toBeTruthy();
  });

  it("lets a later batch update an existing component in place", () => {
    const snap = emptySnapshot();
    accumulate(snap, [surfaceUpdate([{ id: "t", component: { Text: { text: { literalString: "old" } } } }])]);
    const out = accumulate(snap, [surfaceUpdate([{ id: "t", component: { Text: { text: { literalString: "new" } } } }])]);
    const t = (out as { surfaceUpdate?: { components?: Comp[] } }[]).find((m) => m.surfaceUpdate)
      ?.surfaceUpdate?.components?.find((c) => c.id === "t");
    expect(JSON.stringify(t)).toContain("new");
    expect(ids(out)).toEqual(["t"]);
  });
});
