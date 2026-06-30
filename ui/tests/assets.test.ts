import { describe, it, expect } from "vitest";
import { resolveAssets, ASSET_MAP } from "../src/agent/assets";

// resolveAssets swaps the live agent's `asset:<name>` image tokens for the bundled, base-path-correct
// URL (the live counterpart to the demo's build-time replace), so live images self-host and load.
describe("resolveAssets", () => {
  it("replaces a known asset: token in a literalString with the mapped url", () => {
    const messages = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            {
              id: "img",
              component: { Image: { url: { literalString: "asset:qte77-avatar" }, usageHint: "avatar" } },
            },
          ],
        },
      },
    ];

    const json = JSON.stringify(resolveAssets(messages));

    expect(json).toContain(ASSET_MAP["qte77-avatar"]!);
    expect(json).not.toContain("asset:qte77-avatar");
  });

  it("leaves a non-asset literalString untouched", () => {
    const messages = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "t", component: { Text: { text: { literalString: "hello" } } } }] } },
    ];

    expect(JSON.stringify(resolveAssets(messages))).toContain("hello");
  });

  it("leaves an unknown asset token untouched", () => {
    const messages = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "img", component: { Image: { url: { literalString: "asset:nope" } } } }] } },
    ];

    expect(JSON.stringify(resolveAssets(messages))).toContain("asset:nope");
  });
});
