import qte77Avatar from "../recordings/qte77-avatar.png";
import githubMark from "../assets/icons/github-black.svg";

// Bundled image assets the live agent may reference by an `asset:<name>` token. Self-hosted (Vite
// hashes + base-path-corrects the import) so live UIs render an image with zero external requests —
// the runtime counterpart to the demo's build-time token replace (see recordings/index.ts).
// To add one: bundle the file under ui/src/, import it, add a token here, and list it in
// prompts.ts's SYSTEM_PROMPT so the model knows it can choose it.
// Note: `github-mark` is a dark mark — best on light surfaces.
export const ASSET_MAP: Record<string, string> = {
  "qte77-avatar": qte77Avatar,
  "github-mark": githubMark,
};

// Fallback for an `asset:<name>` token that isn't in ASSET_MAP. A live model invents tokens the
// prompt never offered (e.g. `asset:product1-image` for a gallery), and an unresolved `asset:` URL
// reaches the DOM as a real image src — the browser then logs net::ERR_UNKNOWN_URL_SCHEME and paints
// a broken image. An inline data-URI keeps the layout readable with zero network requests.
export const PLACEHOLDER_ASSET =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="image placeholder">' +
      '<rect width="64" height="64" rx="6" fill="#d4d4d8"/>' +
      '<path d="M12 46l13-16 9 11 6-7 12 12z" fill="#a1a1aa"/>' +
      '<circle cx="23" cy="21" r="5" fill="#a1a1aa"/>' +
      "</svg>",
  );

/**
 * Swap any `asset:<name>` token (in an A2UI `literalString`, e.g. an Image url) for its bundled URL.
 * Mirrors the demo's whole-batch string replace: KISS. Known tokens map to their bundled asset;
 * any leftover `asset:*` the model invented falls back to PLACEHOLDER_ASSET so nothing ships an
 * unfetchable URL. Ordinary literals pass through untouched.
 */
export function resolveAssets(messages: unknown[]): unknown[] {
  let json = JSON.stringify(messages);
  for (const [name, url] of Object.entries(ASSET_MAP)) {
    json = json.replaceAll(`asset:${name}`, url);
  }
  // Token charset mirrors the prompt's `asset:<name>` convention (word chars, dash, dot).
  json = json.replaceAll(/asset:[\w.-]+/g, PLACEHOLDER_ASSET);
  return JSON.parse(json) as unknown[];
}
