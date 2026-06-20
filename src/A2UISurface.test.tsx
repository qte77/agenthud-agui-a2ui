/**
 * Smoke test: renders with the REAL @a2ui/react renderer (no mock), so a future
 * @a2ui/react bump that breaks the catalog → message-processor → renderer → Text
 * path is caught in CI. The rest of the suite mocks @a2ui/react; this file
 * deliberately does not.
 */
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useA2UIActions } from "@a2ui/react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";

const SMOKE_TEXT = "SmokeTestUniqueText__a2ui";

// Smallest valid A2UI batch that renders one Text component on surface "main".
const MINIMAL_BATCH = [
  { beginRendering: { surfaceId: "main", root: "t1" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        {
          id: "t1",
          component: { Text: { text: { literal: SMOKE_TEXT }, usageHint: "body" } },
        },
      ],
    },
  },
];

/** Grabs processMessages from inside the provider and hands it back out. */
function CaptureActions({
  onReady,
}: {
  onReady: (fn: ReturnType<typeof useA2UIActions>["processMessages"]) => void;
}) {
  onReady(useA2UIActions().processMessages);
  return null;
}

describe("A2UISurface (real @a2ui/react)", () => {
  it("renders a Text component's literal text", () => {
    let processMessages!: ReturnType<typeof useA2UIActions>["processMessages"];

    render(
      <A2UISurfaceProvider>
        <CaptureActions onReady={(fn) => (processMessages = fn)} />
        <A2UISurface />
      </A2UISurfaceProvider>,
    );

    // Empty surface before any messages.
    expect(screen.queryByText(SMOKE_TEXT)).toBeNull();

    // Drive the real renderer with a minimal batch (render is synchronous —
    // Text is an eager catalog component).
    act(() => processMessages(MINIMAL_BATCH as Parameters<typeof processMessages>[0]));

    expect(screen.getByText(SMOKE_TEXT)).toBeInTheDocument();
  });
});
