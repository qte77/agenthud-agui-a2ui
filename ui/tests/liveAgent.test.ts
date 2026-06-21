import { describe, it, expect } from "vitest";
import { streamPartToEvent } from "../src/agent/liveAgent";

// streamPartToEvent is the pure seam between the Vercel AI SDK fullStream and the
// AG-UI event vocabulary the EventStream + applyA2UIEvent already consume. Tested
// with synthetic parts so it needs no live model.
describe("streamPartToEvent (AI SDK fullStream → AG-UI event)", () => {
  it("maps text-delta to TEXT_MESSAGE_CONTENT", () => {
    expect(streamPartToEvent({ type: "text-delta", text: "hi" })).toEqual({
      type: "TEXT_MESSAGE_CONTENT",
      text: "hi",
    });
  });

  it("maps run lifecycle parts", () => {
    expect(streamPartToEvent({ type: "start" })?.type).toBe("RUN_STARTED");
    expect(streamPartToEvent({ type: "finish" })?.type).toBe("RUN_FINISHED");
  });

  it("maps tool-input-start to TOOL_CALL_START with the tool name", () => {
    expect(
      streamPartToEvent({ type: "tool-input-start", toolName: "render_ui" })
    ).toEqual({ type: "TOOL_CALL_START", text: "render_ui" });
  });

  it("maps a render_ui tool-call to a render event carrying the A2UI batch", () => {
    const messages = [{ surfaceUpdate: { surfaceId: "main", components: [] } }];
    expect(
      streamPartToEvent({ type: "tool-call", toolName: "render_ui", input: { messages } })
    ).toEqual({ type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: messages });
  });

  it("maps a non-render tool-call without an A2UI payload", () => {
    expect(
      streamPartToEvent({ type: "tool-call", toolName: "other", input: {} })
    ).toEqual({ type: "TOOL_CALL_END", text: "other" });
  });

  it("maps an error part to RUN_ERROR", () => {
    expect(streamPartToEvent({ type: "error", error: "boom" })).toEqual({
      type: "RUN_ERROR",
      text: "boom",
    });
  });

  it("skips parts we don't surface", () => {
    expect(streamPartToEvent({ type: "text-start" })).toBeNull();
    expect(streamPartToEvent({ type: "finish-step" })).toBeNull();
    expect(streamPartToEvent({ type: "tool-input-delta" })).toBeNull();
    expect(streamPartToEvent({ type: "whatever" })).toBeNull();
  });
});
