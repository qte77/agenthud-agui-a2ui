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
