import { describe, it, expect } from "vitest";
import { isValidBatch } from "../src/agent/contract";

const begin = (root: string) => ({ beginRendering: { surfaceId: "main", root } });
const surface = (components: unknown[]) => ({ surfaceUpdate: { surfaceId: "main", components } });

describe("isValidBatch", () => {
  it("accepts a self-contained acyclic batch", () => {
    const batch = [
      begin("root"),
      surface([
        { id: "root", component: { Card: { child: "body" } } },
        { id: "body", component: { Text: { text: { literalString: "hi" } } } },
      ]),
    ];
    expect(isValidBatch(batch)).toBe(true);
  });

  it("rejects a non-array", () => {
    expect(isValidBatch({})).toBe(false);
    expect(isValidBatch(null)).toBe(false);
  });

  it("rejects a batch whose root component is undefined", () => {
    const batch = [begin("root"), surface([{ id: "body", component: { Text: {} } }])];
    expect(isValidBatch(batch)).toBe(false);
  });

  it("rejects a dangling child reference", () => {
    const batch = [begin("root"), surface([{ id: "root", component: { Card: { child: "ghost" } } }])];
    expect(isValidBatch(batch)).toBe(false);
  });

  it("rejects a cyclic reference (root -> a -> b -> a)", () => {
    const batch = [
      begin("root"),
      surface([
        { id: "root", component: { Column: { children: { explicitList: ["a"] } } } },
        { id: "a", component: { Column: { children: { explicitList: ["b"] } } } },
        { id: "b", component: { Column: { children: { explicitList: ["a"] } } } },
      ]),
    ];
    expect(isValidBatch(batch)).toBe(false);
  });

  it("follows Button.child and Tabs.tabItems references (stronger than list-only)", () => {
    const batch = [
      begin("root"),
      surface([
        { id: "root", component: { Tabs: { tabItems: [{ title: { literalString: "t" }, child: "btn" }] } } },
        { id: "btn", component: { Button: { child: "ghost", action: { name: "x" } } } },
      ]),
    ];
    expect(isValidBatch(batch)).toBe(false); // btn -> ghost is dangling
  });
});
