// Client side of the trial tier (US-13 / ADR-0006): 2-3 real-model renders, no BYOK key, hard-capped
// server-side by TrialQuotaDO. This module owns the two DOM-facing concerns raw fetch can't: loading
// Cloudflare's Turnstile widget script (the one documented external-request exception to this
// project's self-host policy — the challenge is served live by Cloudflare, it can't be self-hosted)
// and posting one render request. Not routed through useLiveAgent/runLiveAgent — those assume an
// OpenAI-compatible streaming /chat/completions shape via the AI SDK; this endpoint returns one
// plain JSON batch, like /agent/render already does.

import { PROXY_BASE, TURNSTILE_SITE_KEY } from "../config";

export interface TrialRenderResult {
  a2uiMessages?: unknown[];
  error?: string;
  remaining?: number;
}

/** POST one trial render. Never throws — a network failure surfaces as {error}, same contract as a
 *  server-returned error, so callers handle both the same way. */
export async function postTrialRender(prompt: string, turnstileToken: string): Promise<TrialRenderResult> {
  try {
    const res = await fetch(`${PROXY_BASE}/agent/trial-render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        turnstileToken,
      }),
    });
    return (await res.json()) as TrialRenderResult;
  } catch {
    return { error: "Couldn't reach the trial endpoint — check your connection and try again." };
  }
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void },
      ) => string;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Inject Cloudflare's Turnstile script once. Idempotent across calls (module-level cache). */
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Turnstile script."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Render the widget into `container` and resolve with a solved token. Rejects immediately if the
 *  site key isn't provisioned yet (see config.ts) rather than mounting a widget that can't work. */
export async function getTurnstileToken(container: HTMLElement): Promise<string> {
  if (!TURNSTILE_SITE_KEY) {
    throw new Error("The trial tier isn't set up yet — bring your own key instead.");
  }
  await loadTurnstileScript();
  return new Promise((resolve, reject) => {
    window.turnstile!.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => resolve(token),
      "error-callback": () => reject(new Error("The trial verification failed — please try again.")),
    });
  });
}
