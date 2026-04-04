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

  it("tour-select mode shows tour options on initial render", () => {
    render(<App />);
    expect(screen.getByText("Full Portfolio")).toBeInTheDocument();
    expect(screen.getByText("AI Projects")).toBeInTheDocument();
    expect(screen.getByText("Developer Tools")).toBeInTheDocument();
    expect(screen.getByText("Interactive Filters")).toBeInTheDocument();
  });

  it("selecting a tour shows decision tree choices", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Full Portfolio"));
    expect(screen.getByText("Show me repos")).toBeInTheDocument();
    expect(screen.queryByText("Full Portfolio")).not.toBeInTheDocument();
  });

  it("shows Play All button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Play All/i })).toBeInTheDocument();
  });

  it("shows Catalog button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Catalog/i })).toBeInTheDocument();
  });

  it("Start over returns to tour selection", () => {
    render(<App />);
    // Select a tour
    fireEvent.click(screen.getByText("Full Portfolio"));
    expect(screen.getByRole("button", { name: /Start over/i })).toBeInTheDocument();
    // Start over returns to tour select
    fireEvent.click(screen.getByRole("button", { name: /Start over/i }));
    expect(screen.getByText("Full Portfolio")).toBeInTheDocument();
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
