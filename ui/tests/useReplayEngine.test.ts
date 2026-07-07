import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useReplayEngine } from "../src/useReplayEngine";
import type { Recording } from "../src/recordings";
import type { EventLogEntry } from "../src/agent/applyA2UIEvent";

const mockProcessMessages = vi.fn();
const mockClearSurfaces = vi.fn();

vi.mock("@a2ui/react", () => ({
  useA2UIActions: () => ({
    processMessages: mockProcessMessages,
    clearSurfaces: mockClearSurfaces,
  }),
}));

const testRecording: Recording = {
  meta: { title: "Test", description: "Test recording" },
  events: [
    { delayMs: 0, type: "RUN_STARTED" },
    { delayMs: 100, type: "TEXT_MESSAGE_CONTENT", text: "hello" },
    {
      delayMs: 100,
      type: "TOOL_CALL_START",
      // A valid non-empty batch — @a2ui rejects empty components, and accumulate() now omits
      // a surfaceUpdate until components exist.
      a2uiMessages: [
        {
          surfaceUpdate: {
            surfaceId: "main",
            components: [{ id: "t1", component: { Text: { text: { literalString: "hi" } } } }],
          },
        },
      ],
    },
    { delayMs: 0, type: "RUN_FINISHED" },
  ],
};

// Harness: the App root owns the shared event log (useState) and injects the setter, mirroring
// the #128 lift. Tests read the shared log via `result.current.log`.
function useHarness(recording: Recording, onComplete?: () => void) {
  const [log, setLog] = useState<EventLogEntry[]>([]);
  const engine = useReplayEngine(recording, setLog, onComplete);
  return { ...engine, log, setLog };
}

/** Drain all pending timers so every recursive setTimeout resolves. */
function flushAllTimers() {
  act(() => {
    vi.runAllTimers();
  });
}

describe("useReplayEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockProcessMessages.mockClear();
    mockClearSurfaces.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state: not playing, empty event log", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.log).toEqual([]);
  });

  it("play starts playback and sets isPlaying true", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(mockClearSurfaces).toHaveBeenCalledOnce();
  });

  it("events fire with correct delays", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    // First event has delayMs: 0 — fires on next timer flush
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.log).toHaveLength(1);
    // fixture-guaranteed indices: non-null assertions are safe in test context
    expect(result.current.log[0]!.type).toBe("RUN_STARTED");

    // Second event has delayMs: 100
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.log).toHaveLength(2);
    expect(result.current.log[1]!.type).toBe("TEXT_MESSAGE_CONTENT");

    // Third event has delayMs: 100
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.log).toHaveLength(3);
    expect(result.current.log[2]!.type).toBe("TOOL_CALL_START");

    // Fourth event has delayMs: 0 — flush remaining recursive timers
    flushAllTimers();
    expect(result.current.log).toHaveLength(4);
    expect(result.current.log[3]!.type).toBe("RUN_FINISHED");
  });

  it("calls processMessages for events with a2uiMessages", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    // Advance through all events including the TOOL_CALL_START at t=200
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockProcessMessages).toHaveBeenCalledOnce();
    expect(mockProcessMessages).toHaveBeenCalledWith(
      testRecording.events[2]!.a2uiMessages
    );
  });

  it("eventLog accumulates entries with timestamps", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    flushAllTimers();

    expect(result.current.log).toHaveLength(4);
    for (const entry of result.current.log) {
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("timestamp");
      expect(typeof entry.timestamp).toBe("number");
    }

    // Second entry should have text
    expect(result.current.log[1]!.text).toBe("hello");
  });

  it("isPlaying becomes false after all events played", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    flushAllTimers();

    expect(result.current.isPlaying).toBe(false);
  });

  it("onComplete fires after playback finishes", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useHarness(testRecording, onComplete));

    act(() => {
      result.current.play();
    });

    flushAllTimers();

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("play with append skips clearSurfaces", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play({ append: true });
    });

    expect(mockClearSurfaces).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it("restart stops playback and clears state", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    // Fire first event
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.log).toHaveLength(1);

    act(() => {
      result.current.restart();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.log).toEqual([]);
    expect(mockClearSurfaces).toHaveBeenCalled();
  });

  it("play while already playing is a no-op", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });

    mockClearSurfaces.mockClear();

    // Try to play again while already playing
    act(() => {
      result.current.play();
    });

    // clearSurfaces should not be called again
    expect(mockClearSurfaces).not.toHaveBeenCalled();
  });

  // #128: with the log lifted to the shared root, a fresh (non-append) play must wipe whatever
  // the other source left in the log — a fresh replay is a fresh story, not an append.
  it("fresh play wipes pre-existing entries in the shared log", () => {
    const { result } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.setLog([{ type: "SEED_FROM_OTHER_SOURCE", timestamp: 0 }]);
    });
    expect(result.current.log).toHaveLength(1);

    act(() => {
      result.current.play();
    });
    flushAllTimers();

    expect(result.current.log.some((e) => e.type === "SEED_FROM_OTHER_SOURCE")).toBe(false);
    expect(result.current.log).toHaveLength(4);
  });

  // #128: the setter lives in the always-mounted root, so a replay timer that outlives this
  // dashboard's unmount would be a zombie writer into the shared log/surface. Unmount must cancel it.
  it("unmount mid-play stops scheduled events", () => {
    const { result, unmount } = renderHook(() => useHarness(testRecording));

    act(() => {
      result.current.play();
    });
    // Fire RUN_STARTED (t=0) + TEXT (t=100); the a2uiMessages event is scheduled for t=200.
    act(() => {
      vi.advanceTimersByTime(100);
    });

    unmount();
    act(() => {
      vi.runAllTimers();
    });

    // The scheduled TOOL_CALL_START (only event with a2uiMessages) never rendered.
    expect(mockProcessMessages).not.toHaveBeenCalled();
  });
});
