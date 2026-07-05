import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Stub the agent hook (network/AI SDK) — this suite tests the prompt-field behavior only.
vi.mock("../src/agent/useLiveAgent", () => ({
  useLiveAgent: () => ({
    eventLog: [],
    isRunning: false,
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
      <LiveDashboard mode="live" onMode={() => undefined} />
    </A2UISurfaceProvider>,
  );
}

function promptField(): HTMLTextAreaElement {
  return screen.getByPlaceholderText(/compose a UI/i);
}

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
