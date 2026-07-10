# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `ui/src/agent/fallback.ts` + `ui/src/agent/useLiveAgent.ts`: **model fall-through chain** — a Live turn
  now tries the provider's other models (same BYOK key, your chosen model first, capped at 3) when one is
  rate-limited (429), errors (5xx / network), or ignores the `render_ui` tool (renders nothing) —
  first-valid render wins, each fall-through noted in the EventStream. **Stops immediately** on a bad key
  (401/403) or no credits (402) rather than burning retries. `classifyFailure`/`candidateModels` are pure
  (TDD Red-first); reuses the existing validated-batch gate. Closes #210.

- `ui/src/Transcript.tsx`, `ui/src/Composer.tsx`, `ui/src/agent/transcript.ts`: **Live persistent
  conversation transcript + composer** — each turn's rendered surface is retained and stepped through
  with a ◀/▶ pager, one turn at a time (a prior turn shows as a frozen `@a2ui/react` `A2UIViewer`; the
  latest stays the live interactive surface; a new turn snaps to latest); a free-text composer drives
  follow-up turns via `useLiveAgent.sendMessage` alongside the rendered-Button path. Live-only; a fresh
  run wipes the transcript. Reuses `replaySnapshot.accumulate` to fold validated batches into viewer
  props. Live-verified. Closes #195, #209.

### Fixed

