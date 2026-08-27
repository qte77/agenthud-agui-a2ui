/*
 * Dependency-free structural validator for an A2UI batch the model returns, so the keyless worker
 * rejects a malformed batch the SAME way the browser BYOK path does — a bad batch falls back to the
 * deterministic stub instead of surfacing a broken UI. Stronger than a list-only self-containment
 * check: it follows every container/ref field (Card/Button child, Row/Column/List explicitList, Tabs
 * tabItems) AND rejects cycles (which would hang the renderer). The graph/cycle primitive itself
 * comes from @agenthud/shared (#211) — extractChildIds/buildGraph/hasCycle were identical duplicated
 * logic between here and ui/src/agent/contract.ts; the beginRendering.root tracking below and the
 * validateBatch/isValidBatch wrapper stay worker-specific (deliberately narrower than ui's zod
 * contract — no Card-shape/envelope checks, since this only guards the deterministic-stub fallback).
 */

import { buildGraph, hasCycle, type A2UIComponentLike } from "@agenthud/shared";

/** Walk the batch once → the beginRendering root id + the `id -> child-ids` reference graph. */
function buildBatchGraph(batch: unknown[]): { root: string | undefined; graph: Map<string, string[]> } {
  let root: string | undefined;
  const components: A2UIComponentLike[] = [];
  for (const msg of batch) {
    const m = msg as { beginRendering?: { root?: unknown }; surfaceUpdate?: { components?: unknown } };
    if (typeof m.beginRendering?.root === "string") root = m.beginRendering.root;
    const comps = m.surfaceUpdate?.components;
    if (!Array.isArray(comps)) continue;
    for (const comp of comps) {
      const c = comp as { id?: unknown; component?: Record<string, unknown> };
      if (typeof c.id === "string") components.push({ id: c.id, component: c.component ?? {} });
    }
  }
  return { root, graph: buildGraph(components) };
}

/** Collect every referenced child id that is defined nowhere in the batch (dangling refs), deduped. */
function danglingRefs(graph: Map<string, string[]>): string[] {
  const missing = new Set<string>();
  for (const refs of graph.values()) {
    for (const r of refs) if (!graph.has(r)) missing.add(r);
  }
  return [...missing];
}

/**
 * Structural validation of a model-produced A2UI batch, reporting SPECIFIC issues: root defined +
 * present, every referenced child id defined (self-contained), and the reference graph acyclic.
 * `{ valid: true, issues: [] }` when sound; otherwise `valid: false` with an agent-readable reason
 * per problem. The shared seam behind both `isValidBatch` (the render fallback gate) and the MCP
 * `validate_a2ui_batch` tool (the #211 unify seam).
 */
export function validateBatch(batch: unknown): { valid: boolean; issues: string[] } {
  if (!Array.isArray(batch)) return { valid: false, issues: ["batch must be an array of A2UI messages"] };
  const issues: string[] = [];
  const { root, graph } = buildBatchGraph(batch);
  if (!root) issues.push("missing beginRendering.root");
  else if (!graph.has(root)) issues.push(`root component "${root}" is not defined`);
  for (const id of danglingRefs(graph)) issues.push(`dangling reference: "${id}"`);
  if (hasCycle(graph)) issues.push("reference graph contains a cycle");
  return { valid: issues.length === 0, issues };
}

/** Boolean view over {@link validateBatch}: true only for a sound, self-contained, acyclic batch. */
export function isValidBatch(batch: unknown): batch is unknown[] {
  return validateBatch(batch).valid;
}
