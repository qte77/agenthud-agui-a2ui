import { describe, it, expect } from "vitest";
import {
  batchesToRecording,
  liveEventsToRecording,
  type CapturedEvent,
} from "../src/agent/recording";

const meta = { title: "My session", description: "captured live" };

// A minimal batch that satisfies A2UIMessageBatchSchema (begin + one surfaceUpdate).
const validBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [{ id: "root", component: { Text: { text: { literalString: "hi" } } } }],
    },
  },
];

// Same components split across two surfaceUpdate messages for one surface — @a2ui rejects the
// split; the serializer must coalesce it (see coalesceSurfaceUpdates).
const splitBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [{ id: "root", component: { Column: { children: { explicitList: ["a"] } } } }],
    },
  },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [{ id: "a", component: { Text: { text: { literalString: "hi" } } } }],
    },
  },
];

describe("batchesToRecording", () => {
  it("maps each batch to an event carrying its validated a2uiMessages", () => {
    const rec = batchesToRecording([validBatch], meta);

    expect(rec.meta).toEqual(meta);
    expect(rec.events).toHaveLength(1);
    expect(rec.events[0]!.a2uiMessages).toBeDefined();
  });

  it("applies the supplied per-index delays", () => {
    const rec = batchesToRecording([validBatch, validBatch], meta, [100, 250]);

    expect(rec.events[0]!.delayMs).toBe(100);
    expect(rec.events[1]!.delayMs).toBe(250);
  });

  it("coalesces split surfaceUpdates within a batch", () => {
    const rec = batchesToRecording([splitBatch], meta);

    const updates = (rec.events[0]!.a2uiMessages as { surfaceUpdate?: unknown }[]).filter(
      (m) => m.surfaceUpdate
    );
    expect(updates).toHaveLength(1);
  });

  it("returns an empty recording for no batches", () => {
    const rec = batchesToRecording([], meta);

    expect(rec.events).toEqual([]);
    expect(rec.meta).toEqual(meta);
  });
});

describe("liveEventsToRecording", () => {
  const events: CapturedEvent[] = [
    { type: "RUN_STARTED", timestamp: 0 },
    { type: "FALLBACK", text: "model-a failed — trying model-b", timestamp: 200 },
    { type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: validBatch, timestamp: 500 },
    { type: "RUN_FINISHED", timestamp: 800 },
  ];

  it("excludes internal FALLBACK events", () => {
    const rec = liveEventsToRecording(events, meta);

    expect(rec.events.some((e) => e.type === "FALLBACK")).toBe(false);
  });

  it("keeps an event but drops a batch that fails the contract", () => {
    const rec = liveEventsToRecording(
      [{ type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: [{ bogus: true }], timestamp: 10 }],
      meta
    );

    expect(rec.events).toHaveLength(1);
    expect(rec.events[0]!.type).toBe("TOOL_CALL_END");
    expect(rec.events[0]!.a2uiMessages).toBeUndefined();
  });

  it("derives delayMs from the gap between consecutive kept events", () => {
    const rec = liveEventsToRecording(events, meta);

    // kept: RUN_STARTED@0, TOOL_CALL_END@500, RUN_FINISHED@800 → gaps 0, 500, 300
    expect(rec.events.map((e) => e.delayMs)).toEqual([0, 500, 300]);
  });

  it("preserves the event type and text", () => {
    const rec = liveEventsToRecording(events, meta);

    const render = rec.events.find((e) => e.type === "TOOL_CALL_END");
    expect(render!.text).toBe("render_ui");
  });
});
