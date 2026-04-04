import { fullRecording, getSegmentEvents } from "../recordings";

/**
 * Validates that each segment's surfaceUpdate components are self-contained:
 * every ID referenced in a children.explicitList or child field must be
 * defined in the same segment's surfaceUpdate components.
 */
function collectIdsFromSegment(segmentId: string) {
  const events = getSegmentEvents(fullRecording, segmentId);
  const definedIds = new Set<string>();
  const referencedIds = new Set<string>();

  for (const event of events) {
    if (!event.a2uiMessages) continue;
    for (const msg of event.a2uiMessages as Array<Record<string, unknown>>) {
      const update = msg.surfaceUpdate as
        | { components?: Array<{ id: string; component?: Record<string, unknown> }> }
        | undefined;
      if (!update?.components) continue;

      for (const comp of update.components) {
        definedIds.add(comp.id);
        if (!comp.component) continue;
        const typeName = Object.keys(comp.component)[0];
        const props = comp.component[typeName] as Record<string, unknown> | undefined;
        if (!props) continue;

        // Collect children.explicitList references
        const children = props.children as { explicitList?: string[] } | undefined;
        if (children?.explicitList) {
          for (const childId of children.explicitList) {
            referencedIds.add(childId);
          }
        }

        // Collect child references (e.g., Button.child)
        if (typeof props.child === "string") {
          referencedIds.add(props.child);
        }

        // Collect tabItems child references
        const tabItems = props.tabItems as Array<{ child?: string }> | undefined;
        if (tabItems) {
          for (const item of tabItems) {
            if (typeof item.child === "string") {
              referencedIds.add(item.child);
            }
          }
        }
      }
    }
  }

  return { definedIds, referencedIds };
}

describe("filter segments standalone", () => {
  it("filters-checkboxes defines all referenced component IDs", () => {
    const { definedIds, referencedIds } = collectIdsFromSegment("filters-checkboxes");
    for (const ref of referencedIds) {
      expect(definedIds, `missing ID: ${ref}`).toContain(ref);
    }
  });

  it("filters-slider defines all referenced component IDs", () => {
    const { definedIds, referencedIds } = collectIdsFromSegment("filters-slider");
    for (const ref of referencedIds) {
      expect(definedIds, `missing ID: ${ref}`).toContain(ref);
    }
  });

  it("filters-buttons defines all referenced component IDs", () => {
    const { definedIds, referencedIds } = collectIdsFromSegment("filters-buttons");
    for (const ref of referencedIds) {
      expect(definedIds, `missing ID: ${ref}`).toContain(ref);
    }
  });

  it("all segments are self-contained (general validation)", () => {
    const segmentIds = ["overview", "detail", "plugins", "navigation",
      "filters-checkboxes", "filters-slider", "filters-buttons", "results"];

    for (const segmentId of segmentIds) {
      const { definedIds, referencedIds } = collectIdsFromSegment(segmentId);
      for (const ref of referencedIds) {
        expect(definedIds, `segment "${segmentId}" missing ID: ${ref}`).toContain(ref);
      }
    }
  });
});
