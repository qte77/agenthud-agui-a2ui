/**
 * Smoke test: renders with the REAL @a2ui/react renderer (no mock), so a future
 * @a2ui/react bump that breaks the catalog → message-processor → renderer → Text
 * path is caught in CI. The rest of the suite mocks @a2ui/react; this file
 * deliberately does not.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useA2UIActions } from "@a2ui/react";
import { A2UISurfaceProvider, A2UISurface } from "../src/A2UISurface";
import { setActionHandler } from "../src/agent/actionBridge";
import overview from "../src/recordings/overview.json";

const SMOKE_TEXT = "SmokeTestUniqueText__a2ui";
const BUTTON_LABEL = "SmokeButton__a2ui";

// Minimal batch with one actionable Button wrapping a Text label.
const BUTTON_BATCH = [
  { beginRendering: { surfaceId: "main", root: "b1" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        {
          id: "b1",
          component: { Button: { child: "t1", action: { name: "do_thing" } } },
        },
        {
          id: "t1",
          component: { Text: { text: { literalString: BUTTON_LABEL }, usageHint: "body" as const } },
        },
      ],
    },
  },
];

// Smallest valid A2UI batch that renders one Text component on surface "main".
const MINIMAL_BATCH = [
  { beginRendering: { surfaceId: "main", root: "t1" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        {
          id: "t1",
          component: { Text: { text: { literalString: SMOKE_TEXT }, usageHint: "body" as const } },
        },
      ],
    },
  },
];

// Value-bound leaf components from the bundled recording (no child refs), so each can be rendered
// in a self-contained batch — isolating the binding contract from the recording's cross-segment
// component references.
interface LeafComp {
  id: string;
  component: Record<string, unknown>;
}
const LEAF_TYPES = ["Text", "Image", "Slider", "CheckBox"];
function collectLeaves(node: unknown, out: LeafComp[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectLeaves(n, out);
    return;
  }
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const comp = obj.component;
    if (typeof obj.id === "string" && comp !== null && typeof comp === "object") {
      const type = Object.keys(comp)[0];
      if (type !== undefined && LEAF_TYPES.includes(type)) {
        out.push({ id: obj.id, component: comp as Record<string, unknown> });
      }
    }
    for (const v of Object.values(obj)) collectLeaves(v, out);
  }
}
const LEAF_COMPONENTS: LeafComp[] = [];
collectLeaves(overview, LEAF_COMPONENTS);

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
  afterEach(() => setActionHandler(null));

  it("dispatches a clicked Button's action name to the bridge handler", () => {
    // ARRANGE
    const spy = vi.fn();
    setActionHandler(spy);
    let processMessages!: ReturnType<typeof useA2UIActions>["processMessages"];
    render(
      <A2UISurfaceProvider>
        <CaptureActions onReady={(fn) => (processMessages = fn)} />
        <A2UISurface />
      </A2UISurfaceProvider>,
    );
    act(() => processMessages(BUTTON_BATCH));

    // ACT — click the rendered A2UI Button
    fireEvent.click(screen.getByText(BUTTON_LABEL));

    // ASSERT — our provider→bridge wiring forwarded the action name
    expect(spy).toHaveBeenCalledWith("do_thing");
  });

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
    act(() => processMessages(MINIMAL_BATCH));

    expect(screen.getByText(SMOKE_TEXT)).toBeInTheDocument();
  });

  // Contract guard: the bundled recording must use binding shapes the real @a2ui schema accepts.
  // A bare `{ literal }` on a typed binding (Slider.value → literalNumber, CheckBox.value →
  // literalBoolean) is rejected by the message schema and throws. Render each value-bound leaf in
  // a self-contained batch so a regression to bare `literal` fails here.
  it("renders every recorded value-bound leaf component (typed-literal bindings)", () => {
    let processMessages!: ReturnType<typeof useA2UIActions>["processMessages"];

    render(
      <A2UISurfaceProvider>
        <CaptureActions onReady={(fn) => (processMessages = fn)} />
        <A2UISurface />
      </A2UISurfaceProvider>,
    );

    expect(LEAF_COMPONENTS.length).toBeGreaterThan(0);
    expect(() => {
      act(() => {
        for (const c of LEAF_COMPONENTS) {
          processMessages([
            { beginRendering: { surfaceId: "main", root: c.id } },
            { surfaceUpdate: { surfaceId: "main", components: [c] } },
          ] as Parameters<typeof processMessages>[0]);
        }
      });
    }).not.toThrow();
  });
});
