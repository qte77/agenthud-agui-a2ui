import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Module-stable spies (NOT minted per call) so the switch assertion can inspect clearSurfaces.
const mockProcessMessages = vi.fn();
const mockClearSurfaces = vi.fn();

vi.mock("@a2ui/react", () => ({
  A2UIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  A2UIRenderer: () => <div data-testid="a2ui-surface" />,
  A2UIViewer: () => null,
  initializeDefaultCatalog: vi.fn(),
  useA2UIActions: () => ({
    processMessages: mockProcessMessages,
    clearSurfaces: mockClearSurfaces,
  }),
  defaultTheme: { components: { Tabs: {} } },
}));

// Stub the live engine so switching to Live loads the lazy chunk without the AI SDK.
vi.mock("../src/agent/useLiveAgent", () => ({
  useLiveAgent: () => ({
    isRunning: false,
    error: null,
    run: vi.fn(),
    sendAction: vi.fn(),
    sendMessage: vi.fn(),
    stop: vi.fn(),
  }),
}));

import { App } from "../src/App";

const EMPTY_STREAM = /Run a prompt to see the live event stream/i;

describe("source switch continuity (#128)", () => {
  it("keeps the event stream when switching demo → live → demo", async () => {
    vi.useFakeTimers();
    render(<App />);

    // Stream starts empty.
    expect(screen.getByText(EMPTY_STREAM)).toBeInTheDocument();

    // Drive a demo replay so the shared log fills.
    fireEvent.click(screen.getByText("Show me repos"));
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
    expect(screen.queryByText(EMPTY_STREAM)).toBeNull();

    // Switch to Live — the shared stream must persist (continuity, no clear).
    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    await screen.findByText(/Connection/i);
    expect(screen.queryByText(EMPTY_STREAM)).toBeNull();

    // Switch back to Demo — still there.
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(screen.queryByText(EMPTY_STREAM)).toBeNull();
  });

  it("does not clear the A2UI surface on a mere source switch", async () => {
    render(<App />);
    mockClearSurfaces.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    await screen.findByText(/Connection/i);

    expect(mockClearSurfaces).not.toHaveBeenCalled();
  });
});
