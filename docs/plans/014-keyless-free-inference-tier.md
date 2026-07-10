---
title: Plan 014 — US-6 keyless free-inference tier (ldnmxx-style server chain + Turnstile)
description: Give agenthud's worker a keyless "Free (no key)" render tier — the worker runs free models server-side (Workers AI → OpenRouter `:free`) so visitors need no key. Answers the long-deferred US-6 keyless variant with a security-first design (free-ids-only + Turnstile). Carries a self-contained TWO-REPO source map (agenthud target + ldnmxx-hack port source, file:line) so the next session executes without re-mapping.
date: 2026-07-10
status: planned
issues: [187, 211]
handoff: handoffs/014-keyless-free-inference-tier.md
---

# Plan 014 — US-6 keyless free-inference tier (ldnmxx-style server chain + Turnstile)

Two TDD'd PRs + a deploy step. Plan-mode already done (this doc). Strict TDD Red-first for the pure
kernel + event-synth ONLY; **no unit tests** for wiring/config/UI/wrangler (verify by build/E2E).

## Context

agenthud is **BYOK**: the worker (`worker/`) is a passive CORS proxy holding **no secret**; the visitor
brings their own key. ldnmxx-hack instead runs free models **server-side** with its own keys, so visitors
need **no key** — the US-6 "keyless" variant, **deliberately deferred** in agenthud for "abuse/secret
surface". The user chose to build it now, ldnmxx-style, **with Cloudflare Turnstile in the launch**.
Outcome: a zero-setup "try it, no key" demo, worst-case cost **$0** (free model ids only), with the
Origin-spoof drain (which our own `worker/README.md:55-57` documents) closed by Turnstile.

**Answering the recorded deferral** (quote these when updating docs):
- `docs/UserStory.md:119` (+ `:204`), `worker/README.md:61`: keyless deferred — "abuse/secret surface".
- `docs/decisions/0001-agent-runtime-stack.md:48-50,:60-61`: keyless deferred (YAGNI) to an optional worker.
- `docs/decisions/0002-edge-proxy-platform.md:49-52`: "a browser-called proxy **cannot hold a secret**
  (visible in the network tab); the only real locks are an origin allowlist … an optional API key …
  rate limiting."
- **Rebuttal for the ADR amendment:** ADR-0002's "visible in the network tab" applies to a *browser-held*
  key. A `wrangler secret put` key **never transits the browser**, so the "secret surface" reduces to
  log/response hygiene. The "abuse surface" is answered by the must-have set below — exactly the ADR's
  anticipated "optional API key" slot, realized as **free-ids-only + Turnstile**.

## Architecture (Option B — server chain; one-shot JSON batch)

```
Browser "Free (no key)" mode                      Worker  POST /agent/render
  Turnstile widget → token                          1. reuse gates: CORS / OPTIONS / POST / origin / RATE_LIMITER
  POST {messages, turnstileToken}          ─────▶    2. verifyTurnstile(token) via siteverify else 403
  synth AG-UI events from the JSON reply   ◀─────    3. tight per-IP FREE_RATE_LIMITER (≤20/60s)
    RUN_STARTED → TOOL_CALL_START →                  4. small prompt cap + parse {messages}; ignore client model
    TOOL_CALL_END(a2uiMessages) → RUN_FINISHED       5. renderFree(buildProviders(env)): WorkersAI → OpenRouter :free
    (RUN_ERROR on failure)                           6. validate batch (self-contained + acyclic)
                                                      7. return {a2uiMessages} | deterministic stub | error JSON
```

