import { REPO_URL } from "./config";

// What the footer build badge shows, so deployed builds are distinguishable. `sha` is the commit the
// bundle was built from — gh-pages injects `github.sha` via `VITE_BUILD_SHA` (see vite.config.ts);
// it's empty for a local/dev build, which then shows "dev" and links to the repo root.
export interface BuildInfo {
  /** e.g. "v0.2.0 · abc1234" (or "v0.2.0 · dev" with no sha). */
  label: string;
  /** Link target: the exact commit on GitHub, or the repo root for a dev build. */
  href: string;
  /** Tooltip carrying the full sha (or a dev note). */
  title: string;
}

export function formatBuildInfo(version: string, sha: string): BuildInfo {
  const short = sha ? sha.slice(0, 7) : "dev";
  return {
    label: `v${version} · ${short}`,
    href: sha ? `${REPO_URL}/commit/${sha}` : REPO_URL,
    title: sha ? `Built from commit ${sha}` : "Local/dev build (no commit sha)",
  };
}
