import { describe, it, expect, vi } from "vitest";
import { applyA2UIEvent, appendLogEntry } from "../src/agent/applyA2UIEvent";

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
