import { describe, it, expect } from "vitest";
import { resolveAssets, ASSET_MAP, PLACEHOLDER_ASSET } from "../src/agent/assets";

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

  it("resolves every token in ASSET_MAP (so the prompt's choices all render)", () => {
    for (const name of Object.keys(ASSET_MAP)) {
      const json = JSON.stringify(
        resolveAssets([
          { surfaceUpdate: { surfaceId: "main", components: [{ id: "i", component: { Image: { url: { literalString: `asset:${name}` } } } }] } },
        ]),
      );
      expect(json, `token ${name}`).not.toContain(`asset:${name}`);
      expect(json, `token ${name}`).toContain(ASSET_MAP[name]!);
    }
  });

  it("leaves a non-asset literalString untouched", () => {
    const messages = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "t", component: { Text: { text: { literalString: "hello" } } } }] } },
    ];

    expect(JSON.stringify(resolveAssets(messages))).toContain("hello");
  });

  // A live model invents tokens the prompt never offered (observed: `asset:product1-image` on a
  // gallery prompt). Left as-is the browser tries to fetch `asset:…` and logs
  // net::ERR_UNKNOWN_URL_SCHEME with a broken image, so an unknown token falls back to a bundled
  // placeholder instead — the layout still reads, and no failed request is emitted.
  it("swaps an unknown asset token for the placeholder", () => {
    const messages = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "img", component: { Image: { url: { literalString: "asset:nope" } } } }] } },
    ];

    const json = JSON.stringify(resolveAssets(messages));

    expect(json).not.toContain("asset:nope");
    expect(json).toContain(PLACEHOLDER_ASSET);
  });

  it("swaps every unknown token in a batch, keeping known ones mapped", () => {
    const messages = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "a", component: { Image: { url: { literalString: "asset:product1-image" } } } },
            { id: "b", component: { Image: { url: { literalString: "asset:product2-image" } } } },
            { id: "c", component: { Image: { url: { literalString: "asset:qte77-avatar" } } } },
          ],
        },
      },
    ];

    const json = JSON.stringify(resolveAssets(messages));

    expect(json).not.toContain("asset:");
    expect(json).toContain(ASSET_MAP["qte77-avatar"]!);
  });

  it("leaves an ordinary http url untouched", () => {
    const messages = [
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "img", component: { Image: { url: { literalString: "https://example.com/a.png" } } } }] } },
    ];

    expect(JSON.stringify(resolveAssets(messages))).toContain("https://example.com/a.png");
  });
});
