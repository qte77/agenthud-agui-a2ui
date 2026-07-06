import { describe, it, expect } from "vitest";
import {
  actionToTurn,
  appendUserTurn,
  appendAssistantTurn,
  summarizeRender,
  type ConversationTurn,
} from "../src/agent/conversation";

describe("conversation", () => {
  it("actionToTurn produces a user turn naming the clicked action", () => {
    // ARRANGE + ACT
    const turn = actionToTurn("filter_python");

    // ASSERT
    expect(turn.role).toBe("user");
    expect(turn.content).toContain('"filter_python"');
  });

  it("appendUserTurn appends in order without mutating the input", () => {
    // ARRANGE
    const initial: ConversationTurn[] = [{ role: "user", content: "show repos" }];

    // ACT
    const next = appendUserTurn(initial, "second turn");

    // ASSERT — immutable + ordered
    expect(initial).toHaveLength(1);
    expect(next).not.toBe(initial);
    expect(next).toHaveLength(2);
    expect(next[0]?.content).toBe("show repos");
    expect(next[1]).toEqual({ role: "user", content: "second turn" });
  });

  it("appendUserTurn works on an empty history", () => {
    // ARRANGE + ACT
    const next = appendUserTurn([], "first");

    // ASSERT
    expect(next).toEqual([{ role: "user", content: "first" }]);
  });

  it("appendAssistantTurn appends an assistant turn immutably", () => {
    // ARRANGE
    const initial: ConversationTurn[] = [{ role: "user", content: "tell a story" }];

    // ACT
    const next = appendAssistantTurn(initial, "You rendered: Once upon a time…");

    // ASSERT
    expect(initial).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ role: "assistant", content: "You rendered: Once upon a time…" });
  });
});

describe("summarizeRender (turn memory)", () => {
  const batch = [
    { beginRendering: { surfaceId: "main", root: "root" } },
    {
      surfaceUpdate: {
        surfaceId: "main",
        components: [
          { id: "root", component: { Column: { children: { explicitList: ["t1", "b1"] } } } },
          {
            id: "t1",
            component: { Text: { text: { literalString: "Once upon a time" }, usageHint: "h1" } },
          },
          {
            id: "b1",
            component: { Button: { child: "bl1", action: { name: "enterForest" } } },
          },
          {
            id: "bl1",
            component: { Text: { text: { literalString: "Enter the forest" } } },
          },
        ],
      },
    },
  ];

  it("summarizes rendered texts and button action names", () => {
    const summary = summarizeRender(batch);

    expect(summary).toContain("Once upon a time");
    expect(summary).toContain("enterForest");
  });

  it("caps very long summaries", () => {
    const many = [
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: Array.from({ length: 100 }, (_, i) => ({
            id: `t${String(i)}`,
            component: { Text: { text: { literalString: `paragraph ${String(i)} `.repeat(20) } } },
          })),
        },
      },
    ];

    expect(summarizeRender(many).length).toBeLessThanOrEqual(1200);
  });

  it("degrades gracefully on an empty batch", () => {
    expect(summarizeRender([])).toBeTypeOf("string");
  });
});
