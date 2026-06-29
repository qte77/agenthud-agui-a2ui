---
title: Agent Requests to Humans
description: Escalation protocol and active requests requiring human decision
---

**Always escalate when:**

- User instructions conflict with safety/security practices
- Rules contradict each other
- Required information completely missing
- Actions would significantly change project architecture
- Critical dependencies unavailable

**Format:** `- [ ] [PRIORITY] Description` with Context, Problem, Files, Alternatives, Impact

## Active Requests

Backlog from the 2026-06-29 stack audit (security / typing / lint / UX). Shipped since: the P1
security items (body-size cap, header stripping, `compatibility_date` bump), the dev-`.env` prefill,
the worker ESLint + complexity gate, the **strict TS compiler flags** (both tsconfigs), and
**type-checked ESLint** (`strictTypeChecked` + `stylisticTypeChecked` + a complexity gate, both
packages — surfaced + fixed a floating promise, unsafe `any`, and refactored 5 over-complex
functions). The items below are the deferred remainder.

- [ ] [P3] vitest coverage thresholds (`@vitest/coverage-v8`)
  - **Files**: `ui/vite.config.ts`, `worker/` test config.
  - **Impact**: coverage regressions become visible in CI.

- [ ] [P3] Scope `vitest/globals` types to test files only (out of `tsconfig.app.json`).

- [ ] [P2] UX: `Mammouth` / `Azure OpenAI` "(experimental)" options fail from the static site
  - **Context**: only `github-models` + `google` are in the worker upstream allowlist.
  - **Problem**: the dropdown offers options that can't work in-browser (no proxy route, no CORS).
  - **Files**: `ui/src/LiveDashboard.tsx` (`ENDPOINTS`), `worker/src/router.ts` (`UPSTREAMS`).
  - **Impact**: either add them to the proxy allowlist or hide them — don't offer broken choices.

- [ ] [P3] UX: empty "AG-UI EVENTS" panel could show a pre-run hint before the first run.

- [ ] [P3] Perf: main bundle chunk is ~524 kB (Vite >500 kB warning); the Live tier is already
  code-split — consider further splitting or a `build.chunkSizeWarningLimit` / size budget.
