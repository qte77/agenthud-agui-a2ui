/*
 * agenthud MCP server (POST /mcp). Stateless Streamable HTTP via @modelcontextprotocol/server's
 * createMcpHandler — no Durable Object (both tools are single-shot). The handler is built per
 * request so each tool closure captures that request's `env` (bindings + secrets). GET/DELETE are
 * answered 405 by the default `legacy: 'stateless'` mode, matching MCP spec 2026-07-28 (POST-only).
 */

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Env } from "../router";
import {
  runRenderUi,
  runValidateBatch,
  renderUiInputSchema,
  validateBatchInputSchema,
} from "./tools";

const SERVER_INFO = { name: "agenthud", version: "1.0.0" };

/** Build a fresh stateless McpServer with agenthud's two tools bound to the request `env`. */
export function buildMcpServer(env: Env): McpServer {
  const server = new McpServer(SERVER_INFO);
  server.registerTool(
    "render_ui",
    {
      title: "Render UI",
      description:
        "Generate an A2UI component batch from a natural-language prompt using free server-side " +
        "models (Cloudflare Workers AI first, then OpenRouter :free). Returns { a2uiMessages }.",
      inputSchema: renderUiInputSchema,
    },
    (args) => runRenderUi(env, args),
  );
  server.registerTool(
    "validate_a2ui_batch",
    {
      title: "Validate A2UI batch",
      description:
        "Structurally validate an A2UI message batch: root defined + present, no dangling child " +
        "references, acyclic. Returns { valid, issues }.",
      inputSchema: validateBatchInputSchema,
    },
    (args) => runValidateBatch(args),
  );
  return server;
}

/** Stateless MCP Streamable HTTP handler for POST /mcp (per-request server bound to `env`). */
export async function mcpFetch(request: Request, env: Env): Promise<Response> {
  // Shares the AI-cost-bearing free limiter with /agent/render and /a2a (the tools spend on models).
  if (env.FREE_RATE_LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.FREE_RATE_LIMITER.limit({ key: ip });
    if (!success) return new Response("Rate limit exceeded", { status: 429 });
  }
  return createMcpHandler(() => buildMcpServer(env)).fetch(request);
}
