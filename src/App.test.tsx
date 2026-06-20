import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("@a2ui/react", () => ({
  A2UIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  A2UIRenderer: () => <div data-testid="a2ui-surface" />,
  initializeDefaultCatalog: vi.fn(),
  useA2UIActions: () => ({
    processMessages: vi.fn(),
    clearSurfaces: vi.fn(),
  }),
}));

import { App } from "./App";

describe("App", () => {
  it("renders header with agenthud title", () => {
    render(<App />);
    expect(screen.getByText("agenthud")).toBeInTheDocument();
  });

  it("shows Replay badge", () => {
    render(<App />);
    expect(screen.getByText("Replay")).toBeInTheDocument();
  });

  it("shows the decision-tree root choices on initial render", () => {
    // Streamlined demo starts directly on the single tour's root choices —
    // no tour-selection step.
    render(<App />);
    expect(screen.getByText("Show me repos")).toBeInTheDocument();
  });

  it("shows Play All button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Play All/i })).toBeInTheDocument();
  });

  it("shows Catalog button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Catalog/i })).toBeInTheDocument();
  });

  it("Catalog button opens modal with component list", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Catalog/i }));
    expect(screen.getByText("A2UI Standard Component Catalog")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("Slider")).toBeInTheDocument();
  });
});
