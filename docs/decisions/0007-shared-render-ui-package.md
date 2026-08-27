---
title: ADR-0007 — Shared render_ui prompt/contract package (#211)
description: Decision to extract worker/ and ui/'s byte-identical prompt text and duplicated cycle-detection graph algorithm into a new zero-dependency shared/ package, consumed via a file: dependency — and to keep it dependency-free after measuring that a shared package's own zod install gets bundled as a duplicate copy through wrangler's symlink resolution, rather than deduping against the consumer's.
---

# ADR-0007 — Shared `render_ui` prompt/contract package

**Status:** Accepted (2026-08-27)
**Relates to:** [ADR-0005][adr-0005] (agent-native endpoints, same Worker) · [ADR-0006][adr-0006]
(trial tier, same Worker) · plan 013's Wave 2 (originally scoped, deferred pending #210)

## Context

`worker/src/agent/{prompts,contract}.ts` and `ui/src/agent/{prompts,contract}.ts` were built
independently and had partially converged, partially diverged. Verified by direct file comparison
(not assumption): `SYSTEM_PROMPT` and `RENDER_UI_TOOL_DESCRIPTION` were byte-for-byte identical
strings in both; the cycle-detection graph algorithm (`extractChildIds`/`hasCycle`/graph-building)
was near-identical duplicated logic. Everything else had genuinely, correctly diverged — worker's
`validateBatch` stays dependency-free and narrower (no Card-shape/envelope checks, since it only
guards a deterministic-stub fallback); ui's `A2UIMessageBatchSchema` is the full zod contract with
Card-shape validation, message envelopes, and Recording/DecisionTree schemas worker has no use for.

## Decision

A new `shared/` package (`@agenthud/shared`) holds only the byte-identical prompt strings and the
pure cycle-detection primitive (`extractChildIds`, `buildGraph`, `hasCycle`). Both `worker/` and
`ui/` consume it via `"@agenthud/shared": "file:../shared"` — resolves through `node_modules` like
any other dependency, so neither consumer's `tsconfig.json`/`eslint.config.js` needed widening past
its own directory (the alternative — raw relative imports crossing package boundaries — would have
required that on both sides).

**`shared/` is deliberately dependency-free — including no zod, despite both consumers already
having it.** This was NOT the original design: the first implementation also moved a
`RenderUiInputSchema` zod schema into `shared/`, letting worker derive its JSON-schema tool
`parameters` via zod's native `z.toJSONSchema()` instead of hand-maintaining a duplicate shape.
Measured this session: this added **+80 KiB gzip to the worker bundle** (175 KiB → 255 KiB, a 46%
increase) — verified via `wrangler deploy --dry-run` before and after, isolating the cause by
reverting just the `z.toJSONSchema()` call (no size change — ruled out) and then confirming a
second, physically separate copy of `zod` existed at
`worker/node_modules/@agenthud/shared/node_modules/zod` (`test -d`, confirmed present).

**Root cause**: `shared/`'s own `devDependency` install of zod (needed for `shared/`'s own
standalone tests) sits at `shared/node_modules/zod`. `@agenthud/shared` is a **symlink** inside
`worker/node_modules` pointing at the real `shared/` directory. When wrangler's esbuild-based
bundler follows an import from `shared/src/renderUi.ts` through that symlink, Node's module
resolution walks up from the file's **real** path — finding `shared/node_modules/zod` before it
would ever reach `worker/node_modules/zod` — so the bundler sees two distinct physical `zod`
packages and bundles both. This is the exact class of problem npm workspaces solve (proper
hoisting/deduplication across local packages); a bare `file:` dependency does not.

**Rejected fix: adopt npm workspaces to get proper deduplication.** Would touch both CI jobs, both
lockfiles, and the deploy pipeline — for a fix whose actual payload (once dependency-free) is ~120
lines of shared code. The measured bug is a symptom of the `file:`-dependency approach being
disproportionate to a bigger structural change, not a reason to make the bigger change; making
`shared/` need nothing to dedupe sidesteps the whole problem class at near-zero cost.

**Consequence**: the "derive worker's tool schema from one zod schema" idea (a stretch goal added
to this arc's scope, beyond the core deduplication) is dropped. `RENDER_UI_TOOL.parameters` stays
hand-written in `worker/src/agent/prompts.ts` — a small (~6-line), rarely-changing JSON-schema
object that was never actually duplicated with ui/ in the first place (ui's AI-SDK tool schema
`{messages: A2UIMessageBatchSchema}` is deliberately richer and was correctly left untouched too —
forcing it to the loose shared shape would have removed real AI-SDK-level validation ui currently
gets for free).

| Option | Dedup payload | New infra | Verdict |
|---|---|---|---|
| **`file:` dep, zero-dependency shared package (chosen)** | prompts + cycle-detection | none | ✅ |
| `file:` dep, shared package depends on zod | + tool-schema derivation | none | ❌ measured +80 KiB gzip regression |
| npm workspaces | anything, cleanly | new lockfile/CI/deploy wiring | ❌ disproportionate to current payload size |
| Drift-detection test only, no code sharing | none (detects, doesn't prevent) | none | ❌ weaker fix, considered and rejected earlier this session |

## Consequences

- First cross-package dependency in this repo. Precedent for future sharing: **keep shared packages
  dependency-free until there's a proven need AND a workspace-aware bundler setup** to dedupe
  correctly — don't repeat this session's zod mistake.
- `worker/src/agent/contract.ts`'s `buildBatchGraph` and `ui/src/agent/contract.ts`'s
  `buildComponentGraph` both now call `@agenthud/shared`'s `buildGraph`/`hasCycle` — each side still
  owns its own message-walk (worker also tracks `beginRendering.root`; ui's messages are zod-typed),
  since that part was never actually identical between them.
- Both existing test suites (`worker/test/contract.test.ts`, `ui/tests/contract.test.ts`) pass
  unmodified — they test through the public `validateBatch`/`A2UIMessageBatchSchema` wrapper, not
  the internals, confirming the refactor is behavior-preserving. `shared/test/renderUi.test.ts` is
  new, TDD Red-first, covering the primitive directly.
- Bundle size verified via `wrangler deploy --dry-run` before/after: 174.96 → 175.03 KiB gzip
  (negligible, expected — code moved, didn't grow).

## References

- `shared/src/renderUi.ts` (the shared module) · `shared/test/renderUi.test.ts`.
- `worker/src/agent/{prompts,contract}.ts`, `ui/src/agent/{prompts,contract}.ts` (consumers).
- `worker/package.json`, `ui/package.json` — `"@agenthud/shared": "file:../shared"`.

[adr-0005]: 0005-agent-native-endpoints.md
[adr-0006]: 0006-trial-key-quota.md
