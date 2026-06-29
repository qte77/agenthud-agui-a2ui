import {
  fullRecording,
  segments,
  decisionTree,
  getSegmentEvents,
  type Recording,
} from "../src/recordings";

describe("recording registry", () => {
  it("exports fullRecording with meta and events", () => {
    expect(fullRecording.meta).toBeDefined();
    expect(fullRecording.meta.title).toBeTypeOf("string");
    expect(fullRecording.meta.description).toBeTypeOf("string");
    expect(fullRecording.events).toBeInstanceOf(Array);
    expect(fullRecording.events.length).toBeGreaterThan(0);
  });

  it("extracts 8 segments with distinct IDs", () => {
    expect(segments).toHaveLength(8);
    const ids = segments.map((s) => s.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("each segment has a label and componentHint", () => {
    for (const seg of segments) {
      expect(seg.label).toBeTypeOf("string");
      expect(seg.label.length).toBeGreaterThan(0);
      expect(seg.componentHint).toBeTypeOf("string");
    }
  });

  it("decisionTree has a root node with 3 choices", () => {
    expect(decisionTree).toHaveProperty("root");
    // root is asserted to exist by the preceding expect (fixture-guaranteed)
    expect(decisionTree.root!.prompt).toBeTypeOf("string");
    expect(decisionTree.root!.choices).toHaveLength(3);
  });

  it("all tree choice segments exist in segments list", () => {
    const segmentIds = new Set(segments.map((s) => s.id));

    for (const [, node] of Object.entries(decisionTree)) {
      for (const choice of node.choices) {
        expect(segmentIds.has(choice.segment)).toBe(true);
      }
    }
  });

  it("getSegmentEvents returns all events when segmentId is null", () => {
    const result = getSegmentEvents(fullRecording, null);
    expect(result).toBe(fullRecording.events);
  });

  it("getSegmentEvents filters to only target segment events plus RUN lifecycle", () => {
    const result = getSegmentEvents(fullRecording, "overview");

    const types = new Set(result.map((e) => e.type));
    // Must include RUN lifecycle events
    expect(types.has("RUN_STARTED")).toBe(true);
    expect(types.has("RUN_FINISHED")).toBe(true);

    // Should not include events from other segments
    const foreignSegments = result.filter(
      (e) => e.type === "STEP_STARTED" && e.segment && e.segment !== "overview"
    );
    expect(foreignSegments).toHaveLength(0);

    // Should have fewer events than the full recording
    expect(result.length).toBeLessThan(fullRecording.events.length);
  });

  it("getSegmentEvents injects beginRendering when missing", () => {
    const result = getSegmentEvents(fullRecording, "detail");

    const hasBegin = result.some((e) =>
      (e.a2uiMessages as Record<string, unknown>[] | undefined)?.some(
        (m) => m.beginRendering
      )
    );
    expect(hasBegin).toBe(true);
  });

  it("keeps a segment's cumulative root across additive surfaceUpdates", () => {
    // Additive segment: event 1 adds card "a"; event 2 adds card "b" and grows the root to
    // [a, b], relying on the @a2ui processor keeping "a" from event 1. The per-event root patch
    // must NOT strip "a" from event 2's root just because that batch doesn't re-send it.
    const additive: Recording = {
      meta: { title: "t", description: "d" },
      events: [
        { delayMs: 0, type: "RUN_STARTED" },
        { delayMs: 0, type: "STEP_STARTED", segment: "seg" },
        {
          delayMs: 0,
          type: "TOOL_CALL_START",
          a2uiMessages: [
            { beginRendering: { surfaceId: "main", root: "root" } },
            {
              surfaceUpdate: {
                surfaceId: "main",
                components: [
                  { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
                  { id: "a", component: { Text: { text: { literal: "A" } } } },
                ],
              },
            },
          ],
        },
        {
          delayMs: 0,
          type: "TOOL_CALL_START",
          a2uiMessages: [
            {
              surfaceUpdate: {
                surfaceId: "main",
                components: [
                  { id: "root", component: { Column: { children: { explicitList: ["a", "b"] } } } },
                  { id: "b", component: { Text: { text: { literal: "B" } } } },
                ],
              },
            },
          ],
        },
        { delayMs: 0, type: "STEP_FINISHED" },
        { delayMs: 0, type: "RUN_FINISHED" },
      ],
    };

    const result = getSegmentEvents(additive, "seg", { append: false });

    const rootLists = result
      .flatMap((e) => (e.a2uiMessages ?? []) as Record<string, unknown>[])
      .map(
        (m) =>
          m.surfaceUpdate as
            | {
                components?: {
                  id: string;
                  component: Record<string, { children?: { explicitList?: string[] } }>;
                }[];
              }
            | undefined
      )
      .map((u) => u?.components?.find((c) => c.id === "root"))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        // component is a non-empty single-type map (contract-guaranteed)
        const type = Object.keys(r.component)[0]!;
        return r.component[type]!.children?.explicitList ?? [];
      });

    // The final root must still reference both cards (cumulative), not just the last batch's.
    expect(rootLists.at(-1)).toEqual(["a", "b"]);
  });

  it("every event has delayMs and type fields", () => {
    for (const event of fullRecording.events) {
      expect(event).toHaveProperty("delayMs");
      expect(event).toHaveProperty("type");
      expect(event.delayMs).toBeTypeOf("number");
      expect(event.type).toBeTypeOf("string");
    }
  });

  it("self-hosts the avatar (no external image URLs in the recording)", () => {
    const serialized = JSON.stringify(fullRecording);
    // The GitHub-hosted source URL must be swapped for the bundled local asset,
    // so the demo makes zero external requests.
    expect(serialized).not.toContain("https://github.com/qte77.png");
    expect(serialized).toContain("qte77-avatar");
  });
});
