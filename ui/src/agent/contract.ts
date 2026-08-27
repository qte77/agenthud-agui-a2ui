import { z } from "zod";
import { buildGraph, hasCycle, type A2UIComponentLike } from "@agenthud/shared";

/*
 * Validated contracts for internal + external data (frontend side).
 *
 * EXTERNAL — what crosses the network from an agent into the UI: the A2UI message
 *   batch emitted by the agent's `render_ui` tool call (or replayed from JSON).
 *   Validate it before it ever reaches the renderer.
 * INTERNAL — the pre-baked demo recording JSON shape, validated in tests.
 *
 * The Python backend (pydantic + pydantic-ai) mirrors these as pydantic models so
 * both ends of the AG-UI/A2UI boundary agree on one schema. Keep the two in sync.
 */

// ---- A2UI payload (EXTERNAL: agent → UI) ----

/**
 * @a2ui v0.10: a Card holds exactly ONE child by id — `{ Card: { child: "an-id" } }`, never
 * `children`. Validate that one prop so a model's malformed Card is rejected at the contract
 * boundary with a clear error, instead of throwing mid-render and blanking the surface (#127).
 * Non-strict: extra props are tolerated; only `child` (a non-empty id string) is required.
 */
const CardPropsSchema = z.object({ child: z.string().min(1) });

/**
 * One catalog component: `{ id, component: { <Type>: <props> } }`.
 * Props stay open (the A2UI standard catalog has 18 component types); we validate
 * the envelope — an id and exactly one named type — plus the one known-fragile prop (Card.child).
 */
export const A2UIComponentSchema = z
  .object({
    id: z.string().min(1),
    component: z
      .record(z.string(), z.unknown())
      .refine((c) => Object.keys(c).length === 1, {
        message: "component must name exactly one A2UI type",
      }),
  })
  .refine(
    (comp) => {
      const card = comp.component.Card;
      return card === undefined || CardPropsSchema.safeParse(card).success;
    },
    { message: "Card requires a single `child` (a component id string), not `children`" }
  );

export const BeginRenderingMessageSchema = z.object({
  beginRendering: z.object({
    surfaceId: z.string().min(1),
    root: z.string().min(1),
  }),
});

export const SurfaceUpdateMessageSchema = z.object({
  surfaceUpdate: z.object({
    surfaceId: z.string().min(1),
    components: z.array(A2UIComponentSchema),
  }),
});

/**
 * Data-model seeding for two-way bindings (CheckBox/Slider `value: { path }`): envelope-level
 * validation only — `contents` entries stay open (ValueMap shapes belong to @a2ui), consistent
 * with the file's philosophy of validating envelopes plus known-fragile props.
 */
export const DataModelUpdateMessageSchema = z.object({
  dataModelUpdate: z.object({
    surfaceId: z.string().min(1),
    path: z.string().optional(),
    contents: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const A2UIMessageSchema = z.union([
  BeginRenderingMessageSchema,
  SurfaceUpdateMessageSchema,
  DataModelUpdateMessageSchema,
]);

// ---- Acyclic-tree guard ----
// A circular component reference (a → … → a) would make the renderer recurse forever and freeze
// the tab — and the downstream try/catch only catches *thrown* errors, not a hang. Detect cycles
// at the contract boundary so a malformed batch is rejected like any other contract violation,
// before it reaches @a2ui. The graph/cycle primitive comes from @agenthud/shared (#211) —
// extractChildIds/hasCycle were identical duplicated logic between here and
// worker/src/agent/contract.ts; only the message-walk below (zod-typed A2UIMessage[], surfaceUpdate
// only — this file doesn't need beginRendering.root tracking) stays here.

/** Build an `id → child-ids` graph across every surfaceUpdate message in the batch. */
function buildComponentGraph(messages: A2UIMessage[]): Map<string, string[]> {
  const components: A2UIComponentLike[] = [];
  for (const msg of messages) {
    if (!("surfaceUpdate" in msg)) continue;
    for (const comp of msg.surfaceUpdate.components) components.push(comp);
  }
  return buildGraph(components);
}

/** The `render_ui` tool payload / `event.a2uiMessages` — the agent → UI contract. */
export const A2UIMessageBatchSchema = z
  .array(A2UIMessageSchema)
  .refine((messages) => !hasCycle(buildComponentGraph(messages)), {
    message: "circular component reference — the component tree must be acyclic",
  });

// ---- Recording (INTERNAL: pre-baked demo JSON) ----

export const RecordingEventSchema = z.object({
  delayMs: z.number(),
  type: z.string().min(1),
  text: z.string().optional(),
  segment: z.string().optional(),
  a2uiMessages: A2UIMessageBatchSchema.optional(),
});

export const TreeChoiceSchema = z.object({
  label: z.string(),
  hint: z.string(),
  segment: z.string(),
  next: z.string().nullable(),
  /** A2UI action name that triggers this choice when a rendered Button dispatches it. */
  action: z.string().optional(),
});

export const TreeNodeSchema = z.object({
  prompt: z.string(),
  choices: z.array(TreeChoiceSchema),
});

export const DecisionTreeSchema = z.record(z.string(), TreeNodeSchema);

export const RecordingSchema = z.object({
  meta: z.object({ title: z.string(), description: z.string() }),
  events: z.array(RecordingEventSchema),
  tree: DecisionTreeSchema.optional(),
});

export type A2UIComponent = z.infer<typeof A2UIComponentSchema>;
export type A2UIMessage = z.infer<typeof A2UIMessageSchema>;
export type A2UIMessageBatch = z.infer<typeof A2UIMessageBatchSchema>;
export type RecordingEvent = z.infer<typeof RecordingEventSchema>;
export type TreeChoice = z.infer<typeof TreeChoiceSchema>;
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type DecisionTree = z.infer<typeof DecisionTreeSchema>;
export type Recording = z.infer<typeof RecordingSchema>;
