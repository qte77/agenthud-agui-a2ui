import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Stub the agent hook (network/AI SDK) — parametrizable so tests can flip isRunning.
const hookState = { isRunning: false };
vi.mock("../src/agent/useLiveAgent", () => ({
  useLiveAgent: () => ({
    isRunning: hookState.isRunning,
    error: null,
    run: vi.fn(),
    sendAction: vi.fn(),
    stop: vi.fn(),
  }),
}));

import { LiveDashboard, DEFAULT_PROMPT } from "../src/LiveDashboard";
import { A2UISurfaceProvider } from "../src/A2UISurface";

function renderLive() {
  render(
    <A2UISurfaceProvider>
      <LiveDashboard
        mode="live"
        onMode={() => undefined}
        eventLog={[]}
        setEventLog={() => undefined}
      />
    </A2UISurfaceProvider>,
  );
}

function promptField(): HTMLTextAreaElement {
  return screen.getByPlaceholderText(/compose a UI/i);
}

describe("LiveDashboard turn-busy indicator", () => {
  it("shows a Generating chip while a run streams", () => {
    hookState.isRunning = true;
    renderLive();

    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    hookState.isRunning = false;
  });

  it("shows no Generating chip when idle", () => {
    hookState.isRunning = false;
    renderLive();

    expect(screen.queryByText(/generating/i)).toBeNull();
  });
});

describe("LiveDashboard default prompt", () => {
  it("starts with the submittable default prompt", () => {
    renderLive();

    expect(promptField()).toHaveValue(DEFAULT_PROMPT);
  });

  it("clears the default on first focus", () => {
    renderLive();

    fireEvent.focus(promptField());

    expect(promptField()).toHaveValue("");
  });

  it("does not clear typed text on a later refocus", () => {
    renderLive();
    const field = promptField();

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "my own prompt" } });
    fireEvent.blur(field);
    fireEvent.focus(field);

    expect(field).toHaveValue("my own prompt");
  });
});
