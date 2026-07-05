import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock ONLY the network seam: a fake agent that "renders" one Text component per call.
// vi.hoisted: the vi.mock factory below is hoisted above this file's const declarations.
const { runLiveAgentMock } = vi.hoisted(() => ({
  runLiveAgentMock: vi.fn(
    (
      _settings: unknown,
      _messages: unknown[],
      onEvent: (e: { type: string; a2uiMessages?: unknown[] }) => void
    ): Promise<void> => {
      // Defensive: act() re-entry can invoke the mock without args mid-flush.
      if (typeof onEvent !== "function") return Promise.resolve();
      onEvent({
        type: "TOOL_CALL_END",
        a2uiMessages: [
          { beginRendering: { surfaceId: "main", root: "t1" } },
          {
            surfaceUpdate: {
              surfaceId: "main",
              components: [
                { id: "t1", component: { Text: { text: { literalString: "Once upon a time" } } } },
              ],
            },
          },
        ],
      });
      return Promise.resolve();
    }
  ),
}));

vi.mock("../src/agent/liveAgent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/agent/liveAgent")>();
  return { ...actual, runLiveAgent: runLiveAgentMock };
});

vi.mock("@a2ui/react", () => ({
  useA2UIActions: () => ({ processMessages: vi.fn(), clearSurfaces: vi.fn() }),
}));

import { useLiveAgent } from "../src/agent/useLiveAgent";

const SETTINGS = { baseURL: "https://x", apiKey: "k", model: "m" };

describe("useLiveAgent turn memory", () => {
  beforeEach(() => runLiveAgentMock.mockClear());

  it("a follow-up action's history includes the previous turn's render summary", async () => {
    const { result } = renderHook(() => useLiveAgent());

    await act(() => result.current.run(SETTINGS, "tell a story"));
    await act(() => result.current.sendAction(SETTINGS, "enterForest"));

    // Second call's messages: [user prompt, assistant render-summary, user action]
    const secondCallMessages = runLiveAgentMock.mock.calls[1]?.[1] as {
      role: string;
      content: string;
    }[];
    expect(secondCallMessages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(secondCallMessages[1]?.content).toContain("Once upon a time");
    expect(secondCallMessages[2]?.content).toContain("enterForest");
  });
});
