import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { TranscriptTurn, TurnSnapshot } from "../src/agent/transcript";

// Stub only A2UIViewer (count frozen surfaces) while keeping defaultTheme real for qteA2uiTheme.
vi.mock("@a2ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@a2ui/react")>();
  return {
    ...actual,
    A2UIViewer: ({ root, data }: { root: string; data?: Record<string, unknown> }) => (
      <div data-testid="frozen-viewer" data-root={root} data-model={JSON.stringify(data ?? null)} />
    ),
  };
});

import { Transcript } from "../src/Transcript";

// Paged transcript (#209): one turn shown at a time, ◀/▶ to step. A selected PAST turn renders its
// frozen A2UIViewer; the LATEST turn renders no viewer here (the live surface shows it).
describe("Transcript (paged)", () => {
  const snap = (root: string, data: Record<string, unknown> = {}): TurnSnapshot => ({
    root,
    components: [{ id: root, component: {} }],
    data,
  });
  const turns: TranscriptTurn[] = [
    { userText: "first prompt", snapshot: snap("t1") },
    { userText: "second", snapshot: snap("t2") },
    { userText: "third", snapshot: snap("t3") },
  ];
  const noop = () => undefined;

  it("shows the selected PAST turn's frozen surface + its position", () => {
    render(<Transcript turns={turns} selected={0} onPrev={noop} onNext={noop} />);

    expect(screen.getByText(/first prompt/)).toBeInTheDocument();
    expect(screen.getByText(/Turn 1 of 3/)).toBeInTheDocument();
    expect(screen.getByTestId("frozen-viewer").getAttribute("data-root")).toBe("t1");
  });

  it("passes the selected turn's data model to the frozen viewer (#206)", () => {
    const withData: TranscriptTurn[] = [
      { userText: "filters", snapshot: snap("t1", { filters: { active: true } }) },
      { userText: "next", snapshot: snap("t2") },
    ];
    render(<Transcript turns={withData} selected={0} onPrev={noop} onNext={noop} />);

    expect(screen.getByTestId("frozen-viewer").getAttribute("data-model")).toBe(
      JSON.stringify({ filters: { active: true } })
    );
  });

  it("renders no frozen viewer when the latest turn is selected (live surface shows it)", () => {
    render(<Transcript turns={turns} selected={2} onPrev={noop} onNext={noop} />);

    expect(screen.getByText(/Turn 3 of 3/)).toBeInTheDocument();
    expect(screen.queryByTestId("frozen-viewer")).toBeNull();
  });

  it("disables ◀ at the first turn and fires onNext", () => {
    const onNext = vi.fn();
    render(<Transcript turns={turns} selected={0} onPrev={noop} onNext={onNext} />);

    expect(screen.getByRole("button", { name: /previous turn/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /next turn/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables ▶ at the latest turn and fires onPrev", () => {
    const onPrev = vi.fn();
    render(<Transcript turns={turns} selected={2} onPrev={onPrev} onNext={noop} />);

    expect(screen.getByRole("button", { name: /next turn/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /previous turn/i }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for an empty transcript", () => {
    const { container } = render(<Transcript turns={[]} selected={0} onPrev={noop} onNext={noop} />);

    expect(container).toBeEmptyDOMElement();
  });
});