One-shot JSON (not ldnmxx's SSE) — the render is atomic anyway (`SurfaceSkeleton` covers the wait), and
`applyA2UIEvent` re-validates any batch regardless of source, so turn-memory/snapshot/#209 pager/transcript
all work **unchanged**. The worker owns the multi-provider fall-through, so the browser's `candidateModels`
loop is bypassed in keyless mode.

## Security must-haves (all in the launch)

1. **Free-ids-only, enforced in code** (primary, $0 ceiling): reject any model id not ending `:free`
   (Workers AI is inherently free); **ignore** any client-supplied model. ldnmxx has this by list-convention
   only — we add an `assertFreeId` guard.
2. **Turnstile**: widget on the page (Free mode only), server-side `siteverify` before any model call.
3. **Tight per-IP limit** for `/agent/render`: a **second** `[[ratelimits]]` namespace (`FREE_RATE_LIMITER`,
   ≤20/60s) — the existing 100/60s is sized for BYOK relay.
4. **Bounded per-call**: prompt-byte cap well under 1 MiB, `max_tokens` ceiling, one 20s `AbortController`,
   deterministic **stub** on total failure ("demo never breaks").
5. **Key hygiene**: secrets via `wrangler secret put` only; key lives solely in the upstream `authorization`
   header — never in a response, transcript, error, or `console.*` (observability logs 100%, `wrangler.toml:16-25`).

**Policy tension (flag in the ADR):** Turnstile's widget script loads from `challenges.cloudflare.com`,
conflicting with the repo's self-host / zero-external-request stance. Mitigation: the script loads **only
in the opt-in Free mode** (Demo/BYOK stay script-free); documented as a scoped exception. No self-hostable
proof-of-human equivalent exists. (Skill `turnstile-spin` is available to create the widget + siteverify worker.)

---

## 🗺️ Source map — ldnmxx-hack (PORT SOURCE) · `/workspaces/qte77/ldnmxx-hack/`

**Pure kernel to lift (fetch-only / dep-light — port near-verbatim, adapt env):**
- `worker/src/agent/providers.ts` — `Provider{name,tryRender}` iface; `renderFree`/`runChain` (:134-151,
  first-valid-wins → `{result, provider}|null`); `buildProviders(opts)` (:154-168, cheapest-first, **skips
  absent tiers**: WorkersAI if `env.AI` :163 → OpenRouter `:free` if `OPENROUTER_KEY` :164-165 → GitHub
  Models :166 [DROP — retired 2026-07-30]); `openRouterFreeProvider` (:109-122, walks the `:free` model
  list, logs fall-through); `workersAiProvider` (:72-104, `env.AI` binding — **`.bind(ai)` gotcha :77-81**:
  a detached `.run()` throws, private fields); `DEFAULT_OPENROUTER_FREE_MODELS` (:29-36, all `:free`);
  `RENDER_SPEC` (:45-50); `asRender` adapter (:67-68).
- `worker/src/agent/model.ts` — `callModelTool` (:72-120, `fetch ${baseURL}/chat/completions`, `authorization:
  Bearer <projectKey>`, body `{model, messages:[{system},{user}], tools:[RENDER_UI_TOOL],
  tool_choice:{type:function,function:{name:render_ui}}, temperature:0.2, max_tokens:8000}` :81-91);
  `extractToolArgs` (:39-47, name===render_ui, args JSON-string, `args.messages` array); `extractBatch`
  (:50-53); shapes `ModelToolResult`/`ModelResult` (:17-28); `ToolSpec` (:62-67); **fail→null** on non-OK
  HTTP (:94-97) / no-tool (:100-103) / invalid (:104-107) / throw (:117-119).
- `shared/renderTool.ts` — `RENDER_UI_TOOL` (:6-18, JSON schema); `isSelfContainedBatch` (:22-51, dep-free,
  **no cycle check** — agenthud's zod is stronger; use agenthud's lifted cycle-check instead, see below).
- `shared/guard.ts` — `detectInjection`/`PATTERNS` (:13-38) — OPTIONAL nicety (forces stub on flagged
  prompt), NOT a spend control; port only if cheap.

**Handler orchestration (rework — Cloudflare-coupled, do NOT copy wholesale):**
- `worker/src/worker.ts` — `resolveRun` (:148-192, freeChain only when no BYOK key + no forced stub :172);
  `freeChain(env)` (:109-123); `renderBatch` (:56-89, one 20s `AbortController` :65-66, `renderFree` :82-85,
  **stub on any failure** :63-64,78-85 — "demo can never break"); handler (:289-348, rate-limit :303-307);
  response is **SSE** (:330-346) — agenthud will use one-shot JSON instead.
- `worker/wrangler.toml` — `[ai] binding="AI"` (:22-23); `[[ratelimits]] RATE_LIMITER` (:16-19). Secrets/vars
  (via `wrangler secret put`): `OPENROUTER_KEY`, `OPENROUTER_FREE_MODELS` (csv override), Arize (SKIP).
- Client contract (reference only): `ui/src/agent/useAgentSSE.ts` — `runWorkerPath` (:120-139) POSTs
  `${WORKER_BASE}/run?usecase=` body `{prompt, model}`, no key; `parseSSE`/`readSSE` (:34-95).

**Skip (ldnmxx-only infra):** Arize OTLP tracing (`worker/src/trace/arize.ts`, `/trace` endpoint), usecase
choreography JSON, card builders/stub source (`worker/src/a2ui/cards.ts` — agenthud writes its own stub). No KV/DO.

## 🗺️ Source map — agenthud (TARGET) · `/workspaces/qte77/agenthud-agui-a2ui/`

**Worker seam:**
- `worker/src/worker.ts` — fetch handler gate order (:66-95): CORS `corsHeaders` :68-69, OPTIONS :71,
  POST-only :72-74, origin `isAllowedOrigin` :76 (→403), `RATE_LIMITER` :80-86 (key=`cf-connecting-ip` :81),
  `resolveUpstream` :88, `readCappedBody` :91-92 (`MAX_BODY_BYTES` :6, 413 :18), `forwardToUpstream` :26-60
  (fwd only auth+content-type :33-36, strip cookies/hop-by-hop :50-53, stream back :54-59). **⇒ Insert the
  keyless branch AFTER :86 (rate-limit passed), BEFORE :88 (`resolveUpstream`)** — inherits gates 1-5.
- `worker/src/router.ts` — `Env` iface (:23-30: `ALLOW_LOCALHOST?` :27, `RATE_LIMITER?` :29) → **add**
  `OPENROUTER_KEY?`, `AI?: Ai` (type from `@cloudflare/workers-types`, already a devDep), `TURNSTILE_SECRET?`,
  `FREE_RATE_LIMITER?`; `UPSTREAMS` (:4-6, google only); `resolveUpstream` (:9-15); `PROD_ORIGINS` (:34,
  `^https://qte77.github.io$`); `isAllowedOrigin` (:47-49); `corsHeaders` (:52-61, already allows content-type
  :57); `RateLimit` iface (:18-20, reuse for FREE_RATE_LIMITER).
- `worker/wrangler.toml` — name/main :4-5, compat_date :8, `[[ratelimits]] RATE_LIMITER` (ns 1001, 100/60s)
  :30-36, `[env.dev.vars] ALLOW_LOCALHOST` :42-43. **Add** `[ai] binding="AI"`, a 2nd `[[ratelimits]]`
  (FREE_RATE_LIMITER, tighter), and mirror both under `[env.dev]` (**named envs don't inherit bindings** —
  `wrangler.toml:29`). Secrets stay OUT of the toml.
- `worker/test/{router,worker}.test.ts` — patterns: pure-fn unit tests (router.test.ts); handler tests with
  `post()` factory (allowed origin baked in), `worker.fetch(post(...), {env})`, upstream mocked via
  `vi.stubGlobal("fetch", vi.fn())` + `afterEach(vi.unstubAllGlobals)`.

**Reuse from ui/src (lift the dep-free cycle-check into the worker — this is #211's smallest step):**
- `ui/src/agent/contract.ts` — `A2UIMessageBatchSchema` (:142-146); **dep-free plain-TS** `extractChildIds`
  (:87-104), `buildComponentGraph` (:107-116), `hasComponentCycle` (:119-139) → copy into
  `worker/src/agent/contract.ts` as the worker validator (self-contained + acyclic; stronger than ldnmxx's
  `isSelfContainedBatch`). Schemas at :23-72.
- `ui/src/agent/prompts.ts` — `SYSTEM_PROMPT` (:18-46, ~3.5 KB) + `RENDER_UI_TOOL_DESCRIPTION` (:14-16) →
  copy into `worker/src/agent/prompts.ts` (worker OWNS the prompt — never trust a client-sent system prompt
  on a keyless endpoint). DRY seam for #211.

**Browser seam:**
- `ui/src/agent/liveAgent.ts` — `LiveSettings{baseURL,apiKey,model}` (:13-17); `runLiveAgent` (:94-125,
  `createOpenAI` :100-103, `streamText` forced `toolChoice:render_ui` :115 + `stepCountIs(1)` :116, fullStream
  loop :121-124); **`streamPartToEvent` (:48-74) = the exact 4-event shapes to SYNTHESIZE**; `toConnectionError`
  (:33-40); comment "runnable on an edge worker" (:91-93).
- `ui/src/agent/useLiveAgent.ts` — `stream()` (:52-129); the `runLiveAgent` call site (:84-99) = **branch
  point**: keyless → `runKeylessAgent` (skip candidate loop :61,66-118); `run`/`followUp`/`sendAction`/
  `sendMessage` (:131-165, settings passed per-call — no plumbing change).
- `ui/src/agent/fallback.ts` — `candidateModels`/`classifyFailure` (browser fall-through; bypassed in keyless).
- `ui/src/agent/applyA2UIEvent.ts` — `AgentEvent` (:14-19), `applyA2UIEvent` (:66-106, re-validates :79),
  `appendLogEntry` (:114-125) — **reused unchanged** by the synthesized events.
- `ui/src/LiveDashboard.tsx` — sessionStorage `"agenthud-byok"` :16; `loadSettings` :38-46; `patchSettings`
  :179-193 (persists only baseURL+model); **`connectionReady` :196-198 (requires `apiKey` — RELAX for keyless)**;
  provider `<select>` :224-240 (driven by ENDPOINTS, selection from baseURL :201-202); **API-key input :250-257
  (HIDE in free mode)**; `ModelPicker` :263-273; settings→hook at :175/:292/:373; badge :344-348; `SurfaceSkeleton`
  pending :83-85,:367.
- `ui/src/config.ts` — `Endpoint` iface (:27-32 → **add** `keyless?: boolean`); `ENDPOINTS` (:34-87 → **add**
  `{label:"Free (no key)", baseURL:`${PROXY_BASE}/agent/render`, keyless:true}`); `PROXY_BASE` (:12-15).

**Security refs (from research):** Origin-spoof documented at `worker/README.md:55-57`; deferral rationale
quotes above; observability 100% sampling `worker/wrangler.toml:16-25`.

---

## PR1 — `feat/worker-keyless-freechain` (worker; TDD-heavy)

New/changed `worker/src/`:
- `agent/model.ts` — `callModelTool`/`extractToolArgs`/`extractBatch` (port; capped `max_tokens`). **Red-first.**
- `agent/providers.ts` — `Provider`/`renderFree`/`runChain`/`buildProviders` + `workersAiProvider(env.AI)` +
  `openRouterFreeProvider(env.OPENROUTER_KEY)` + `DEFAULT_OPENROUTER_FREE_MODELS` + `assertFreeId`. **Red-first**
  (first-valid-wins, all-fail, skip-absent-tier, assertFreeId rejects non-`:free` + client paid id).
- `agent/contract.ts` — dep-free self-contained+acyclic validator (lift from ui contract.ts:87-139). **Red-first.**
- `agent/prompts.ts` — copied SYSTEM_PROMPT + RENDER_UI_TOOL (no test — data).
- `turnstile.ts` — `verifyTurnstile(token, secret, ip)` → siteverify. **Red-first** (mock fetch: pass/fail/expired).
- `worker.ts` — `if (pathname==="/agent/render") return handleKeylessRender(...)` after :86/before :88;
  Turnstile → FREE_RATE_LIMITER → capped `{messages}` → `renderFree` under 20s abort → `{a2uiMessages}` | stub |
  structured error. Integration tests (mirror worker.test.ts; env `{OPENROUTER_KEY, AI:{run:vi.fn()}, TURNSTILE_SECRET}`;
  **assert key never echoed**).
- `router.ts` — extend `Env`. `wrangler.toml` — `[ai]`, 2nd ratelimit, `[env.dev]` mirror.

## PR2 — `feat/live-keyless-mode` (browser + docs; wiring → E2E)

- `ui/src/agent/keylessAgent.ts` — `runKeylessAgent(messages, token, onEvent)`: POST `${PROXY_BASE}/agent/render`,
  synth `RUN_STARTED → TOOL_CALL_START → TOOL_CALL_END(a2uiMessages) → RUN_FINISHED` / `RUN_ERROR`. **Pure
  event-synth Red-first** (mirror streamPartToEvent); fetch wiring not tested.
- `ui/src/agent/useLiveAgent.ts` — branch `stream()` at :84 → keyless path.
- `ui/src/config.ts` — `keyless?` field + Free entry; `VITE_TURNSTILE_SITE_KEY` (public).
- `ui/src/LiveDashboard.tsx` — Free mode: relax `connectionReady`, hide key input, render Turnstile widget,
  **fresh token per turn** (single-use / short-TTL → re-execute the widget before each Run/composer submit);
  mode-aware badge.
- Turnstile widget component (Free-mode-only external-script loader).
- Docs: CHANGELOG `Added`; `docs/UserStory.md` US-6 → keyless **delivered** (criterion 1); **new ADR**
  (keyless secret+abuse model + Turnstile self-host exception); `docs/architecture.md` new keyless flow box.
  Close #187 (reopen first) or a new keyless issue.

## Deploy step (post-merge, authenticated — user runs)

`wrangler secret put OPENROUTER_KEY` + `TURNSTILE_SECRET` (prod **and** `--env dev`); create the Turnstile
widget (`turnstile-spin` skill → site key into `ui/.env`/CI, secret into the worker); `set -a; . worker/.env;
set +a; wrangler deploy --cwd worker`. Deploy recipe + token auth already in `worker/.env`.

## Verification

- **Unit (Red-first):** `cd worker && npm test` — renderFree first-valid/all-fail→stub/skip-absent;
  assertFreeId rejects non-`:free` + client paid; extractBatch on tool-call shapes; acyclic/self-contained
  validator; Turnstile verify (mocked). `cd ui && npm test` — the event-synth reducer.
- **Gates both packages:** `typecheck && lint && test && build` green; strict lint / `exactOptionalPropertyTypes`;
  grep the key never appears in any response/log path.
- **Endpoint (pre-UI):** `curl -X POST …/agent/render` — valid mock token → batch; bad/absent token → 403;
  non-`:free` model → rejected; oversized body → 413; spoofed Origin + no token → 403.
- **E2E (patchright, after deploy — dev on :5174, note the stale ldnmxx server may hold :5173):** Free mode →
  Turnstile solves → Run → `.a2ui-surface .qte-card` renders, 0 console errors, **key absent from network/DOM**;
  force provider failure → deterministic stub, not a crash.

## Constraints / workflow

Branch per PR off `main`; **strict TDD Red-first** for the pure kernel + event-synth (user checks Red);
**no unit tests** for wiring/config/UI/wrangler. KISS/DRY/YAGNI. Conventional commits; push + PR with
`env -u GH_TOKEN -u GITHUB_TOKEN`; **user merges** (agent PR-merge blocked). Deploy is a separate
authenticated step the user runs. Relationship to #211: the worker's dep-free validator + copied prompt are
the seams #211 will later unify into `@qte77/a2ui-agui`.
