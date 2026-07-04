---
title: Plan 007 — Interactive live agent (onAction) + multi-column
description: Multi-col shipped (#159); the onAction MVP is unblocked (live-stream quirk RESOLVED); #140 v0.9 = major migration (stay v0.8). Carries a full source map so the next session need not re-explore.
date: 2026-07-04
status: in-progress
issues: [129, 156, 128]
handoff: handoffs/007-live-interactive-multicol.md
---

# Plan 007 — Interactive live agent + multi-column

## Status (2026-07-04)
- ✅ **PR 1 — multi-column** shipped (**#159 merged**, `main` @ `2d7a040`). Agent steering + the demo's
  filtered-results render 3 cards side by side. Render-verified.
- ✅ **#140 v0.9 watch — resolved**: v0.9 is a **major API redesign** (no `onAction`/`A2UIProvider`/
  `ComponentRegistry`) → **build on v0.8**. Recorded on issue #140.
- ▶️ **PR 2 — interactive buttons (onAction MVP)** — not started, **unblocked** (live-stream quirk RESOLVED, below).
- **Deferred:** full multi-turn, #128 (unify Demo/Live), speculative pre-render.

## Context

Rendered A2UI Buttons do nothing — `A2UISurface` mounts `<A2UIProvider>` with **no `onAction`** — and
the live agent is single-shot. PR 2 makes a button click drive **one follow-up agent turn** (the MVP).
Deliberately KISS: no unify (#128), no full conversation yet — those are separate, only-if-proven.

---

## 🗺️ Source map (so you don't re-gather context)

### Live-agent code path (all under `ui/src/`)
- **`App.tsx`** — `App()` = `<A2UISurfaceProvider><Root/></A2UISurfaceProvider>`. `Root()` branches
  `view === "demo" ? <DemoDashboard> : <Suspense><LiveDashboard>` (Live is `lazy()`-loaded).
- **`A2UISurface.tsx`** — `A2UISurfaceProvider` = `<A2UIProvider>{children}</A2UIProvider>` **(no
  `onAction` today)**; `A2UISurface` = `<A2UIRenderer surfaceId="main" />`; `initializeDefaultCatalog()`
  at module load. **← add `onAction` here.**
- **`agent/useLiveAgent.ts`** — hook. State: `eventLog`, `isRunning`, `error`, `abortRef`. `run(settings,
  prompt)` → `runLiveAgent(settings, prompt, onEvent, {signal})`, feeding each event through
  `applyA2UIEvent(event, ts, render)` → `setEventLog(prev => appendLogEntry(prev, entry))`. `render` =
  `processMessages(resolveAssets(messages))`. **← add `messages` history + `sendAction`.**
- **`agent/liveAgent.ts`** — `runLiveAgent(settings, prompt, onEvent, opts?)` calls
  `streamText({ model: openai.chat(model), system: SYSTEM_PROMPT, prompt, tools:{ render_ui },
  toolChoice:{type:'tool',toolName:'render_ui'}, stopWhen: stepCountIs(1) })`, then
  `for await (part of result.fullStream) onEvent(streamPartToEvent(part))`. `SYSTEM_PROMPT` already has
  the multi-col rule. **← switch `prompt` → `messages`.**
- **`agent/applyA2UIEvent.ts`** — the SHARED seam (replay + live). `applyA2UIEvent(event, ts, render)`
  safeParses `A2UIMessageBatchSchema`, renders, logs; `appendLogEntry` coalesces text deltas. **Reuse; don't touch.**
- **`agent/contract.ts`** — `A2UIMessageBatchSchema` (+ acyclic guard). **`agent/assets.ts`** —
  `resolveAssets` (asset:tokens). **`DashboardShell.tsx`** — shared chrome. **`LiveDashboard.tsx`** —
  owns `useLiveAgent`; the prompt composer + Run button. **← registers `sendAction` into the bridge.**

### `@a2ui/react` v0.8 API (from `node_modules/@a2ui/react/v0_8/index.d.ts` + `web_core/.../v0_8`)
- `A2UIProvider` props: **`onAction?: (message: A2UIClientEventMessage) => void | Promise<void>`**
  (`OnActionCallback`). Also `theme`, `children`.
- **Payload shape (exact):** `A2UIClientEventMessage.userAction?: UserAction`, where
  **`UserAction = { name: string; surfaceId: string; sourceComponentId: string; timestamp: string;
  context?: {…} }`**. → **action name = `message.userAction?.name`**; which button = `sourceComponentId`;
  bound data = `context`.
- Custom components (future, not PR 2): `ComponentRegistry.getInstance().register(type, { component })`
  (`component` may be a lazy `ComponentLoader = () => Promise<{default}>`); `A2UIRenderer` takes an
  optional `registry`. Catalog: Row/Column/List (`children.explicitList`), Card/Button (`child`), Tabs
  (`tabItems[].child`), + `AudioPlayer`, `Video`, `Modal`, `ChoicePicker`(v0.9 only), etc.
- **v0.9 (do NOT use for PR 2):** different exports — `A2uiSurface`, `basicCatalog`,
  `createComponentImplementation`, `DeferredChild`, Markdown — a render-layer rewrite. Separate migration.

---

## PR 2 — onAction MVP (#156, TDD)

**PREREQUISITE — SETTLED (2026-07-04).** A real-browser check on the deployed Live tab confirms the agent
**streams and renders**; the "no SSE parts observed" result was a sandbox-headless limitation, not a hang.
Root cause of the observed failures was a **stale model id (404)** + an **OpenRouter 402 no-credits**
response — config/account, not code. #147's `toolChoice:{type:'tool',…}` + `stepCountIs(1)` is
**unchanged** (not the cause). No agent-code change needed — build PR 2 directly.

**Implementation (KISS, v0.8, on the current tab structure — no unify):**
1. **`agent/conversation.ts` (new) — TDD Red-first** (`ui/tests/conversation.test.ts`):
   - `interface UserTurn { role: "user"; content: string }`
   - `actionToTurn(name: string): UserTurn` → `{ role:"user", content:\`The user clicked "\${name}" — update the interface accordingly.\` }`
   - `appendUserTurn(messages: UserTurn[], text: string): UserTurn[]` → immutable append.
   - Tests: action→turn contains the name; append is immutable + ordered; append to `[]` works.
2. **`AgentActionContext` (new, e.g. `agent/AgentActionContext.tsx`)** — bridge provider→agent without
   lifting state: a context whose value is a `useRef<(name:string)=>void | null>`. `AgentActionProvider`
   supplies the ref; **must wrap `A2UISurfaceProvider`** so `onAction` can read it.
3. **`A2UISurface.tsx`** — `A2UISurfaceProvider` consumes the context and passes
   `onAction={(m) => ref.current?.(m.userAction?.name ?? "")}` to `<A2UIProvider>`. No-op in demo
   (ref unset).
4. **`useLiveAgent.ts`** — hold `messages: UserTurn[]`. `run(settings, prompt)` seeds
   `[{role:"user",content:prompt}]`. `sendAction(settings, name)` = `appendUserTurn(messages,
   actionToTurn(name).content)` then re-run with the FULL messages. Both call the messages-based agent.
5. **`liveAgent.ts`** — `runLiveAgent(settings, messages, onEvent, opts?)` → `streamText({ messages, … })`
   (keep `toolChoice` + `stepCountIs(1)` **per turn**).
6. **`LiveDashboard.tsx`** — `useEffect(() => { actionRef.current = (name) => void sendAction(settings, name) })`.
7. **`App.tsx`** — wrap `<AgentActionProvider>` outside `<A2UISurfaceProvider>`.

**Tests:** conversation reducers (Red-first). Wiring + click→re-render verified by effect (live E2E,
post-quirk-settle). Gates: `cd ui && npm run typecheck && npm run lint && npm test`.

## Deferred (separate topics — YAGNI now)
- **Full multi-turn** (persistent history incl. assistant/tool turns, typed follow-ups, conversation UI).
- **#128 unify Demo+Live** (source selector; its own UX-polish PR — not a prerequisite).
- **Speculative pre-render** (#156 zero-latency path).

## Verification
```bash
cd ui && npm run typecheck && npm run lint && npm test
npm run build && npm run preview     # render via ../polyfetch-scrape chromium patchright
```
- **PR 2 (live):** click a rendered Button → agent re-renders (one `render_ui` call).

## Workflow
Topic branch off `origin/main`, squash-merge on green CI (unset `GH_TOKEN`/`GITHUB_TOKEN`). Live E2E is
manual (the sandbox headless browser can't observe the live SSE stream).
