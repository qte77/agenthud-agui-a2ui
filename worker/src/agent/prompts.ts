/*
 * Server-owned prompt + tool schema for the keyless free-inference tier. The worker never trusts a
 * client-sent system prompt on a keyless endpoint — it prepends THIS SYSTEM_PROMPT and forces THIS
 * tool. SYSTEM_PROMPT/RENDER_UI_TOOL_DESCRIPTION come from @agenthud/shared (#211) — the byte-
 * identical text worker and ui/ independently duplicated is now one source. RENDER_UI_TOOL's
 * parameters stay hand-written here (not derived from a zod schema): a shared package can't safely
 * depend on zod without npm workspaces — measured this session, a file: package's own zod install
 * gets bundled as a SECOND physical copy via wrangler's symlink resolution (+80 KiB gzip for this
 * alone) instead of deduping against worker's already-installed one. See ADR-0007.
 */

import { SYSTEM_PROMPT, RENDER_UI_TOOL_DESCRIPTION } from "@agenthud/shared";

export { SYSTEM_PROMPT, RENDER_UI_TOOL_DESCRIPTION };

/** The forced `render_ui` tool schema (JSON-schema envelope; the batch shape is enforced in code). */
export const RENDER_UI_TOOL = {
  type: "function",
  function: {
    name: "render_ui",
    description: RENDER_UI_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      properties: { messages: { type: "array", items: { type: "object" } } },
      required: ["messages"],
    },
  },
};
