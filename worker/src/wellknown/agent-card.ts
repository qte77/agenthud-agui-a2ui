/*
 * Static A2A Agent Card served at GET /.well-known/agent-card.json (public discovery document —
 * origin/rate bypass, wildcard CORS). Skills map 1:1 to the MCP tools. `documentationUrl` points at
 * the human demo on GitHub Pages.
 *
 * #278: the A2A v1.0 card form (a2aproject/A2A `specification/a2a.proto`, tag v1.0.0). The endpoint
 * and its protocol version sit on each `supportedInterfaces` entry, and the first entry is the
 * preferred one. The same `/a2a` JSON-RPC endpoint is listed twice: protocol 1.0 (`SendMessage`)
 * first, then 0.3 (`message/send`, kept for existing callers). The v0.3 top-level `url`,
 * `preferredTransport` and `protocolVersion` fields are not emitted: the spec's migration appendix
 * (A.2) lets a server emit only the current form, and section 5.6 says v1.0 clients SHOULD ignore
 * unknown fields, so dropping them is a choice, not a requirement. A v0.3-only client that reads
 * them no longer discovers the endpoint from the card.
 */

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
}

export interface AgentInterface {
  url: string;
  protocolBinding: string;
  protocolVersion: string;
}

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: AgentInterface[];
  documentationUrl: string;
  provider: { organization: string; url: string };
  capabilities: { streaming: boolean; pushNotifications: boolean };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
}

const DEMO_URL = "https://qte77.github.io/agenthud-agui-a2ui/";
const REPO_URL = "https://github.com/qte77/agenthud-agui-a2ui";

/** Build the agent card, pointing its A2A interface at `${selfOrigin}/a2a` (this Worker). */
export function buildAgentCard(selfOrigin: string): AgentCard {
  const a2a = `${selfOrigin}/a2a`;
  return {
    name: "agenthud",
    description:
      "Renders live A2UI interfaces from natural-language prompts and replays AG-UI event streams. " +
      "Ask it to draw a UI and it returns an A2UI component batch.",
    version: "1.0.0",
    supportedInterfaces: [
      { url: a2a, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
      { url: a2a, protocolBinding: "JSONRPC", protocolVersion: "0.3" },
    ],
    documentationUrl: DEMO_URL,
    provider: { organization: "qte77", url: REPO_URL },
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "render_ui",
        name: "Render A2UI",
        description: "Generate an A2UI component batch from a natural-language prompt.",
        tags: ["ui", "a2ui", "generation"],
        examples: ["Make a login card with an email field and a submit button."],
      },
      {
        id: "validate_a2ui_batch",
        name: "Validate A2UI batch",
        description: "Structurally validate an A2UI message batch (root present, no dangling refs, acyclic).",
        tags: ["a2ui", "validation"],
      },
    ],
  };
}

/** 200 JSON response for the well-known card route, derived from the request's own origin. */
export function agentCardResponse(request: Request): Response {
  const card = buildAgentCard(new URL(request.url).origin);
  return new Response(JSON.stringify(card, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
