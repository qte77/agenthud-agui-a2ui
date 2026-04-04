# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
- SVG favicon matching app layout
- GitHub Pages build support (`vite.config.ts` base path)
- `onComplete` callback on replay engine for tree navigation

### Fixed

- A2UI v0.8 message format: component type as wrapper key, values as `{ literal: ... }` objects
- List component replaced with Column+Row (List guard expects resolved children, not items)
- Error handling in replay engine (try/catch around processMessages)
- Root Column children patched to only reference defined IDs in single-segment playback
- beginRendering always injected for segment playback (processor needs root ID)
- Stale closure in Play All / tree transitions (playTrigger counter pattern)
- Replay loop prevention (lastHandledTrigger ref)
