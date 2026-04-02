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
- Pre-baked recording with 7 tool calls using 11 of 18 A2UI catalog components
  - Card, Column, Row, Text, Image, Divider, Tabs, CheckBox, Slider, Button
- Each tool call uses a distinct component composition (overview, detail, list, tabs, filters)
- Catalog Viewer modal listing all 18 standard components with first-party reference links
- Replay mode badge indicating pre-defined sequence
- Dark theme with custom Tailwind theme tokens
- SVG favicon matching app layout
- GitHub Pages build support (`vite.config.ts` base path)

### Fixed

- A2UI v0.8 message format: component type as wrapper key, values as `{ literal: ... }` objects
- List component replaced with Column+Row (List guard expects resolved children, not items)
- Error handling in replay engine (try/catch around processMessages)
