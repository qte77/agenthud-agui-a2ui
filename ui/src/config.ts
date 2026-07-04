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
// `models` is a curated, static suggestion list per provider — surfaced as a <select> + Custom… on
// the model field (free-form is still accepted). No live `/models` fetch (browser-CORS wall + needs
// the key), so ids drift; that cost is accepted. The `verified` date on each list is a freshness
// signal — re-check that provider's ids against its docs periodically and bump the date.
export interface Endpoint {
  label: string;
  baseURL: string;
  editable?: boolean;
  models?: string[];
}

export const ENDPOINTS: Endpoint[] = [
  {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    // verified 2026-07-04
    models: [
      "anthropic/claude-sonnet-5",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-5.5",
      "openai/gpt-5.4-mini",
      "google/gemini-3.5-flash",
      "meta-llama/llama-4-maverick",
    ],
  },
  {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    // verified 2026-07-04 (llama-3.3-70b-versatile deprecates 2026-08-16)
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"],
  },
  {
    label: "Together",
    baseURL: "https://api.together.ai/v1",
    // verified 2026-07-04
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen3.5-9B",
      "deepseek-ai/DeepSeek-V4-Pro",
    ],
  },
  {
    label: "Fireworks",
    baseURL: "https://api.fireworks.ai/inference/v1",
    // verified 2026-07-04
    models: [
      "accounts/fireworks/models/deepseek-v4-pro",
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
    ],
  },
  {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    // verified 2026-07-04 (deepseek-chat/deepseek-reasoner retire 2026-07-24 → use v4 ids)
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
  },
  {
    // ⚠️ GitHub Models is fully RETIRED 2026-07-30 (brownouts 07-16 / 07-23): this endpoint — and
    // the worker `github-models` route — will 404 after that. Drop both once it goes dark (#140-adjacent).
    label: "GitHub Models (via proxy) · retires 2026-07-30",
    baseURL: `${PROXY_BASE}/github-models`,
    // verified 2026-07-04
    models: ["openai/gpt-4.1", "openai/gpt-4o-mini"],
  },
  {
    label: "Google (via proxy)",
    baseURL: `${PROXY_BASE}/google`,
    // verified 2026-07-04
    models: ["gemini-3.5-flash", "gemini-2.5-pro", "gemini-3.1-flash-lite"],
  },
  { label: "Custom…", baseURL: "", editable: true },
];
