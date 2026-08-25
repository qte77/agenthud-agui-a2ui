import { describe, it, expect } from "vitest";
import { runRenderUi, runValidateBatch } from "../src/mcp/tools";
import type { Env } from "../src/router";

// A self-contained, acyclic batch the structural validator accepts.
const validBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        { id: "root", component: { Card: { child: "t" } } },
        { id: "t", component: { Text: { text: { literalString: "hi" }, usageHint: "body" } } },
      ],
    },
  },
];

// Fake Workers AI binding: returns the forced render_ui tool call carrying `validBatch`.
const aiOk = {
  run: () =>
    Promise.resolve({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "render_ui", arguments: JSON.stringify({ messages: validBatch }) } },
            ],
          },
        },
      ],
    }),
} as unknown as Ai;

describe("runRenderUi", () => {
  it("returns the generated batch as structuredContent on the happy path", async () => {
    const env: Env = { AI: aiOk };
    const res = await runRenderUi(env, { prompt: "make a card" });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as Record<string, unknown>).a2uiMessages).toEqual(validBatch);
  });

  it("returns isError when the free provider chain is exhausted (no bindings)", async () => {
    const env: Env = {}; // no AI, no OpenRouter key → zero providers → renderFree null
    const res = await runRenderUi(env, { prompt: "x" });
    expect(res.isError).toBe(true);
  });
});

describe("runValidateBatch", () => {
  it("reports { valid: true } for a self-contained acyclic batch (not an error)", () => {
    const res = runValidateBatch({ batch: validBatch });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ valid: true, issues: [] });
  });

  it("reports { valid: false } with issues for a dangling reference — a successful call, not isError", () => {
    const bad = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "root", component: { Card: { child: "ghost" } } }] } },
    ];
    const res = runValidateBatch({ batch: bad });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as Record<string, unknown>).valid).toBe(false);
    expect(((res.structuredContent as Record<string, unknown>).issues as string[]).length).toBeGreaterThan(0);
  });

  it("flags malformed (non-array) input as isError", () => {
    const res = runValidateBatch({ batch: { not: "an array" } });
    expect(res.isError).toBe(true);
  });
});
