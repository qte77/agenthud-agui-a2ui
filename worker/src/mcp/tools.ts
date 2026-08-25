/*
 * MCP tool handlers for the agenthud server (POST /mcp). Both wrap logic that already ships:
 * `render_ui` reuses the keyless free render chain (buildProviders + renderFree), and
 * `validate_a2ui_batch` reuses contract.ts's structural validator. Handlers are exported as pure
 * functions so they can be unit-tested without standing up the MCP transport (server.ts wires them).
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Env } from "../router";
import { renderFromPrompt } from "../agent/render";
import { validateBatch } from "../agent/contract";

const asText = (t: string): { type: "text"; text: string }[] => [{ type: "text", text: t }];

/** `render_ui` input: a natural-language description of the UI to draw. */
export const renderUiInputSchema = z.object({
  prompt: z.string().min(1).describe("Natural-language description of the UI to draw."),
});

/**
 * `render_ui` handler: run the same keyless free chain the browser demo uses (Cloudflare Workers AI
 * first, then OpenRouter `:free`) and return the A2UI batch. Provider-chain exhaustion is a tool
 * error here (unlike the HTTP endpoint's deterministic stub) — a calling agent wants to know that
 * generation failed rather than receive a placeholder.
 */
export async function runRenderUi(env: Env, args: { prompt: string }): Promise<CallToolResult> {
  const a2uiMessages = await renderFromPrompt(env, args.prompt);
  if (!a2uiMessages) {
    return {
      content: asText("No free model produced a valid A2UI batch (provider chain exhausted)."),
      isError: true,
    };
  }
  return { content: asText(JSON.stringify({ a2uiMessages })), structuredContent: { a2uiMessages } };
}

/** `validate_a2ui_batch` input: the batch to check (any JSON; the handler discriminates the shape). */
export const validateBatchInputSchema = z.object({
  batch: z.unknown().describe("An A2UI message batch (array of beginRendering/surfaceUpdate/... messages)."),
});

/**
 * `validate_a2ui_batch` handler: structural check reporting specific issues. A non-array input is a
 * MALFORMED tool call (`isError: true`); a well-formed array that fails validation is a SUCCESSFUL
 * call reporting `{ valid: false, issues }` (so an agent can repair its batch).
 */
export function runValidateBatch(args: { batch: unknown }): CallToolResult {
  if (!Array.isArray(args.batch)) {
    return { content: asText("Malformed input: `batch` must be an array of A2UI messages."), isError: true };
  }
  const { valid, issues } = validateBatch(args.batch);
  return { content: asText(JSON.stringify({ valid, issues })), structuredContent: { valid, issues } };
}
