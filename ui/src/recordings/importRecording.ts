import { RecordingSchema, type Recording } from "../agent/contract";

// Parse a user-supplied recording file (the JSON produced by the live Save button or the headless
// generate-recording script) and validate it against the SAME RecordingSchema the demo uses, so an
// imported recording feeds straight into useReplayEngine. Never throws — the caller shows the error.

export type ParseRecordingResult =
  | { ok: true; recording: Recording }
  | { ok: false; error: string };

/** JSON.parse + RecordingSchema.safeParse; returns a typed result (ok + recording, or a message). */
export function parseRecordingFile(raw: string): ParseRecordingResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  const parsed = RecordingSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first ? `${first.path.join(".") || "(root)"} — ${first.message}` : "Invalid recording",
    };
  }
  return { ok: true, recording: parsed.data };
}
