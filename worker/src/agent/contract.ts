/*
 * Dependency-free structural validator for an A2UI batch the model returns. Lifted from the browser
 * path's zod-free helpers (ui/src/agent/contract.ts extractChildIds/buildComponentGraph/
 * hasComponentCycle) + shared self-containment guard, so the keyless worker rejects a malformed batch
 * the SAME way the browser BYOK path does — a bad batch falls back to the deterministic stub instead
 * of surfacing a broken UI. Stronger than a list-only self-containment check: it follows every
 * container/ref field (Card/Button child, Row/Column/List explicitList, Tabs tabItems) AND rejects
 * cycles (which would hang the renderer). This is the #211 unify seam.
 */

/** Child ids a component references, via the catalog's container/ref fields (other props stay open). */
function extractChildIds(component: Record<string, unknown>): string[] {
  const props = Object.values(component)[0];
  if (props === null || typeof props !== "object") return [];
  const p = props as Record<string, unknown>;
  const ids: string[] = [];
  if (typeof p.child === "string") ids.push(p.child); // Card, Button
  const explicit = (p.children as { explicitList?: unknown } | undefined)?.explicitList;
  if (Array.isArray(explicit)) {
    for (const id of explicit) if (typeof id === "string") ids.push(id); // Row, Column, List
  }
  if (Array.isArray(p.tabItems)) {
    for (const item of p.tabItems) {
      const child = (item as { child?: unknown } | undefined)?.child;
      if (typeof child === "string") ids.push(child); // Tabs
    }
  }
  return ids;
}

/** True if the `id -> child-ids` reference graph contains a cycle. DAGs (shared child) pass. */
function hasCycle(graph: Map<string, string[]>): boolean {
  const GRAY = 1;
  const BLACK = 2;
  const state = new Map<string, number>();

  const visit = (id: string): boolean => {
    state.set(id, GRAY);
    for (const next of graph.get(id) ?? []) {
      const seen = state.get(next);
      if (seen === GRAY) return true; // back edge → cycle
      if (seen !== BLACK && visit(next)) return true;
    }
    state.set(id, BLACK);
    return false;
  };

  for (const id of graph.keys()) {
    if (state.get(id) === undefined && visit(id)) return true;
  }
  return false;
}

/** Walk the batch once → the beginRendering root id + the `id -> child-ids` reference graph. */
function buildBatchGraph(batch: unknown[]): { root: string | undefined; graph: Map<string, string[]> } {
  let root: string | undefined;
  const graph = new Map<string, string[]>();
  for (const msg of batch) {
    const m = msg as { beginRendering?: { root?: unknown }; surfaceUpdate?: { components?: unknown } };
    if (typeof m.beginRendering?.root === "string") root = m.beginRendering.root;
    const comps = m.surfaceUpdate?.components;
    if (!Array.isArray(comps)) continue;
    for (const comp of comps) {
      const c = comp as { id?: unknown; component?: Record<string, unknown> };
      if (typeof c.id === "string") graph.set(c.id, c.component ? extractChildIds(c.component) : []);
    }
  }
  return { root, graph };
}

/** Every referenced child id must be defined somewhere in the batch (no dangling refs). */
function allRefsDefined(graph: Map<string, string[]>): boolean {
  for (const refs of graph.values()) {
    for (const r of refs) if (!graph.has(r)) return false;
  }
  return true;
}

/**
 * Structural safety invariant for a model-produced A2UI batch: root defined + present, every
 * referenced child id defined (self-contained), and the reference graph acyclic. Returns false for
 * anything malformed so the caller uses its deterministic fallback.
 */
export function isValidBatch(batch: unknown): batch is unknown[] {
  if (!Array.isArray(batch)) return false;
  const { root, graph } = buildBatchGraph(batch);
  if (!root || !graph.has(root)) return false;
  return allRefsDefined(graph) && !hasCycle(graph);
}
