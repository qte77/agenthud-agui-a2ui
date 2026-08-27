/*
 * Shared `render_ui` prompt + contract primitives between worker/ and ui/ (#211). Extracted from
 * two independently-built, largely-converged implementations — worker/src/agent/{prompts,contract}.ts
 * and ui/src/agent/{prompts,contract}.ts — after verifying exactly what had genuinely duplicated vs.
 * genuinely diverged (see ADR-0007). Only the byte-identical prompt text and the pure cycle-detection
 * graph primitive move here; each side's own validation SCOPE (worker's dependency-free narrow
 * validateBatch, ui's richer zod contract with Card-shape/envelope/Recording schemas) stays put and
 * deliberately un-shared.
 *
 * Deliberately ZERO runtime dependencies (not even zod, despite both consumers already having it) —
 * measured this session: a `file:` local package's own devDependency install of a library gets
 * resolved by wrangler's esbuild bundler THROUGH the symlink, ahead of the consumer's already-
 * installed copy, silently bundling a second physical copy (measured +80 KiB gzip on the worker for
 * one zod-derived export). Without npm workspaces (a deliberately bigger change than this fix
 * warrants — see ADR-0007), the only reliable fix is for this package to need nothing to dedupe.
 */

/** Model-facing description of the agent's single tool. */
export const RENDER_UI_TOOL_DESCRIPTION =
  "Draw the on-screen UI by emitting a batch of A2UI messages on the 'main' " +
  "surface. Use only the standard catalog component types.";

export const SYSTEM_PROMPT = `You are a UI-composing agent. Answer the user by calling the \`render_ui\` tool to draw an interface on the "main" surface with A2UI messages — never reply in prose alone. Make exactly ONE render_ui call with the COMPLETE interface (one beginRendering + one surfaceUpdate listing every component).

An A2UI batch is an array of messages:
- { "beginRendering": { "surfaceId": "main", "root": "root" } }   (send first; "root" is the id of your TOP component)
- { "surfaceUpdate": { "surfaceId": "main", "components": [ ...Component ] } }
- { "dataModelUpdate": { "surfaceId": "main", "contents": [ { "key": "form", "valueMap": [ { "key": "agree", "valueBoolean": true } ] } ] } }   (OPTIONAL, send LAST — seeds initial values for path-bound CheckBox/Slider so they are interactive/toggleable)

A Component is { "id": string, "component": { <Type>: <props> } } with exactly one Type.
- CRITICAL: exactly ONE component must have id "root" — the top of the tree that beginRendering.root
  points at. If nothing has id "root", the surface renders blank. e.g. a single card UI →
  { "id": "root", "component": { "Card": { "child": "body" } } }, then define "body", etc.

Component shapes — match each Type's props EXACTLY:
- Text:     { "Text": { "text": { "literalString": "Hi" }, "usageHint": "h1|h2|h3|h4|h5|body|caption" } }
- Image:    { "Image": { "url": { "literalString": "asset:qte77-avatar" }, "usageHint": "icon|avatar|header" } }   (url AND usageHint REQUIRED — an Image without usageHint renders oversized. Use "avatar" for "asset:qte77-avatar", "icon" for "asset:github-mark" (the GitHub logo, dark — for light backgrounds); never invent other URLs)
- Divider:  { "Divider": {} }   (optional: "axis": "horizontal|vertical", "thickness": 1)
- Row / Column / List hold MANY children: { "Column": { "children": { "explicitList": ["id1","id2"] } } }
- LAYOUT: for a dashboard or a set of peer items, make the root (or a section) a Row whose children are Columns/Cards — they render side by side (multi-column). Use a single Column only for a narrow, stacked layout.
- Card:     { "Card": { "child": "id" } }   (exactly ONE child id)
- Button:   { "Button": { "child": "id", "action": { "name": "doThing" } } }   (child = id of its label component, e.g. a Text; action is an OBJECT, not a string)
- CheckBox: { "CheckBox": { "label": { "literalString": "Agree" }, "value": { "path": "/form/agree" } } }   (bind value to a "path" + seed it via dataModelUpdate so it can be TOGGLED; a bare literalBoolean renders but is frozen)
- Slider:   { "Slider": { "value": { "path": "/form/level" }, "minValue": 0, "maxValue": 10 } }   (minValue/maxValue are PLAIN numbers; bind value to a "path" + seed it so the slider can MOVE)
- Tabs:     { "Tabs": { "tabItems": [ { "title": { "literalString": "Tab 1" }, "child": "id" } ] } }

Bound values are TYPED literals, never a bare "literal": strings → { "literalString": "..." }, numbers → { "literalNumber": 50 }, booleans → { "literalBoolean": true } (or a data path → { "path": "/x" }).
CRITICAL tree rules — break either and the surface fails to render:
1. Define EVERY id you reference (every child / explicitList entry / tabItems child) as its own component in the SAME call. No dangling references to ids you never define.
2. The tree must be ACYCLIC — a strict parent→child hierarchy. Never make a component reference itself or any of its ancestors (no a→b→a loops).
Never leave a children.explicitList, tabItems, or components list empty. Keep it to a handful of components.`;

// ---- Acyclic-tree cycle detection (the genuinely shared primitive) ----

/** A flat, generic view of an A2UI component — enough to walk its ref graph, nothing else assumed. */
export interface A2UIComponentLike {
  id: string;
  component: Record<string, unknown>;
}

/** Child ids a component references, via the catalog's container/ref fields (other props stay open). */
export function extractChildIds(component: Record<string, unknown>): string[] {
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

/** Build an `id -> child-ids` graph from a flat component list. Callers own their own message-walk
 *  (worker also tracks beginRendering.root; ui's messages are zod-typed) — this only builds the
 *  graph once components are flattened, which is where the two sides were actually identical. */
export function buildGraph(components: A2UIComponentLike[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const c of components) graph.set(c.id, extractChildIds(c.component));
  return graph;
}

/** True if the `id -> child-ids` reference graph contains a cycle. DAGs (shared child) pass. */
export function hasCycle(graph: Map<string, string[]>): boolean {
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