- `ui/src/replaySnapshot.ts`, `ui/src/agent/transcript.ts`, `ui/src/Transcript.tsx`: **frozen transcript
  turns keep their data-bound values** — `accumulate` now folds each `dataModelUpdate` seed into the surface
  snapshot **and** passes it through the rendered batch, so a stepped-back turn's path-bound CheckBox/Slider
  (and the Demo replay's seeded controls) render with their values instead of at defaults. The
  ValueMap→object fold is pure (TDD Red-first); "layer 2" (a visitor's live edits before the turn froze)
  stays deferred (YAGNI). Closes #206.
- `ui/src/agent/prompts.ts`: **live-rendered CheckBox/Slider are now interactive** — the system
  prompt taught only *literal* value bindings (`literalBoolean`/`literalNumber`), which render frozen;
  it now teaches `path` bindings + a `dataModelUpdate` seed so the renderer's two-way binding lets
  the visitor toggle/slide (the Live analog of the Demo fix in #173). Live-verified. Closes #183.
- `ui/src/index.css`: `usageHint: "header"` images are exempt from the 280px universal cap (banners).

## [0.4.0] - 2026-07-06

### Fixed

- `ui/src/index.css`: **A2UI tab buttons no longer show a whitish block** in either theme — the
  controls are `<button>`s whose UA chrome (ButtonFace bg, black border) survived the library's
  `all: revert` reset; fully stripped + `:focus-visible` outline (#177).
- `ui/src/replaySnapshot.ts`: replay no longer emits an **empty `surfaceUpdate` for begin-only
  "(surface init)" events** (rejected by `@a2ui`'s `min(1)` → "A2UI render error" in the log) (#177).
- `ui/src/CatalogViewer.tsx`: the Catalog modal **closes on Escape and backdrop click** (inner clicks
  stay open) and gains dialog a11y — `role=dialog`, `aria-modal`, accessible names (#178).
- `ui/src/ModeToggle.tsx`: the Demo|Live switch uses **`aria-pressed` toggle buttons** — the previous
  `tablist/tab` markup was an incomplete ARIA pattern that hid the buttons from `role=button`
  queries (#179).

- `ui/src/index.css` + `ui/src/agent/prompts.ts`: the **q7_ avatar no longer renders oversized on the
  Live tab** — live models often omit `Image.usageHint`, so all surface images are now capped at 280px
  (hint-specific sizes still apply) and the system prompt requires `usageHint` (`avatar` for
  `asset:qte77-avatar`).
- `ui/src/recordings/index.ts`: Demo **tree-mode replay no longer breaks on unvisited branches** —
  append-mode root patching is now seeded with the segments the visitor actually played, so a path
  like repos → details → plugins → filters renders instead of failing the processor's referential
  check on ids from the never-played tabs segment ("references non-existent component ID
  'divider-3'/'tabs-section'"). TDD Red-first (synthetic + real-recording regression tests).
- `ui/src/DashboardShell.tsx` + `ui/src/App.tsx`: the replay **breadcrumb no longer pushes/compresses
  the header** on deep paths — the middle header slot is shrinkable and the path truncates with an
  ellipsis (full path on hover via `title`); header height and controls stay constant.

### Added

- `ui/src/agent/conversation.ts` + `ui/src/agent/useLiveAgent.ts`: **live turn memory** — after each
  turn a compact assistant summary of the render (Text literals + Button action names, ≤1200 chars)
  is appended to the history, so follow-up turns actually see what was rendered (real continuity
  instead of "multiple single-turns"). #156 Stage 2 (memory half).
- `ui/src/LiveDashboard.tsx`: **submittable default prompt** — "Output an interactive fairytale"
  ships as the field's initial value (Run works untouched; first focus clears it; typed text survives
  refocus). `DEFAULT_PROMPT` exported for tests (#179).
- `ui/src/DashboardShell.tsx` + `ui/src/index.css`: **follow-up-turn feedback** — while a live turn
  streams over an existing surface, it dims (`pointer-events: none`, so stale buttons can't be
  clicked) and a pulsing branded "Generating…" chip shows; reduced-motion gated (#180).
- `docs/testing.md`: **headless live-BYOK E2E recipe** — dev server + `ui/.env` prefill + patchright;
  retires the "live E2E is manual-only" constraint (the old "no SSE observable" was a 404/402
  misdiagnosis). Verified: prompt → render → rendered-button click → second agent turn.
- **Demo controls are now interactive** — rendered A2UI **Buttons drive the decision tree** (the
  recording's tree choices declare their triggering action via a new optional `TreeChoice.action`;
  clicks route through the same `actionBridge` Live uses — e.g. the rendered "Apply" plays the
  results segment), and **CheckBoxes/Slider actually toggle/slide**: `overview.json` switched from
  literal to **`path` bindings** with `dataModelUpdate` seeding (contract union extended — TDD
  Red-first), letting the renderer's built-in two-way binding do the work; the Slider also gained a
  real `minValue`/`maxValue` range (the library defaults `max` to 0, pinning it). Input state is
  local demo state (results stay pre-baked).
- **Motion / alive states (CSS-only, no new deps)** — newly-mounted A2UI cards/images/buttons get a
  subtle entrance animation (`qte-enter`, 220ms; only NEW components animate thanks to stable-id
  keying), and the Live surface shows a **branded shimmer skeleton** (`ui/src/SurfaceSkeleton.tsx`,
  via `A2UIRenderer`'s `fallback`) from Run-click until the first `render_ui` batch lands — never over
  an existing surface on follow-up turns. Gated by the existing global `prefers-reduced-motion` rule.
  Plan 008 PR3 (the streaming-log cursor was cut as redundant per KISS review).
- **Interactive live agent (onAction MVP)** — rendered A2UI **Buttons now work** on the Live tab:
  a click routes through `A2UIProvider`'s `onAction` → `ui/src/agent/actionBridge.ts` → one
  follow-up agent turn with the full conversation history (`ui/src/agent/conversation.ts`,
  TDD Red-first), re-rendering the surface. `runLiveAgent` switched `prompt` → `messages`
  (one forced `render_ui` call per turn unchanged). Demo clicks stay no-ops (no handler
  registered). #156 Stage 1, per plans 007/008.

### Changed

- `ui/src/theme/a2uiTheme.ts` + `ui/src/index.css`: the **A2UI render surface is now themed**
  (EyeRest-branded). The `@a2ui` catalog rendered unstyled because its default theme references CSS
  vars this app never defined; we route Card/Button/Tabs/Text/Image to our own `qte-*` class hooks
  (via `A2UIProvider`'s `theme` prop) and style them from the existing `@theme` tokens — elevated
  rounded cards, a real type ramp (Inter), hover/tab-active states, and usage-hint-sized images
  (the demo avatar was rendering unconstrained). Dark/light aware; `.qte-*` scoped to `.a2ui-surface`.
  Plan [008](docs/plans/008-a2ui-generative-ui-parity.md) (PR1 of the generative-UI parity roadmap).

## [0.3.0] - 2026-07-04

### Added

- `ui/src/DashboardShell.tsx`: footer **build badge** — shows `v{version} · {short-sha}` linked to
  the exact GitHub commit the deploy was built from (gh-pages injects `github.sha` via
  `VITE_BUILD_SHA`; local builds show `dev`), so deployed builds are distinguishable.
- Header links to the GitHub **Repo** and **Issues** (octocat icon + text), on both the Demo and
  Live pages.
- `ui/src/EventStream.tsx`: the AG-UI events panel shows a one-line hint ("Run a prompt to see the
  live event stream") before the first run, instead of an empty box. Closes #118.
- Edge proxy (`worker/`): a BYOK pass-through Cloudflare Worker that relays the non-CORS endpoints
  (GitHub Models, Google) server-to-server, so they work in-browser from the static site with the
  visitor's own key. Holds no secret; fixed upstream allowlist (no open proxy); CORS limited to
  the gh-pages + localhost origins. The dropdown gains "GitHub Models (via proxy)" / "Google (via
  proxy)"; set `PROXY_BASE` after `wrangler deploy` (`worker/README.md`). Delivers the CORS-relay
  half of US-6 / ADR-0001; the keyless variant stays deferred.
- Edge proxy hardening — a per-IP **rate limit** (100/60s) + request **observability** logging, and
  structured upstream-failure handling (**502** with CORS). Docs: a
  [Cloudflare/Wrangler runbook](docs/cloudflare-runbook.md) and an end-to-end
  [architecture diagram](docs/architecture.md).
- **Edge proxy deployed + live** — the BYOK proxy is deployed; the "GitHub Models (via proxy)" /
  "Google (via proxy)" options now work in-browser (`PROXY_BASE` wired, no longer experimental),
  with a connection-panel disclaimer on BYOK key handling (forwarded, not stored; `sessionStorage`,
  cleared on tab close). Worker hardened further — 1 MiB request-body cap (**413**), `set-cookie` /
  hop-by-hop stripping, `compatibility_date` 2026-06-29, declarative `wrangler.toml`
  (`workers_dev`, `preview_urls = false`, logs + traces). Closes #97.
- **Dev-only `ui/.env`** — `VITE_BYOK_*` prefill the Live connection and `VITE_PROXY_BASE` points the
  proxy at a local `wrangler dev` worker; read only in dev (tree-shaken from prod builds), `ui/.env`
  gitignored. See `ui/.env.example`.
- **Strict typing + type-checked linting** — `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`
  (+ more) on both tsconfigs, and `strictTypeChecked` ESLint with a complexity gate on `ui/` and
  `worker/`.
- **Self-hosted live images** — `ui/src/agent/assets.ts` (`ASSET_MAP` + `resolveAssets`) maps
  `asset:<name>` tokens to bundled, base-path-correct URLs (the runtime counterpart to the demo's
  build-time replace; zero external requests). Tokens: `asset:qte77-avatar`, `asset:github-mark`; the
  live `SYSTEM_PROMPT` lists them so the model references a real bundled image instead of inventing a
  URL. Part of #129.

### Changed

- **Live layout:** the right sidebar is now a **3-pane exclusive accordion** (native `<details name>`)
  — **Connection / Prompt / Events**; opening one collapses the others. The BYOK connection settings
  *and* the prompt composer both live in the sidebar, so the center column is **only the A2UI
  surface**. The events panel scrolls **internally** (absolute-positioned within its `<details>`)
  instead of overflowing past the footer; its log summary now reads "{n} components, {m} types".
  `ui/src/DashboardShell.tsx` + `ui/src/LiveDashboard.tsx` + `ui/src/EventStream.tsx`.
- **Live model field** is now a `<select>` of curated per-provider models + a **Custom…** option that
  reveals a free-text input (mirrors the provider picker; any id still accepted) — was a bare
  free-text input. `ui/src/config.ts` `Endpoint` gains `models?: string[]` with per-provider
  `verified <date>` freshness markers. `ui/src/LiveDashboard.tsx`. Part of #129.
- The Demo and Live dashboards now share one `DashboardShell` (header, A2UI surface, event sidebar,
  footer) instead of duplicating it — no behavior change; the Live tier's AI SDK stays lazy-loaded.
- Header logo mark adopts the shared `brand-mark` style (neutral `--color-text`, theme-adaptive,
  28px) for parity with the qte77 sibling sites — was amber/22px.
- Edge proxy CORS allowlist is **environment-gated** — production allows only
  `https://qte77.github.io`; localhost is added only in dev (`ALLOW_LOCALHOST`).
- `Together` provider base URL → `api.together.ai/v1` (the `.xyz` host is no longer documented).
- `ui/src/config.ts`: refreshed the curated BYOK model-id suggestions to current provider ids
  (`verified 2026-07-04`) — the prior 2024-era ids had gone stale and 404'd (e.g. OpenRouter
  `anthropic/claude-3.5-sonnet` → "No endpoints found"). DeepSeek switched to `deepseek-v4-*`
  (`deepseek-chat`/`-reasoner` retire 2026-07-24); "GitHub Models (via proxy)" ids refreshed but
  flagged in-code + `ui/.env.example` as retiring 2026-07-30. Also synced the two out-of-band model-id
  examples in `ui/.env.example` and `ui/src/LiveDashboard.tsx` (`MODEL_PLACEHOLDER`).
- Docs: YAML frontmatter + reference-style links across `docs/`; headless UI testing via patchright
  documented in `docs/testing.md`.
- Docs: proxy URL references now point at `ui/src/config.ts` (the single source of truth) instead of
  a placeholder host; the README links the edge proxy ([`worker/README.md`](worker/README.md)) +
  env-var docs ([`ui/.env.example`](ui/.env.example)) and corrects the BYOK key note — the API key is
  held **in memory only**, not `sessionStorage`.
- `ui/src/agent/contract.ts`: the A2UI contract now validates that a `Card` carries a single string
  `child` (not `children`), so a model's malformed Card is rejected at the boundary with a clear
  error instead of throwing mid-render and silently blanking the surface (the #127 bug class).
  Part of #129.

### Removed

- `ui/src/config.ts`: the Live connection dropdown no longer offers **Mammouth** or **Azure OpenAI**
  — neither works from the static site (no browser CORS, and no safe fixed proxy upstream: Azure's
  per-resource host would be an SSRF risk). Don't offer broken choices; use **Custom…** to point at
  your own endpoint. Closes #117.

### Fixed

- Live agent robustness: `ui/src/agent/applyA2UIEvent.ts` now **surfaces A2UI contract violations in
  the event log** (Red-tested) instead of skipping a rejected batch silently — a failed live batch no
  longer blanks the surface with no explanation. The `SYSTEM_PROMPT` also asks for **one complete
  `render_ui` call** and forbids empty `children`/`tabItems`/`components` (gpt-4o-mini sometimes split
  the UI across partial calls or left an array empty, which `@a2ui` rejects). Part of #129.
- Live agent: the `SYSTEM_PROMPT` now documents the **exact prop shapes for the full A2UI catalog**
  (Button `child` + `action` object, Image `url`, Slider bare `minValue`/`maxValue`, Tabs `tabItems`,
  CheckBox), so the model emits valid A2UI for rich UIs instead of mis-shaping the interactive/media
  components. Decision recorded in [ADR-0003](docs/decisions/0003-live-catalog-instruction.md)
  (curated reference vs `@a2ui` schema injection). Part of #129.
- Live agent: the `SYSTEM_PROMPT` now requires the **top component's id to be `root`** (matching
  `beginRendering.root`). A live GitHub Models run on gh-pages showed the model setting `root: "root"`
  while naming its top component `card1`, so the renderer found no root and painted a **blank surface
  with no error**. Also corrected stale docs (`docs/architecture.md` `PROXY_BASE` location + a new
  "A2UI render pipeline" section; ADR-0001 in-memory key + `ui/` path). Part of #129.
- A2UI **value bindings** now use typed literals — `literalString` / `literalNumber` /
  `literalBoolean` — instead of a bare `literal`. The `@a2ui` message schema rejects bare `literal`
  on typed bindings (`Slider.value`, `CheckBox.value`), so interactive components **threw mid-render
  and never painted** (demo + live). Fixed across `ui/src/recordings/overview.json` and the live
  system prompt; guarded by a real-`@a2ui` contract test. See `docs/protocols.md` (v0.8). Part of #129.
- GitHub octocat uses GitHub's actual **black/white** marks (vendored `#181717`/white SVGs from the
  qte77 brand kit), swapped by theme per GitHub's brand guidelines — never recolored.
- Demo replay: a single-segment path now keeps its **cumulative** root, so a chosen decision
  renders **all** of its cards, not just the last. The per-event root patch was stripping cards
  added by earlier batches in the same segment (additive `surfaceUpdate`s rely on the @a2ui
  processor's cumulative component map).
- Live robustness: `streamText` now forces **exactly one `render_ui` call** —
  `toolChoice:{type:'tool',toolName:'render_ui'}` + `stopWhen: stepCountIs(1)` — so the model can't
  print the A2UI batch as prose (token flood, nothing renders) or split it across calls. The contract
  (`ui/src/agent/contract.ts`) also rejects a **cyclic** component tree (3-colour DFS over the
  child-reference graph), and the `SYSTEM_PROMPT` adds no-cycles / define-every-id rules. Consecutive
  `TEXT_MESSAGE_CONTENT` deltas are coalesced into one event-log row. Part of #129.
- Demo replay no longer floods the log with `@a2ui` **"references non-existent component ID"** errors:
  `@a2ui` validates each `surfaceUpdate` **in isolation** (every referenced id must be in that same
  message), but the demo replays incremental deltas that reference cards defined in earlier batches.
  `ui/src/replaySnapshot.ts` folds each delta into a running snapshot and re-emits one **self-contained**
  `surfaceUpdate` per step. Recorded in
  [ADR-0004](docs/decisions/0004-self-contained-replay-snapshots.md). Closes #141.

## [0.2.0] - 2026-06-21

### Added

- BYOK connection: a preset endpoint dropdown of OpenAI-compatible providers (OpenRouter, Groq,
  Together, Fireworks, DeepSeek) plus a Custom option; non-CORS endpoints (GitHub Models, Google,
  Mammouth, Azure) are listed but flagged **experimental** with a runtime CORS warning. (#81)
- Release flow: `tag-release` auto-tags `vX.Y.Z` when `ui/package.json`'s version changes on
  `main`, and `publish-release` cuts a GitHub Release from the matching CHANGELOG block;
  documented in CONTRIBUTING. (#83)

### Changed

- Moved the frontend into a `ui/` subdirectory (matching `qte77/paperverse`); tests now live in a
  flat `ui/tests/` importing source via `../src/…`. CI, GitHub Pages, and Dependabot updated for
  the new layout. (#82)

### Removed

- Orphaned hero mockup SVG (`assets/mockup-prototype.svg`), unreferenced since the README
  restructure. (#80)

## [0.1.0] - 2026-06-21

### Added

- Live **BYOK** agent mode (in-browser, static): the Vercel AI SDK (`ai` + `@ai-sdk/openai`)
  calls an OpenAI-compatible endpoint with a `render_ui` tool whose schema is the zod A2UI
  contract; streamed tool calls feed the shared `applyA2UIEvent` seam, so a live LLM drives
  the same surface as replay. Demo | Live header toggle; key held in `sessionStorage` only.
  The AI SDK is code-split — loaded only when Live mode is opened. (Closes #51)
- Brand `q7` logo-mark favicon + in-page header mark with a wordmark sub-tagline
- Centered max-width app layout with a footer linking the repo
- `<meta name="description">` for SEO / social previews
- Self-hosted demo avatar (vendored qte77 brand neutral mark) — the demo makes zero external requests
- Repo community-health files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, GOVERNANCE, SUPPORT, PR template) and a Conventional Commits `.gitmessage`
- `docs/README.md` index and markdownlint + lychee config for the lint check
- EyeRest brand theming: Tailwind v4 `@theme` tokens with a light/dark/system toggle (◐/○/●), inline anti-FOUC guard, and self-hosted Inter + JetBrains Mono (Fontsource, latin subset)
- Validated `zod` contract for A2UI message batches + recordings (`src/agent/contract.ts`)
- Shared `applyA2UIEvent` render seam — replay and the future live agent use one path
- ESLint flat config + `lint` script; CI workflow (typecheck + lint + test + build)
- ADR-0001: agent runtime stack (TS-only vs Pydantic)
- Vite + React 19 + TypeScript project scaffold with Tailwind v4
- A2UI surface rendering via `@a2ui/react` (A2UIProvider + A2UIRenderer)
- AG-UI event replay engine (`useReplayEngine` hook) with setTimeout-based timing
- EventStream sidebar with color-coded AG-UI event badges and timestamps
- A2UI component context shown per TOOL_CALL (component types + count)
- Pre-baked recording with 10 segments using 10 of 18 A2UI catalog components
  - Card, Column, Row, Text, Image, Divider, Tabs, CheckBox, Slider, Button
- Decision tree navigation with 10 nodes and branching paths
  - Each choice plays a segment with different A2UI component compositions
  - Components accumulate on the surface across choices (append mode)
  - Decision history with prompt, chosen label, and component hint
  - No dead ends — every leaf connects back to other branches
- 5 repos: Agents-eval, RAPID-spec-forge, ai-agents-research, polyforge-orchestrator, claude-code-utils-plugin
- Results segment showing filtered repo cards after applying filters
- Play All mode for full linear playback
- Start over to reset to decision tree root
- Segment markers on STEP_STARTED events for filtering
- Recording index with segment extraction, filtering, and root patching
- Catalog Viewer modal listing all 18 standard components with first-party reference links
- Replay mode badge indicating pre-defined sequence
- Dark theme with custom Tailwind theme tokens
- GitHub Pages build support (`vite.config.ts` base path)
- `onComplete` callback on replay engine for tree navigation

### Changed

- Bumped `@a2ui/react` to 0.10 and pinned all CI / CodeQL / Pages actions to full SHAs
- Co-located tests next to their sources; streamlined the README and docs
- Streamlined the demo to the single decision-tree tour; removed the three redundant linear tours and the `TourSelector`
- Replaced the dark-navy theme and blue accent (`#38bdf8`) with the EyeRest brand palette (zero-blue, warm amber)

### Fixed

- GitHub Pages deployment — the workflow was failing to start; actions are now SHA-pinned
- lint-md-links check — was failing to start; the repo Actions allowlist now permits the reusable workflow
- Added `src/vite-env.d.ts` so `*.css` side-effect imports typecheck (`tsc -b` was failing)
- Lowercased the Vite build target to `es2022` (lightningcss rejected `ES2022`)
- A2UI v0.8 message format: component type as wrapper key, values as `{ literal: ... }` objects
- List component replaced with Column+Row (List guard expects resolved children, not items)
- Error handling in replay engine (try/catch around processMessages)
- Root Column children patched to only reference defined IDs in single-segment playback
- beginRendering always injected for segment playback (processor needs root ID)
- Stale closure in Play All / tree transitions (playTrigger counter pattern)
- Replay loop prevention (lastHandledTrigger ref)
