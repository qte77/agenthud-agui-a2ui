# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

### Changed

- **Live layout:** the BYOK **connection settings** (endpoint / key / model) move from the center to
  the right sidebar, so the center stays the A2UI surface (content) + the prompt composer. The
  sidebar now stacks two **collapsible** sections — Connection and AG-UI Events — both expanded by
  default, each collapsing to its header. `ui/src/DashboardShell.tsx` + `ui/src/LiveDashboard.tsx`.
- The Demo and Live dashboards now share one `DashboardShell` (header, A2UI surface, event sidebar,
  footer) instead of duplicating it — no behavior change; the Live tier's AI SDK stays lazy-loaded.
- Header logo mark adopts the shared `brand-mark` style (neutral `--color-text`, theme-adaptive,
  28px) for parity with the qte77 sibling sites — was amber/22px.
- Edge proxy CORS allowlist is **environment-gated** — production allows only
  `https://qte77.github.io`; localhost is added only in dev (`ALLOW_LOCALHOST`).
- `Together` provider base URL → `api.together.ai/v1` (the `.xyz` host is no longer documented).
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
