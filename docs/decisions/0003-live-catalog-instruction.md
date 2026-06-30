---
title: ADR-0003 — Live-agent catalog instruction: curated prompt reference
description: Decision to teach the BYOK live model the A2UI catalog via a hand-curated prompt reference, over injecting @a2ui's schema or deriving one.
---

# ADR-0003 — Live-agent catalog instruction: curated prompt reference

**Status:** Accepted (2026-06-30)
**Relates to:** [US-7][user-stories] (BYOK live agent) · [ADR-0001][adr-0001] · live-render fixes #129 / #143

## Context

The live BYOK agent must emit A2UI that `@a2ui`'s v0.8 schema accepts for the **full** component
catalog. Running gpt-4o-mini on gh-pages, the model rendered simple UIs fine but mis-shaped the richer
components — `Button` (`action` as a string, no `child`), `Image` (no `url`), `Slider`
(`minValue`/`maxValue` as objects, not bare numbers), `Tabs` (no `tabItems`) — because the
`SYSTEM_PROMPT` under-documented the catalog. The model needs **accurate component shapes**. How should
it get them? The official `a2ui-project` samples inject the catalog schema into the prompt
automatically (Google ADK `try_activate_a2ui_extension`) and validate the output — but with capable
models in a server-side Python pipeline, not our constraint.

## Decision

Teach the catalog with a **hand-curated, concise component reference in `SYSTEM_PROMPT`**
(`ui/src/agent/liveAgent.ts`) — the exact prop shape per Type, transcribed from `@a2ui`'s schema
(`@a2ui/web_core/.../v0_8/schema/common-types.js`).

| Option | Accuracy | Token cost / call | Small-model fit | Maintenance | Verdict |
|---|---|---|---|---|---|
| **1. Curated prompt reference** *(chosen)* | High (if kept in sync) | ~few hundred | **Best** — tight, digestible | Hand-maintained | ✅ |
| 2. Inject `@a2ui`'s catalog schema (samples' way) | Auto-accurate, DRY | ~8k (32 KB schema) | Risky — raw schema can swamp a small model | None | ❌ for our model/transport |
| 3. Derive a compact reference from the schema | Auto-accurate, DRY + concise | ~few hundred | Best | A schema→text generator to build + maintain | ❌ YAGNI now |

**Why 1 over 2:** our transport is **in-browser BYOK on gpt-4o-mini**. A 32 KB schema costs ~8k tokens
on the *visitor's* key every call, and small models typically follow a tight curated reference better
than a raw JSON schema. The samples inject because the ADK automates it for capable server-side models —
not our situation. Revisit (2) if we move to a capable model.

**Why 1 over 3:** deriving a compact reference from `@a2ui`'s schema is the most elegant (DRY +
concise) but needs a schema→text generator to author and maintain. For a ~10-component catalog that
changes rarely, that's premature (YAGNI); revisit if drift bites or the catalog churns.

**Also out** (unchanged from #138): strictening `ui/src/agent/contract.ts` to mirror `@a2ui`'s
per-component schema duplicates it (DRY); `experimental_repairToolCall` only validates our *loose*
tool schema, so it catches nothing here.

## Consequences

- The curated reference is **hand-maintained** → re-check it on `@a2ui` major bumps. This is the
  accepted cost of option 1.
- Failures stay **visible, not silent**: `@a2ui` validates at render and `applyA2UIEvent` surfaces any
  schema error in the event log (#127), so prompt/catalog drift shows up immediately.
- If gpt-4o-mini still mis-shapes components often, escalate to (3) a derived reference, or add an
  output-validation/repair step (mirroring the samples' `parse_response`).

## References

- A2UI catalog schema: `@a2ui/web_core/.../v0_8/schema/common-types.js`
- Render pipeline: [architecture.md][architecture] ("A2UI render pipeline") · [ADR-0001][adr-0001]
- `a2ui-project/a2ui` samples (ADK schema injection + `parse_response` validation)

[user-stories]: ../UserStory.md
[adr-0001]: 0001-agent-runtime-stack.md
[architecture]: ../architecture.md
