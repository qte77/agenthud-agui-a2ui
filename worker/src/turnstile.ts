/*
 * Cloudflare Turnstile server-side verification (siteverify). Proof-of-human before any keyless model
 * call — the accepted answer to the Origin-spoof abuse gap the BYOK proxy documents (a spoofed Origin
 * can't produce a valid single-use Turnstile token). Returns false on ANY failure (empty/invalid/
 * expired token, non-OK response, network error) so the caller rejects the request.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verify a Turnstile token against siteverify. False for an empty token (no network call needed). */
export async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetch(SITEVERIFY, { method: "POST", body: params });
    if (!res.ok) return false;
    const data: { success?: boolean } = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
