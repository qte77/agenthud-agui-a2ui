import { describe, it, expect, vi } from "vitest";
import {
  applyA2UIEvent,
  appendLogEntry,
  coalesceSurfaceUpdates,
} from "../src/agent/applyA2UIEvent";

// A surfaceUpdate carries "a list containing ALL UI components for the surface": @a2ui v0.8's
// SurfaceUpdateMessageSchema resolves child references against that ONE message's components, so a
// model that splits its components across several surfaceUpdate messages renders nothing
// ("Component 'root' references non-existent component ID 'x'") even though the batch is complete.
// Observed live with gpt-4o-mini on tabbed UIs (3 of 4 runs). Coalescing per surface fixes it.
describe("coalesceSurfaceUpdates", () => {
  const split = [
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

  it("merges components split across surfaceUpdate messages for the same surface", () => {
    const out = coalesceSurfaceUpdates(split) as { surfaceUpdate?: { components: unknown[] } }[];

    const updates = out.filter((m) => m.surfaceUpdate);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.surfaceUpdate!.components).toHaveLength(2);
  });

  it("keeps the merged update at the first update's position (after beginRendering)", () => {
    const out = coalesceSurfaceUpdates(split) as Record<string, unknown>[];

    expect(Object.keys(out[0]!)[0]).toBe("beginRendering");
    expect(Object.keys(out[1]!)[0]).toBe("surfaceUpdate");
  });

  it("keeps different surfaces separate", () => {
    const out = coalesceSurfaceUpdates([
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "a", component: {} }] } },
      { surfaceUpdate: { surfaceId: "other", components: [{ id: "b", component: {} }] } },
    ]) as { surfaceUpdate?: { surfaceId: string } }[];

    expect(out.filter((m) => m.surfaceUpdate)).toHaveLength(2);
  });

  it("de-duplicates a re-declared id (last definition wins) so @a2ui sees no duplicate", () => {
    const out = coalesceSurfaceUpdates([
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [{ id: "a", component: { Text: { text: { literalString: "old" } } } }],
        },
      },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [{ id: "a", component: { Text: { text: { literalString: "new" } } } }],
        },
      },
    ]) as { surfaceUpdate?: { components: unknown[] } }[];

    const components = out[0]!.surfaceUpdate!.components;
    expect(components).toHaveLength(1);
    expect(JSON.stringify(components)).toContain("new");
  });

  it("passes a single-update batch through unchanged", () => {
    const single = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "root", component: {} }] } },
      { dataModelUpdate: { surfaceId: "main", path: "/form", contents: {} } },
    ];

    expect(coalesceSurfaceUpdates(single)).toEqual(single);
  });

  it("leaves non-A2UI shapes alone", () => {
    expect(coalesceSurfaceUpdates([{ bogus: true }])).toEqual([{ bogus: true }]);
  });
});

