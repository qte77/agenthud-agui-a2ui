// Single source of truth for URL + connection config: the project repo URL, the deployed edge-proxy
// base, and the BYOK endpoint presets. Components (and buildInfo) import from here, and the docs
// point at this file — so no URL is duplicated into a component or restated in prose.

// Project repo — used by the header GitHub links, the footer, and the build-version badge.
export const REPO_URL = "https://github.com/qte77/agenthud-agui-a2ui";

// PROXY_BASE points at the deployed edge proxy (US-6 / worker/) — the "(via proxy)" endpoints below
// route GitHub Models + Google through it so they work in-browser despite no upstream CORS. In dev,
// VITE_PROXY_BASE (ui/.env) overrides it to target a local `wrangler dev` worker that allows the
// localhost origin (prod rejects localhost by design); prod ignores it since DEV is false.
export const PROXY_BASE =
  import.meta.env.DEV && import.meta.env.VITE_PROXY_BASE
    ? import.meta.env.VITE_PROXY_BASE
    : "https://agenthud-proxy.cloudflare-driveway392.workers.dev";

// OpenAI-compatible BYOK endpoints offered in the Live connection dropdown. The CORS-friendly ones
// work in-browser as-is; GitHub Models + Google have no browser CORS, so they route through the edge
// proxy (US-6 / ADR-0001 — see worker/README.md). `editable` reveals the freeform URL field (Custom).
// Only endpoints that actually work from the static site are listed — providers with no browser CORS
// and no safe fixed proxy upstream (e.g. Azure's per-resource host, an SSRF risk) are not offered;
// point Custom… at your own if you proxy them yourself.
export interface Endpoint {
  label: string;
  baseURL: string;
  editable?: boolean;
}

export const ENDPOINTS: Endpoint[] = [
  { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseURL: "https://api.groq.com/openai/v1" },
  { label: "Together", baseURL: "https://api.together.ai/v1" },
  { label: "Fireworks", baseURL: "https://api.fireworks.ai/inference/v1" },
  { label: "DeepSeek", baseURL: "https://api.deepseek.com" },
  { label: "GitHub Models (via proxy)", baseURL: `${PROXY_BASE}/github-models` },
  { label: "Google (via proxy)", baseURL: `${PROXY_BASE}/google` },
  { label: "Custom…", baseURL: "", editable: true },
];
