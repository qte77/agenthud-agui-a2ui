/*
 * Static A2A Agent Card served at GET /.well-known/agent-card.json (public discovery document —
 * origin/rate bypass, wildcard CORS). Skills map 1:1 to the MCP tools; `url` / `supportedInterfaces`
 * point at the live `/a2a` JSON-RPC endpoint on this same Worker origin (both the a2a-js `url` +
 * `preferredTransport` form and the proto `supportedInterfaces` form are emitted for validator
 * compatibility). `documentationUrl` points at the human demo on GitHub Pages.
 */

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
}

export interface AgentInterface {
  transport: string;
  url: string;
}

export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  version: string;
  url: string;
  preferredTransport: string;
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
    protocolVersion: "0.3.0",
    name: "agenthud",
    description:
      "Renders live A2UI interfaces from natural-language prompts and replays AG-UI event streams. " +
      "Ask it to draw a UI and it returns an A2UI component batch.",
    version: "1.0.0",
    url: a2a,
    preferredTransport: "JSONRPC",
    supportedInterfaces: [{ transport: "JSONRPC", url: a2a }],
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
