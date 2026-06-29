/// <reference types="vite/client" />

// DEV-only BYOK prefill (see ui/.env.example). Vite embeds VITE_* into the client bundle, so these
// are read ONLY behind import.meta.env.DEV; ui/.env is gitignored — never ship real keys.
interface ImportMetaEnv {
  readonly VITE_BYOK_BASE_URL?: string;
  readonly VITE_BYOK_API_KEY?: string;
  readonly VITE_BYOK_MODEL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
