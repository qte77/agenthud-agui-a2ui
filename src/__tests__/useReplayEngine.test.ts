import { renderHook, act } from "@testing-library/react";
import { useReplayEngine } from "../useReplayEngine";
import type { Recording } from "../recordings";

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
      a2uiMessages: [
        { surfaceUpdate: { surfaceId: "main", components: [] } },
      ],
    },
    { delayMs: 0, type: "RUN_FINISHED" },
  ],
};

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
    const { result } = renderHook(() => useReplayEngine(testRecording));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.eventLog).toEqual([]);
  });

  it("play starts playback and sets isPlaying true", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(mockClearSurfaces).toHaveBeenCalledOnce();
  });

  it("events fire with correct delays", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });

    // First event has delayMs: 0 — fires on next timer flush
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.eventLog).toHaveLength(1);
    expect(result.current.eventLog[0].type).toBe("RUN_STARTED");

    // Second event has delayMs: 100
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.eventLog).toHaveLength(2);
    expect(result.current.eventLog[1].type).toBe("TEXT_MESSAGE_CONTENT");

    // Third event has delayMs: 100
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.eventLog).toHaveLength(3);
    expect(result.current.eventLog[2].type).toBe("TOOL_CALL_START");

    // Fourth event has delayMs: 0 — flush remaining recursive timers
    flushAllTimers();
    expect(result.current.eventLog).toHaveLength(4);
    expect(result.current.eventLog[3].type).toBe("RUN_FINISHED");
  });

  it("calls processMessages for events with a2uiMessages", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });

    // Advance through all events including the TOOL_CALL_START at t=200
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockProcessMessages).toHaveBeenCalledOnce();
    expect(mockProcessMessages).toHaveBeenCalledWith(
      testRecording.events[2].a2uiMessages
    );
  });

  it("eventLog accumulates entries with timestamps", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });

    flushAllTimers();

    expect(result.current.eventLog).toHaveLength(4);
    for (const entry of result.current.eventLog) {
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("timestamp");
      expect(typeof entry.timestamp).toBe("number");
    }

    // Second entry should have text
    expect(result.current.eventLog[1].text).toBe("hello");
  });

  it("isPlaying becomes false after all events played", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    flushAllTimers();

    expect(result.current.isPlaying).toBe(false);
  });

  it("onComplete fires after playback finishes", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useReplayEngine(testRecording, onComplete)
    );

    act(() => {
      result.current.play();
    });

    flushAllTimers();

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("play with append skips clearSurfaces", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play({ append: true });
    });

    expect(mockClearSurfaces).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it("restart stops playback and clears state", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

    act(() => {
      result.current.play();
    });

    // Fire first event
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.eventLog).toHaveLength(1);

    act(() => {
      result.current.restart();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.eventLog).toEqual([]);
    expect(mockClearSurfaces).toHaveBeenCalled();
  });

  it("play while already playing is a no-op", () => {
    const { result } = renderHook(() => useReplayEngine(testRecording));

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
});
