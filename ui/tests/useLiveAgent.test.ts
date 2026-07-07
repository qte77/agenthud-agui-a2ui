import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import type { EventLogEntry } from "../src/agent/applyA2UIEvent";

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

// Harness: the App root owns the shared event log and injects the setter (#128 lift).
function useHarness() {
  const [log, setLog] = useState<EventLogEntry[]>([]);
  const agent = useLiveAgent(setLog);
  return { ...agent, log, setLog };
}

describe("useLiveAgent turn memory", () => {
  beforeEach(() => runLiveAgentMock.mockClear());

  it("a follow-up action's history includes the previous turn's render summary", async () => {
    const { result } = renderHook(() => useHarness());

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

describe("useLiveAgent shared-log contract (#128)", () => {
  beforeEach(() => runLiveAgentMock.mockClear());

  it("a fresh run wipes pre-existing entries in the shared log", async () => {
    const { result } = renderHook(() => useHarness());

    act(() => {
      result.current.setLog([{ type: "SEED_FROM_DEMO", timestamp: 0 }]);
    });

    await act(() => result.current.run(SETTINGS, "hi"));

    expect(result.current.log.some((e) => e.type === "SEED_FROM_DEMO")).toBe(false);
    expect(result.current.log.length).toBeGreaterThan(0);
  });

  it("aborts the in-flight stream on unmount", () => {
    let captured: AbortSignal | undefined;
    runLiveAgentMock.mockImplementationOnce(
      (
        _settings: unknown,
        _messages: unknown[],
        _onEvent: unknown,
        opts?: { signal?: AbortSignal }
      ): Promise<void> => {
        captured = opts?.signal;
        return new Promise<void>(() => {
          /* never resolves — simulates an in-flight stream */
        });
      }
    );

    const { result, unmount } = renderHook(() => useHarness());

    // run()'s synchronous prefix wires up the AbortController before its first await; unmount then
    // fires the cleanup that aborts it. No await: the mocked stream never resolves.
    act(() => {
      void result.current.run(SETTINGS, "hi");
    });
    unmount();

    expect(captured?.aborted).toBe(true);
  });
});
