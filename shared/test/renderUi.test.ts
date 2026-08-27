import { describe, it, expect } from "vitest";
import {
  extractChildIds,
  buildGraph,
  hasCycle,
  SYSTEM_PROMPT,
  RENDER_UI_TOOL_DESCRIPTION,
} from "../src/renderUi";

describe("extractChildIds", () => {
  it("reads Card/Button's single child", () => {
    expect(extractChildIds({ Card: { child: "body" } })).toEqual(["body"]);
    expect(extractChildIds({ Button: { child: "label", action: { name: "x" } } })).toEqual(["label"]);
  });

  it("reads Row/Column/List's children.explicitList", () => {
    expect(extractChildIds({ Column: { children: { explicitList: ["a", "b"] } } })).toEqual(["a", "b"]);
  });

  it("reads Tabs' tabItems children", () => {
    expect(
      extractChildIds({ Tabs: { tabItems: [{ title: {}, child: "panel1" }, { title: {}, child: "panel2" }] } }),
    ).toEqual(["panel1", "panel2"]);
  });

  it("returns [] for a component with no ref fields (e.g. Text, Divider)", () => {
    expect(extractChildIds({ Text: { text: { literalString: "hi" } } })).toEqual([]);
    expect(extractChildIds({ Divider: {} })).toEqual([]);
  });
});

describe("buildGraph", () => {
  it("maps each component id to its extracted child ids", () => {
    const graph = buildGraph([
      { id: "root", component: { Card: { child: "body" } } },
      { id: "body", component: { Text: { text: { literalString: "hi" } } } },
    ]);
    expect(graph.get("root")).toEqual(["body"]);
    expect(graph.get("body")).toEqual([]);
  });
});

describe("hasCycle", () => {
  it("returns false for an acyclic graph", () => {
    const graph = buildGraph([
      { id: "root", component: { Card: { child: "body" } } },
      { id: "body", component: { Text: { text: { literalString: "hi" } } } },
    ]);
    expect(hasCycle(graph)).toBe(false);
  });

  it("returns true for a self-reference", () => {
    const graph = buildGraph([{ id: "root", component: { Card: { child: "root" } } }]);
    expect(hasCycle(graph)).toBe(true);
  });

  it("returns true for a multi-node cycle (root -> a -> b -> root)", () => {
    const graph = buildGraph([
      { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
      { id: "a", component: { Column: { children: { explicitList: ["b"] } } } },
      { id: "b", component: { Column: { children: { explicitList: ["root"] } } } },
    ]);
    expect(hasCycle(graph)).toBe(true);
  });

  it("returns false for a DAG — a child shared by two parents is not a cycle", () => {
    const graph = buildGraph([
      { id: "root", component: { Column: { children: { explicitList: ["a", "b"] } } } },
      { id: "a", component: { Card: { child: "shared" } } },
      { id: "b", component: { Card: { child: "shared" } } },
      { id: "shared", component: { Text: { text: { literalString: "hi" } } } },
    ]);
    expect(hasCycle(graph)).toBe(false);
  });
});

describe("SYSTEM_PROMPT / RENDER_UI_TOOL_DESCRIPTION", () => {
  it("are non-empty strings mentioning render_ui", () => {
    expect(SYSTEM_PROMPT).toContain("render_ui");
    expect(RENDER_UI_TOOL_DESCRIPTION.length).toBeGreaterThan(0);
  });
});
