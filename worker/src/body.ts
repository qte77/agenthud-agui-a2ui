// Shared request-body cap — blocks cost/DoS amplification (chat payloads are far smaller than 1 MiB).
// Lives in its own module so worker.ts, a2a/handler.ts and mcp/server.ts can all use it without an
// import cycle.
export const MAX_BODY_BYTES = 1_048_576;

// Read the request body, enforcing the size cap. Returns the bytes, or a 413 Response when too
// large. Skips reading when the declared length already exceeds the cap; otherwise reads the stream
// chunk by chunk and cancels it as soon as the bytes pass the cap, so a missing or spoofed
// Content-Length (a chunked body) is never buffered past the cap.
export async function readCappedBody(
  request: Request,
  cors: Record<string, string> = {},
  maxBytes: number = MAX_BODY_BYTES,
): Promise<ArrayBuffer | Response> {
  const tooLarge = () => Response.json({ error: "Request body too large" }, { status: 413, headers: cors });
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return tooLarge();
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result: ReadableStreamReadResult<unknown> = await reader.read();
    if (result.done) break;
    const value = result.value;
    // Reason: the runtime types the body stream loosely; request bodies always yield bytes
    if (!(value instanceof Uint8Array)) throw new TypeError("request body chunk is not bytes");
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  const buf = new ArrayBuffer(total);
  const out = new Uint8Array(buf);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return buf;
}
