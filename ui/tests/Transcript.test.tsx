import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { TranscriptTurn, TurnSnapshot } from "../src/agent/transcript";

// Partial-mock: stub only A2UIViewer (so we can count frozen surfaces) while keeping defaultTheme
// real for the qteA2uiTheme import.
vi.mock("@a2ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@a2ui/react")>();
  return {
    ...actual,
    A2UIViewer: ({ root }: { root: string }) => <div data-testid="frozen-viewer" data-root={root} />,
  };
});

import { Transcript } from "../src/Transcript";

// The transcript freezes every turn EXCEPT the latest (which stays the live surface elsewhere) —
// so N turns render N user rows and N-1 frozen viewers, skipping turns that captured no snapshot.
describe("Transcript", () => {
  const snap = (root: string): TurnSnapshot => ({ root, components: [{ id: root, component: {} }] });

  it("renders every user row but freezes only the prior turns (N-1)", () => {
    const turns: TranscriptTurn[] = [
      { userText: "u1", snapshot: snap("t1") },
      { userText: "u2", snapshot: snap("t2") },
      { userText: "u3", snapshot: snap("t3") },
    ];

    render(<Transcript turns={turns} />);

    expect(screen.getByText("u1")).toBeInTheDocument();
    expect(screen.getByText("u2")).toBeInTheDocument();
    expect(screen.getByText("u3")).toBeInTheDocument();
    const roots = screen.getAllByTestId("frozen-viewer").map((el) => el.getAttribute("data-root"));
    expect(roots).toEqual(["t1", "t2"]); // latest (t3) is NOT frozen
  });

  it("skips a prior turn that captured no snapshot", () => {
    const turns: TranscriptTurn[] = [
      { userText: "u1", snapshot: null },
      { userText: "u2", snapshot: snap("t2") },
      { userText: "u3", snapshot: snap("t3") },
    ];

    render(<Transcript turns={turns} />);

    expect(screen.getAllByTestId("frozen-viewer")).toHaveLength(1);
    expect(screen.getByTestId("frozen-viewer").getAttribute("data-root")).toBe("t2");
  });

  it("renders nothing for an empty transcript", () => {
    const { container } = render(<Transcript turns={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
