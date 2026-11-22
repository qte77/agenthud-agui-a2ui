// Shared request-body cap — blocks cost/DoS amplification (chat payloads are far smaller than 1 MiB).
// Lives in its own module so worker.ts and a2a/handler.ts can both use it without an import cycle.
export const MAX_BODY_BYTES = 1_048_576;

// Read the request body, enforcing the size cap. Returns the bytes, or a 413 Response when too
// large. Skips reading when the declared length already exceeds the cap; otherwise verifies the
// actual bytes (covers a missing or spoofed Content-Length).
export async function readCappedBody(
  request: Request,
  cors: Record<string, string> = {},
  maxBytes: number = MAX_BODY_BYTES,
): Promise<ArrayBuffer | Response> {
  const overByHeader = Number(request.headers.get("content-length") ?? 0) > maxBytes;
  const body = overByHeader ? null : await request.arrayBuffer();
  if (body === null || body.byteLength > maxBytes) {
    return Response.json({ error: "Request body too large" }, { status: 413, headers: cors });
  }
  return body;
}
