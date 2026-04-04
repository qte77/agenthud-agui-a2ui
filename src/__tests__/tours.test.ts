import { describe, it, expect } from "vitest";
import { tours } from "../recordings";

describe("tour registry", () => {
  it("exports a tours array with at least 3 entries", () => {
    expect(Array.isArray(tours)).toBe(true);
    expect(tours.length).toBeGreaterThanOrEqual(3);
  });

  it("each tour has id, label, description, and recording", () => {
    for (const tour of tours) {
      expect(tour).toHaveProperty("id");
      expect(tour).toHaveProperty("label");
      expect(tour).toHaveProperty("description");
      expect(tour).toHaveProperty("recording");
    }
  });

  it("each tour recording has meta with title", () => {
    for (const tour of tours) {
      expect(tour.recording).toHaveProperty("meta");
      expect(tour.recording.meta).toHaveProperty("title");
      expect(typeof tour.recording.meta.title).toBe("string");
    }
  });

  it("each tour recording has events array with at least one event", () => {
    for (const tour of tours) {
      expect(Array.isArray(tour.recording.events)).toBe(true);
      expect(tour.recording.events.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each tour recording has a tree with a root node", () => {
    for (const tour of tours) {
      expect(tour.recording).toHaveProperty("tree");
      expect(tour.recording.tree).toHaveProperty("root");
    }
  });

  it("tour IDs are unique", () => {
    const ids = tours.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
