/// <reference types="vite/client" />

// DEV-only local config (see ui/.env.example). Vite embeds VITE_* into the client bundle, so these
// are read ONLY behind import.meta.env.DEV; ui/.env is gitignored — never ship real keys.
interface ImportMetaEnv {
  readonly VITE_BYOK_BASE_URL?: string;
  readonly VITE_BYOK_API_KEY?: string;
  readonly VITE_BYOK_MODEL?: string;
  // Dev override for the edge-proxy base (e.g. a local `wrangler dev` worker that allows localhost).
  readonly VITE_PROXY_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-version globals injected by vite.config.ts `define` (static string replacement).
// __APP_VERSION__ = package.json version; __BUILD_SHA__ = the build's commit sha ("" locally).
declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;
