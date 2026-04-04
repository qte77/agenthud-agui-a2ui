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

import { App } from "../App";

describe("App", () => {
  it("renders header with agenthud title", () => {
    render(<App />);
    expect(screen.getByText("agenthud")).toBeInTheDocument();
  });

  it("shows Replay badge", () => {
    render(<App />);
    expect(screen.getByText("Replay")).toBeInTheDocument();
  });

  it("idle mode shows 3 initial choice buttons", () => {
    render(<App />);
    expect(screen.getByText("Show me repos")).toBeInTheDocument();
    expect(screen.getByText("Browse by category")).toBeInTheDocument();
    expect(screen.getByText("Filter repos")).toBeInTheDocument();
  });

  it("shows Play All button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Play All/i })).toBeInTheDocument();
  });

  it("shows Catalog button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Catalog/i })).toBeInTheDocument();
  });

  it("clicking a choice hides idle choices", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Show me repos"));
    expect(screen.queryByText("Browse by category")).not.toBeInTheDocument();
    expect(screen.queryByText("Filter repos")).not.toBeInTheDocument();
  });

  it("Start over button appears after choosing", () => {
    render(<App />);
    // Start over should not be visible in idle mode
    expect(screen.queryByRole("button", { name: /Start over/i })).not.toBeInTheDocument();
    // Click a choice to enter tree mode
    fireEvent.click(screen.getByText("Show me repos"));
    expect(screen.getByRole("button", { name: /Start over/i })).toBeInTheDocument();
  });

  it("Catalog button opens modal with component list", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Catalog/i }));
    expect(screen.getByText("A2UI Standard Component Catalog")).toBeInTheDocument();
    // Verify some catalog entries are visible
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("Slider")).toBeInTheDocument();
  });
});
