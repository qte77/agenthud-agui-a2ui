import {
  fullRecording,
  segments,
  decisionTree,
  getSegmentEvents,
} from "../recordings";

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
    expect(decisionTree.root.prompt).toBeTypeOf("string");
    expect(decisionTree.root.choices).toHaveLength(3);
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
      (e.a2uiMessages as Array<Record<string, unknown>> | undefined)?.some(
        (m) => m.beginRendering
      )
    );
    expect(hasBegin).toBe(true);
  });

  it("every event has delayMs and type fields", () => {
    for (const event of fullRecording.events) {
      expect(event).toHaveProperty("delayMs");
      expect(event).toHaveProperty("type");
      expect(event.delayMs).toBeTypeOf("number");
      expect(event.type).toBeTypeOf("string");
    }
  });
});
