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

  it("omits the surfaceUpdate while no components have accumulated (begin-only init)", () => {
    // A segment's injected "(surface init)" event carries only beginRendering. Emitting an empty
    // surfaceUpdate for it fails @a2ui's `components: min(1)` and logs a render error.
    const snap = emptySnapshot();

    const out = accumulate(snap, [{ beginRendering: { surfaceId: "main", root: "root" } }]);

    expect(out).toHaveLength(1);
    expect((out[0] as { beginRendering?: unknown }).beginRendering).toBeDefined();
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

// #206: data-bound controls (CheckBox/Slider `value:{path}`) render at defaults in a frozen turn (and in
// demo replay) because accumulate() dropped dataModelUpdate. Fold the seed into snapshot.data AND pass the
// current batch's dataModelUpdate through so the rendered surface (demo path) actually seeds its values.
describe("accumulate (data model — #206)", () => {
  const dmu = (contents: unknown[], path?: string) => ({
    dataModelUpdate: { surfaceId: "main", ...(path === undefined ? {} : { path }), contents },
  });
  const data = (snap: { data?: unknown }) => snap.data;

  it("folds a dataModelUpdate into snapshot.data as a nested plain object (typed values)", () => {
    const snap = emptySnapshot();
    accumulate(snap, [
      dmu([
        {
          key: "filters",
          valueMap: [
            { key: "active", valueBoolean: true },
            { key: "minStars", valueNumber: 5 },
            { key: "query", valueString: "react" },
          ],
        },
      ]),
    ]);
    expect(data(snap)).toEqual({ filters: { active: true, minStars: 5, query: "react" } });
  });

  it("honors an optional path prefix; absent path applies contents at the root", () => {
    const withPath = emptySnapshot();
    accumulate(withPath, [dmu([{ key: "agree", valueBoolean: true }], "/form")]);
    expect(data(withPath)).toEqual({ form: { agree: true } });

    const noPath = emptySnapshot();
    accumulate(noPath, [dmu([{ key: "agree", valueBoolean: false }])]);
    expect(data(noPath)).toEqual({ agree: false }); // valueBoolean:false must survive (not treated as unset)
  });

  it("merges a later dataModelUpdate over existing data, keeping siblings", () => {
    const snap = emptySnapshot();
    accumulate(snap, [dmu([{ key: "a", valueNumber: 1 }, { key: "b", valueNumber: 2 }])]);
    accumulate(snap, [dmu([{ key: "b", valueNumber: 9 }])]);
    expect(data(snap)).toEqual({ a: 1, b: 9 });
  });

  it("passes the current batch's dataModelUpdate through, appended after the surfaceUpdate", () => {
    const snap = emptySnapshot();
    const out = accumulate(snap, [
      { beginRendering: { surfaceId: "main", root: "root" } },
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "root", component: { CheckBox: { value: { path: "/agree" } } } }] } },
      dmu([{ key: "agree", valueBoolean: true }]),
    ]);
    const types = (out as Record<string, unknown>[]).map((m) => Object.keys(m)[0]);
    expect(types).toEqual(["beginRendering", "surfaceUpdate", "dataModelUpdate"]);
  });

  it("does not re-emit a prior batch's dataModelUpdate", () => {
    const snap = emptySnapshot();
    accumulate(snap, [dmu([{ key: "agree", valueBoolean: true }])]);
    const out = accumulate(snap, [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "root", component: { Text: { text: { literalString: "x" } } } }] } },
    ]);
    expect((out as Record<string, unknown>[]).some((m) => "dataModelUpdate" in m)).toBe(false);
  });
});
