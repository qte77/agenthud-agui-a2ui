# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Header links to the GitHub **Repo** and **Issues** (octocat icon + text), on both the Demo and
  Live pages.
- Edge proxy (`worker/`): a BYOK pass-through Cloudflare Worker that relays the non-CORS endpoints
  (GitHub Models, Google) server-to-server, so they work in-browser from the static site with the
  visitor's own key. Holds no secret; fixed upstream allowlist (no open proxy); CORS limited to
  the gh-pages + localhost origins. The dropdown gains "GitHub Models (via proxy)" / "Google (via
  proxy)"; set `PROXY_BASE` after `wrangler deploy` (`worker/README.md`). Delivers the CORS-relay
  half of US-6 / ADR-0001; the keyless variant stays deferred.

### Changed

- The Demo and Live dashboards now share one `DashboardShell` (header, A2UI surface, event sidebar,
  footer) instead of duplicating it — no behavior change; the Live tier's AI SDK stays lazy-loaded.

### Fixed

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
