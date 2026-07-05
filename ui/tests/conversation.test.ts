import { describe, it, expect } from "vitest";
import { actionToTurn, appendUserTurn, type UserTurn } from "../src/agent/conversation";

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
    const initial: UserTurn[] = [{ role: "user", content: "show repos" }];

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
});
