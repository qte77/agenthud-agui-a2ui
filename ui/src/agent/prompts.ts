/*
 * ALL model-facing prompt text for the live agent lives here (prompt-craft edits get isolated
 * diffs; liveAgent.ts stays logic-only). The one deliberate exception: conversation.ts's
 * actionToTurn turn template — it's the tested output of a reducer and stays with its logic.
 *
 * SYSTEM_PROMPT/RENDER_UI_TOOL_DESCRIPTION come from @agenthud/shared (#211) — this text was
 * byte-for-byte duplicated with worker/src/agent/prompts.ts (the worker's keyless render chain
 * prepends the SAME system prompt server-side); now one source. Prompt-craft edits still happen in
 * shared/src/renderUi.ts, and still land on both consumers at once (the point of unifying it).
 * SYSTEM_PROMPT is a hand-curated A2UI catalog reference per ADR-0003
 * (docs/decisions/0003-live-catalog-instruction.md): the exact prop shape per component Type,
 * transcribed from @a2ui/web_core's v0.8 schema. Deliberately NOT derived/injected (token cost on
 * the visitor's BYOK key; small models follow a tight reference better). Hand-maintained — re-check
 * against the schema on @a2ui bumps.
 */

export { SYSTEM_PROMPT, RENDER_UI_TOOL_DESCRIPTION } from "@agenthud/shared";
