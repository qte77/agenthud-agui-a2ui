import { describe, it, expect } from "vitest";
import overview from "../recordings/overview.json";
import { A2UIMessageBatchSchema, RecordingSchema } from "./contract";

describe("recording contract (internal data)", () => {
  it("the bundled overview.json conforms to RecordingSchema", () => {
    const result = RecordingSchema.safeParse(overview);
    expect(result.success).toBe(true);
  });
});

describe("A2UI batch contract (external data)", () => {
  it("accepts a valid beginRendering + surfaceUpdate batch", () => {
    const batch = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Column: { children: { explicitList: ["t"] } } } },
            { id: "t", component: { Text: { text: { literal: "hi" }, usageHint: "body" } } },
          ],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects a component that names no type", () => {
    const batch = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "x", component: {} }] } },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects an unknown message kind", () => {
    expect(A2UIMessageBatchSchema.safeParse([{ mysteryMessage: { foo: 1 } }]).success).toBe(
      false
    );
  });
});
