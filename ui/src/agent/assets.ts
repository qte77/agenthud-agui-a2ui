import qte77Avatar from "../recordings/qte77-avatar.png";
import githubMark from "../assets/icons/github-black.svg";

// Bundled image assets the live agent may reference by an `asset:<name>` token. Self-hosted (Vite
// hashes + base-path-corrects the import) so live UIs render an image with zero external requests —
// the runtime counterpart to the demo's build-time token replace (see recordings/index.ts).
// To add one: bundle the file under ui/src/, import it, add a token here, and list it in
// liveAgent.ts's SYSTEM_PROMPT so the model knows it can choose it.
// Note: `github-mark` is a dark mark — best on light surfaces.
export const ASSET_MAP: Record<string, string> = {
  "qte77-avatar": qte77Avatar,
  "github-mark": githubMark,
};

/**
 * Swap any `asset:<name>` token (in an A2UI `literalString`, e.g. an Image url) for its bundled URL.
 * Mirrors the demo's whole-batch string replace: KISS, and it only touches known tokens — unknown
 * `asset:*` strings and ordinary literals pass through untouched.
 */
export function resolveAssets(messages: unknown[]): unknown[] {
  let json = JSON.stringify(messages);
  for (const [name, url] of Object.entries(ASSET_MAP)) {
    json = json.replaceAll(`asset:${name}`, url);
  }
  return JSON.parse(json) as unknown[];
}
