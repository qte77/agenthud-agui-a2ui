---
title: Plan 015 — Live-path render hardening + re-baseline
description: Code/file/source map + open threads for the BYOK live A2UI render path, for an unattended next session. Verified working E2E; remaining work is small-model reliability.
date: 2026-07-25
status: closed
issues: [129]
handoff: handoffs/015-live-render-hardening.md
successor: plans/016-live-variance-and-responsive.md
---

> **Closed 2026-07-25.** Open thread #1 was verified by effect and resolved — see
> "E2E outcome" below. The remainder moved to [plan 016][p016].

# Plan 015 — Live-path render hardening + re-baseline

**For the next (unattended) session.** A prior session operated on a stale view (thought it was at
~#144); the real tree is at ~#220 / plan-014. **Re-baseline first** (`git fetch && git log`), then
use this map. The live BYOK path was verified rendering **end-to-end on gh-pages** (real GitHub
Models run painted a card); remaining work is small-model *reliability*, not correctness.

## Working agreement (per owner)
- **Strict TDD:** model the expected/desired behavior as a FAILING test FIRST (Red) → minimal impl
  (Green) → refactor. **Only non-trivial tests, only for modules** — not for prompt text, recordings,
  config, or simple scripts (verify those *by effect*: render / build / E2E).
- Strict lint + typing + security. One topic per branch; commit by topic; push + **squash-merge only
  if all CI + tests pass**; delete stale remote+local branches. `unset GH_TOKEN GITHUB_TOKEN` for
  push/PR/merge; branch off fresh `origin/main`.
- Goal: **long-running, hands-off, unattended e2e** — decide-by-default, self-verify each item.

## Per-milestone discipline (after every merged PR / major milestone)
1. **Progress report (concise):** what **shipped** · what's **next** · **overall % of this plan** ·
   **blocked/deferred** (+ what's pre-staged for each).
2. **Docs audit — update if affected:** CHANGELOG · root README · `docs/architecture.md` · ADRs
   (`docs/decisions/`) · roadmap · `docs/UserStory.md` · registries. Confirm **URL / env / CLI
   switches** are documented (README tables + CHANGELOG): `PROXY_BASE` in `ui/src/config.ts`, env in
   `ui/.env.example`, CLI (`wrangler deploy`, `compatibility_date`, `ALLOW_LOCALHOST`) in
   `worker/README.md` + `docs/cloudflare-runbook.md`.
3. **Issues:** open/update/close as warranted — close shipped features; advance (never auto-close)
   multi-item trackers; keep plan + handoff + memory in sync.

## Code / file / source map — live render pipeline (model → components)

Flow: **Run → model tool call → A2UI batch → AG-UI events → validate → `@a2ui` tree → paint.**

| Stage | File · symbol | Notes |
|---|---|---|
| Run trigger | `ui/src/LiveDashboard.tsx` (composer `<form>`) → `useLiveAgent.run()` | Settings in the sidebar `asidePanel` (`DashboardShell.tsx`). |
| Model call | `ui/src/agent/liveAgent.ts` · `runLiveAgent` | Vercel AI SDK `streamText`, `createOpenAI({baseURL,apiKey})`, one tool `render_ui` (`buildRenderUiTool`), `stopWhen: stepCountIs(3)`. |
| Prompt/tool text | `ui/src/agent/prompts.ts` · `SYSTEM_PROMPT`, `RENDER_UI_TOOL_DESCRIPTION` | Hand-curated catalog reference (ADR-0003). Already covers: one-call, typed literals, root-id=top, no-empty-arrays, `dataModelUpdate` for path-bound CheckBox/Slider, `asset:` URLs, acyclic-tree rules. |
| Stream → events | `ui/src/agent/liveAgent.ts` · `streamPartToEvent` | `tool-call render_ui` → `TOOL_CALL_END` with `a2uiMessages = part.input.messages`; `error` → `RUN_ERROR` via `toConnectionError`. |
| Contract + render seam | `ui/src/agent/applyA2UIEvent.ts` · `applyA2UIEvent` | Validates vs `A2UIMessageBatchSchema`; **surfaces contract violations AND render throws in `entry.text`** (already done). `summarizeA2UI`, `appendLogEntry` (coalesces text deltas). |
| Our contract | `ui/src/agent/contract.ts` · `A2UIMessageBatchSchema`, `A2UIComponentSchema` | Loose envelope + `Card.child`. Deliberately NOT a full per-field mirror (DRY; ADR-0003 / see #138). |
| Live wiring | `ui/src/agent/useLiveAgent.ts` | `render = useA2UIActions().processMessages`; `run` → `onEvent → applyA2UIEvent`. |
| Render target | `ui/src/A2UISurface.tsx` | `initializeDefaultCatalog()` + `<A2UIProvider>` + `<A2UIRenderer surfaceId="main">`. |
| Proxy config | `ui/src/config.ts` · `PROXY_BASE`, `ENDPOINTS`, `REPO_URL` | `worker/src/router.ts` = CORS allowlist + `UPSTREAMS` (github-models, google). |

**`@a2ui` ground truth (the real validator):**
- Component schemas: `ui/node_modules/@a2ui/web_core/src/v0_8/schema/common-types.js` — Button `{child,action:{name}}`, Image `{url:StringValue,usageHint}`, Slider `{value:{literalNumber|path},minValue,maxValue:number}`, Tabs `{tabItems:[{title,child}]}`, CheckBox `{label,value:{literalBoolean|path}}`, `exactlyOneKey` refine, `explicitList` XOR `template`.
- Value resolvers: `@a2ui/react/chunk-*.js` · `resolveString/Number/Boolean` accept `literalString|literalNumber|literalBoolean` (+ lenient bare `literal`) and `path`.
- **We use the v0.8 default export**, NOT v0.9 (`@a2ui/react/v0_9`). `@a2ui/react@0.10.1` ships v0.8 (`.`) + v0.9 only — no v1.0. (v0.9 migration = separate issue.)

## Verified working (this arc, E2E)
Live GitHub Models run on gh-pages **paints** a card: connect → `render_ui` → typed-literal A2UI →
tree from `root` → `A2UIRenderer`. Zero NetworkError (old failure was client-side), zero render error
for well-formed batches. #129 closed on that basis.

## Open threads (do next, TDD where module-shaped)
1. **gpt-4o-mini variance on complex UIs** — sometimes multiple/partial `render_ui` calls or an empty
   required array despite the prompt. Prompt already mitigates (one-call, no-empty). *Verify by effect*
   (E2E), not a unit test. Escalation options if still flaky: derived-schema reference (ADR-0003 opt 3)
   or a `parse_response`-style repair — both bigger; propose before building.
2. **Re-verify against the real #220 tree** — confirm which of this arc's fixes (typed literals, root-id,
   catalog shapes, contract-violation surfacing) are already merged (they appear present) vs open.
3. Cross-check open GitHub issues (`gh issue list`) against plans 004–014 for anything unshipped.

## E2E verification method (unattended)
- Deployed URL `https://qte77.github.io/agenthud-agui-a2ui/`; footer badge = the live commit SHA.
- Headless: `/workspaces/qte77/polyfetch-scrape/.venv/bin/python` + patchright chromium. Toggle **Live**,
  select **GitHub Models (via proxy)**, fill key **from `ui/.env`** (`VITE_BYOK_API_KEY`, model
  `openai/gpt-4o-mini`) — read it in-script, never print it. Run a prompt; assert surface paints +
  zero `A2UI render error` in the AG-UI log. Capture the raw batch by intercepting the
  `.../chat/completions` response and reassembling `"arguments"` fragments. Temp scripts under
  `$CLAUDE_JOB_DIR/tmp`.
- Gates before push (from `ui/`): `npm run typecheck && npm run lint && npm test`. Local sandbox blocks
  pipes/compound bash + curl; use Read/node and the patchright venv.

## E2E outcome (2026-07-25, unattended)

Matrix: 6 runs, `openai/gpt-4o-mini` **via OpenRouter**, desktop 1440/1280 + mobile 390 (emulated),
3 prompts (simple card / tabbed settings panel / image gallery), asserting surface paint + zero
render errors + zero contract violations + zero app console errors + exactly one `render_ui` call.

- Baseline (stale deploy): **2/6**. After the fixes below (build `43b65a4`): **4/6**.
- **Thread #1 was misdiagnosed as model variance.** The failing batches were structurally complete —
  every referenced id present. @a2ui v0.8's `SurfaceUpdateMessageSchema` resolves child refs against
  *one* message's `components`, and the model split them across 2–4 `surfaceUpdate` messages. Fixed
  deterministically at the render seam (`coalesceSurfaceUpdates`, PR #239) — no prompt change, no
  derived-schema escalation, no repair step needed. Both ADR-0003 escalation options stay unspent.
- Invented `asset:` tokens (`asset:product1-image`) reached the DOM → `ERR_UNKNOWN_URL_SCHEME` +
  broken images; unknown tokens now fall back to an inline data-URI placeholder (same PR).
- Residual variance: 1 of 4 complex runs emitted **two** `render_ui` calls; the second batch failed
  our contract and was skipped — **the surface still painted** from the valid one, and the violation
  is visible in the event log. Graceful degradation, not a blank surface. Carried to plan 016.
- New defect, unrelated to rendering: the surface collapses to a ~10px sliver at 390px
  (`DashboardShell.tsx` fixed `w-96` aside) → #240. Carried to plan 016.

**Also unblocked en route:** `main` CI + the Pages deploy were red since the auto-merged TS 7 bump
(#223/#222) made `npm ci` unresolvable — so the site had been serving a stale build. PR #235.

**Note for future E2E:** the "GitHub Models (via proxy)" recipe in this plan was stale — that
provider and its worker upstream were removed (#165). Use OpenRouter (the `ui/.env` key) instead.

## References
- Pipeline prose: [architecture.md][arch] ("A2UI render pipeline") · ADR-0001/0002/0003
- Handoff: [handoffs/015-live-render-hardening.md][h015] · successor: [plan 016][p016]

[arch]: ../architecture.md
[h015]: ../handoffs/015-live-render-hardening.md
[p016]: 016-live-variance-and-responsive.md
