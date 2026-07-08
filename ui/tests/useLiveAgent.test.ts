import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import type { EventLogEntry } from "../src/agent/applyA2UIEvent";
import type { TranscriptTurn } from "../src/agent/transcript";

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

// Harness: the App root owns the shared event log (#128 lift); LiveDashboard owns the transcript
// (#195). Both setters are injected into the hook.
function useHarness() {
  const [log, setLog] = useState<EventLogEntry[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const agent = useLiveAgent(setLog, setTranscript);
  return { ...agent, log, setLog, transcript };
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

describe("useLiveAgent transcript capture (#195)", () => {
  beforeEach(() => runLiveAgentMock.mockClear());

  it("run seeds one turn with the prompt and the rendered snapshot", async () => {
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.run(SETTINGS, "tell a story"));

    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0]?.userText).toBe("tell a story");
    expect(result.current.transcript[0]?.snapshot?.root).toBe("t1");
    expect(result.current.transcript[0]?.snapshot?.components.map((c) => c.id)).toEqual(["t1"]);
  });

  it("sendAction appends a turn labelled with the clicked action, keeping prior turns", async () => {
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.run(SETTINGS, "tell a story"));
    await act(() => result.current.sendAction(SETTINGS, "enterForest"));

    expect(result.current.transcript).toHaveLength(2);
    expect(result.current.transcript[0]?.userText).toBe("tell a story"); // retained
    expect(result.current.transcript[1]?.userText).toBe('Clicked "enterForest"');
    expect(result.current.transcript[1]?.snapshot?.root).toBe("t1");
  });

  it("sendMessage sends a free-text follow-up with full history and adds a transcript turn", async () => {
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.run(SETTINGS, "tell a story"));
    await act(() => result.current.sendMessage(SETTINGS, "and then?"));

    // History stays intact (turn memory): [user prompt, assistant summary, user follow-up].
    const secondCallMessages = runLiveAgentMock.mock.calls[1]?.[1] as {
      role: string;
      content: string;
    }[];
    expect(secondCallMessages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(secondCallMessages[2]?.content).toBe("and then?");
    expect(result.current.transcript).toHaveLength(2);
    expect(result.current.transcript[1]?.userText).toBe("and then?");
  });

  it("sendMessage is a no-op before the first run", async () => {
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.sendMessage(SETTINGS, "hello?"));

    expect(runLiveAgentMock).not.toHaveBeenCalled();
    expect(result.current.transcript).toHaveLength(0);
  });

  it("a fresh run resets the transcript to the new turn", async () => {
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.run(SETTINGS, "story one"));
    await act(() => result.current.sendAction(SETTINGS, "enterForest"));
    expect(result.current.transcript).toHaveLength(2);

    await act(() => result.current.run(SETTINGS, "story two"));

    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0]?.userText).toBe("story two");
  });

  it("a failed turn keeps its user row (snapshot null) and surfaces the error", async () => {
    runLiveAgentMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useHarness());

    await act(() => result.current.run(SETTINGS, "tell a story"));

    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0]?.userText).toBe("tell a story");
    expect(result.current.transcript[0]?.snapshot).toBeNull();
    expect(result.current.error).toMatch(/boom/);
  });
});
