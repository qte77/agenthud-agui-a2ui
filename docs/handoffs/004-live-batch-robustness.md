---
date: 2026-06-30
status: done
issues: [129]
plan: plans/004-live-batch-robustness.md
title: Handoff 004 — Live batch robustness
description: Surfaced contract violations in the event log + tightened the live prompt (one complete call, no empty arrays).
---

# Handoff 004 — Live batch robustness

> **Shipped 2026-06-30.** Live A2UI failures are no longer silent, and the prompt steers gpt-4o-mini
> toward one complete `render_ui` call without empty arrays.

## What changed

- `ui/src/agent/applyA2UIEvent.ts` — a batch that fails our contract now writes a concise
  "A2UI contract violation (skipped): …" into the event-log entry (Red-tested), instead of a silent
  `console.warn` + blank surface.
- `ui/src/agent/liveAgent.ts` — `SYSTEM_PROMPT`: one complete `render_ui` call; define every
  referenced id; never leave `children`/`tabItems`/`components` empty.
- `CHANGELOG.md` — `### Fixed` bullet.

## Verify

```bash
cd ui && npm run typecheck && npm run lint && npm test   # 65 tests
```

By effect — after deploy, live E2E (patchright via `../polyfetch-scrape/.venv`, `.env` BYOK key,
GitHub Models): rich prompt should fail less often, and any remaining failure shows a
"contract violation" or "render error" line in the AG-UI log (no silent blank).

## Open / next

- **gpt-4o-mini variance** on rich UIs is a model limit, not a bug — simple/moderate UIs render
  reliably. A stronger model would be more consistent. If reliability matters more, the next lever is
  an output-validation/repair step (mirroring the official samples' `parse_response`) or `@a2ui`
  schema-as-tool-inputSchema for a capable model (see [ADR-0003][adr-0003]).

## Pointers

- Plan: [plans/004-live-batch-robustness.md][plan-004] · Seam: `ui/src/agent/applyA2UIEvent.ts`

[plan-004]: ../plans/004-live-batch-robustness.md
[adr-0003]: ../decisions/0003-live-catalog-instruction.md
