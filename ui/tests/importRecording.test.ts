import { describe, it, expect } from "vitest";
import { parseRecordingFile } from "../src/recordings/importRecording";

const validRecording = {
  meta: { title: "T", description: "D" },
  events: [
    { delayMs: 0, type: "RUN_STARTED" },
    {
      delayMs: 500,
      type: "TOOL_CALL_END",
      text: "render_ui",
      a2uiMessages: [
        { beginRendering: { surfaceId: "main", root: "root" } },
        {
          surfaceUpdate: {
            surfaceId: "main",
            components: [{ id: "root", component: { Text: { text: { literalString: "hi" } } } }],
          },
        },
      ],
    },
  ],
};

describe("parseRecordingFile", () => {
  it("returns ok + the parsed recording for valid recording JSON", () => {
    const result = parseRecordingFile(JSON.stringify(validRecording));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recording.meta.title).toBe("T");
      expect(result.recording.events).toHaveLength(2);
    }
  });

  it("returns ok:false with an error for malformed JSON", () => {
    const result = parseRecordingFile("{ not json");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it("returns ok:false with an error for JSON that fails the recording schema", () => {
    const result = parseRecordingFile(JSON.stringify({ meta: { title: "T" }, events: [] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
