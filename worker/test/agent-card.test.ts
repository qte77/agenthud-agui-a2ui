import { describe, it, expect } from "vitest";
import { buildAgentCard, agentCardResponse } from "../src/wellknown/agent-card";

describe("buildAgentCard", () => {
  const card = buildAgentCard("https://worker.example");

  it("advertises both MCP tools as skills", () => {
    const ids = card.skills.map((s) => s.id);
    expect(ids).toContain("render_ui");
    expect(ids).toContain("validate_a2ui_batch");
  });

  it("carries the required descriptive fields", () => {
    expect(card.name).toBe("agenthud");
    expect(typeof card.description).toBe("string");
    expect(card.provider.organization).toBe("qte77");
    expect(Array.isArray(card.defaultInputModes)).toBe(true);
    expect(Array.isArray(card.defaultOutputModes)).toBe(true);
    expect(card.capabilities).toBeTruthy();
  });

  it("points its A2A interface at the live /a2a endpoint", () => {
    expect(card.url).toBe("https://worker.example/a2a");
    expect(card.supportedInterfaces[0]?.url).toBe("https://worker.example/a2a");
  });

  it("gives every skill an id, name, description and tags", () => {
    for (const s of card.skills) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(Array.isArray(s.tags)).toBe(true);
    }
  });
});

describe("agentCardResponse", () => {
  it("returns a 200 JSON document with wildcard CORS", async () => {
    const res = agentCardResponse(new Request("https://worker.example/.well-known/agent-card.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body: { name?: string } = await res.json();
    expect(body.name).toBe("agenthud");
  });
});
