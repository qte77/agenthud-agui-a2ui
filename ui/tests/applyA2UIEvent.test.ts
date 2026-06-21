import { describe, it, expect, vi } from "vitest";
import { applyA2UIEvent } from "../src/agent/applyA2UIEvent";

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

  it("passes non-A2UI lifecycle events through untouched", () => {
    const render = vi.fn();
    const entry = applyA2UIEvent({ type: "RUN_STARTED" }, 5, render);

    expect(render).not.toHaveBeenCalled();
    expect(entry).toEqual({ type: "RUN_STARTED", timestamp: 5, text: undefined });
  });
});