describe("applyA2UIEvent", () => {
  it("renders a valid batch and logs the component summary", () => {
    const render = vi.fn();
    const event = {
      type: "TOOL_CALL_START",
      text: "renderRepoCard(x)",
      a2uiMessages: [
        {
          surfaceUpdate: {
            surfaceId: "main",
            components: [
              { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
              { id: "a", component: { Text: { text: { literal: "hi" } } } },
            ],
          },
        },
      ],
    };

    const entry = applyA2UIEvent(event, 12, render);

    expect(render).toHaveBeenCalledOnce();
    expect(entry.a2uiComponentCount).toBe(2);
    expect(entry.a2uiComponentTypes).toContain("Column");
    expect(entry.timestamp).toBe(12);
  });

  it("skips rendering when the batch violates the contract", () => {
    const render = vi.fn();
    const entry = applyA2UIEvent(
      { type: "TOOL_CALL_START", a2uiMessages: [{ bogus: true }] },
      0,
      render
    );

    expect(render).not.toHaveBeenCalled();
    expect(entry.a2uiComponentCount).toBeUndefined();
  });

  it("surfaces a contract violation in the log entry instead of skipping silently", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const render = vi.fn();

    const entry = applyA2UIEvent(
      { type: "TOOL_CALL_END", a2uiMessages: [{ bogus: true }] },
      0,
      render
    );

    expect(render).not.toHaveBeenCalled();
    expect(entry.text).toContain("A2UI contract violation");
    spy.mockRestore();
  });

  it("renders a split batch as one surface update and counts each component once", () => {
    const render = vi.fn();

    const entry = applyA2UIEvent(
      {
        type: "TOOL_CALL_END",
        a2uiMessages: [
          { beginRendering: { surfaceId: "main", root: "root" } },
          {
            surfaceUpdate: {
              surfaceId: "main",
              components: [
                { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
              ],
            },
          },
          {
            surfaceUpdate: {
              surfaceId: "main",
              components: [{ id: "a", component: { Text: { text: { literalString: "hi" } } } }],
            },
          },
        ],
      },
      0,
      render
    );

    const rendered = render.mock.calls[0]![0] as { surfaceUpdate?: unknown }[];
    expect(rendered.filter((m) => m.surfaceUpdate)).toHaveLength(1);
    expect(entry.a2uiComponentCount).toBe(2);
  });

  it("passes non-A2UI lifecycle events through untouched", () => {
    const render = vi.fn();
    const entry = applyA2UIEvent({ type: "RUN_STARTED" }, 5, render);

    expect(render).not.toHaveBeenCalled();
    expect(entry).toEqual({ type: "RUN_STARTED", timestamp: 5, text: undefined });
  });

  it("surfaces a render error in the log entry instead of swallowing it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const render = vi.fn(() => {
      throw new Error("Card child required");
    });

    const entry = applyA2UIEvent(
      {
        type: "TOOL_CALL_START",
        a2uiMessages: [{ beginRendering: { surfaceId: "main", root: "root" } }],
      },
      0,
      render
    );

    expect(render).toHaveBeenCalledOnce();
    expect(entry.text).toContain("A2UI render error");
    expect(entry.text).toContain("Card child required");
    spy.mockRestore();
  });
});

describe("appendLogEntry (coalescing text deltas)", () => {
  it("merges consecutive TEXT_MESSAGE_CONTENT into one entry", () => {
    const log = [{ type: "TEXT_MESSAGE_CONTENT", timestamp: 1, text: "Hel" }];

    const next = appendLogEntry(log, { type: "TEXT_MESSAGE_CONTENT", timestamp: 2, text: "lo" });

    expect(next).toHaveLength(1);
    expect(next[0]?.text).toBe("Hello");
    expect(next[0]?.timestamp).toBe(1); // keep the first delta's timestamp
  });

  it("does not merge when a different event type separates two text entries", () => {
    const log = [
      { type: "TEXT_MESSAGE_CONTENT", timestamp: 1, text: "a" },
      { type: "TOOL_CALL_START", timestamp: 2, text: "render_ui" },
    ];

    const next = appendLogEntry(log, { type: "TEXT_MESSAGE_CONTENT", timestamp: 3, text: "b" });

    expect(next).toHaveLength(3);
  });

  it("appends a non-text entry unchanged", () => {
    const log = [{ type: "TEXT_MESSAGE_CONTENT", timestamp: 1, text: "a" }];

    const next = appendLogEntry(log, { type: "RUN_FINISHED", timestamp: 2 });

    expect(next).toHaveLength(2);
    expect(next[1]?.type).toBe("RUN_FINISHED");
  });

  it("appends to an empty log", () => {
    const next = appendLogEntry([], { type: "TEXT_MESSAGE_CONTENT", timestamp: 0, text: "a" });
    expect(next).toEqual([{ type: "TEXT_MESSAGE_CONTENT", timestamp: 0, text: "a" }]);
  });

  it("does not mutate the original log or its entries", () => {
    const log = [{ type: "TEXT_MESSAGE_CONTENT", timestamp: 1, text: "a" }];

    appendLogEntry(log, { type: "TEXT_MESSAGE_CONTENT", timestamp: 2, text: "b" });

    expect(log).toHaveLength(1);
    expect(log[0]?.text).toBe("a");
  });
});
