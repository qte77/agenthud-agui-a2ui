import { describe, it, expect } from "vitest";
import overview from "../src/recordings/overview.json";
import { A2UIMessageBatchSchema, RecordingSchema } from "../src/agent/contract";

describe("recording contract (internal data)", () => {
  it("the bundled overview.json conforms to RecordingSchema", () => {
    const result = RecordingSchema.safeParse(overview);
    expect(result.success).toBe(true);
  });

  it("tree choices may declare the A2UI action name that triggers them", () => {
    const rec = {
      meta: { title: "t", description: "d" },
      events: [],
      tree: {
        "after-apply": {
          prompt: "See results?",
          choices: [
            {
              label: "Show results",
              hint: "Card",
              segment: "results",
              next: null,
              action: "applyFilters",
            },
          ],
        },
      },
    };
    const result = RecordingSchema.safeParse(rec);
    expect(result.success).toBe(true);
    // The action must survive parsing (zod strips undeclared keys — declared optional keeps it).
    expect(result.data?.tree?.["after-apply"]?.choices[0]?.action).toBe("applyFilters");
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

  it("accepts a dataModelUpdate message (data-model seeding for two-way bindings)", () => {
    const batch = [
      {
        dataModelUpdate: {
          surfaceId: "main",
          contents: [{ key: "filters", valueMap: [{ key: "active", valueBoolean: true }] }],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects a dataModelUpdate without a surfaceId", () => {
    const batch = [{ dataModelUpdate: { contents: [] } }];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects a Card that uses `children` instead of a single `child`", () => {
    const batch = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "card", component: { Card: { children: { explicitList: ["x"] } } } },
          ],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("accepts a Card with a single string `child`", () => {
    const batch = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [{ id: "card", component: { Card: { child: "card-body" } } }],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });
});

describe("A2UI batch contract — acyclic component tree", () => {
  // A circular reference (a → … → a) can make the renderer recurse forever and freeze the tab,
  // which the downstream try/catch can't catch. Reject it at the contract boundary instead.
  it("rejects a component that references itself", () => {
    const batch = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [{ id: "root", component: { Card: { child: "root" } } }],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects a multi-node cycle (root → a → root)", () => {
    const batch = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
            { id: "a", component: { Card: { child: "root" } } },
          ],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("accepts a shared child referenced by two parents (a DAG, not a cycle)", () => {
    const batch = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Column: { children: { explicitList: ["a", "b"] } } } },
            { id: "a", component: { Card: { child: "shared" } } },
            { id: "b", component: { Card: { child: "shared" } } },
            { id: "shared", component: { Text: { text: { literalString: "hi" } } } },
          ],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("accepts a cross-message tree (Tabs child defined in a later surfaceUpdate)", () => {
    const batch = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Tabs: { tabItems: [{ title: { literalString: "T" }, child: "panel" }] } } },
          ],
        },
      },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [{ id: "panel", component: { Text: { text: { literalString: "hi" } } } }],
        },
      },
    ];
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });
});
