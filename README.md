# agenthud-agui-a2ui

Feasibility prototype: AG-UI event replay + A2UI component rendering in a static Vite/React app.

Demonstrates how an AI agent composes different UI layouts from the same A2UI standard catalog based on context and intent — without executing arbitrary code.

![Prototype mockup](assets/mockup-prototype.svg)

## What it shows

- **A2UI Surface** (left panel): Components rendered from declarative JSON via `@a2ui/react`
- **AG-UI EventStream** (right panel): Protocol events streamed with timing, showing which components each tool call produces
- **Catalog Viewer**: Modal listing all 18 A2UI standard components, highlighting which ones are used in the demo

The recording replays 7 tool calls, each using a different component composition:

| Tool call | Components | Layout pattern |
|---|---|---|
| `renderRepoCard` | Card, Row, Text | Compact overview |
| `renderRepoDetail` | Row, Image, Column, Divider | Detail with avatar |
| `renderPluginList` | Column, Row, Text | Enumerated items |
| `renderPortfolioTabs` | Tabs, Column, Text | Category navigation |
| `renderCheckBoxFilters` | Card, Row, CheckBox | Toggle filters |
| `renderSlider` | Card, Slider, Text | Range input |
| `renderButton` | Card, Row, Button | Action triggers |

11 of 18 standard catalog components used.

## Stack

| Package | Version | Purpose |
|---|---|---|
| `@a2ui/react` | 0.8.0 | Google's A2UI React renderer |
| `@ag-ui/core` | 0.0.49 | AG-UI event type definitions |
| `react` | 19 | UI framework |
| `vite` | 7 | Build + dev server |
| `tailwindcss` | 4 | Styling (Vite plugin, no config file) |
| `typescript` | 5.8 | Type checking |

## Run

```bash
npm install
npm run dev
```

Click **Play** to replay the pre-recorded AG-UI event sequence. Click **Catalog** to view the full A2UI component library.

## Build

```bash
npm run build
npx vite preview
```

Build output in `dist/` is deployable to GitHub Pages with base path `/agenthud-agui-a2ui/`.

## Modes

| Mode | Status | Description |
|---|---|---|
| **Replay** | Current | Pre-baked AG-UI events replayed with timing |
| GitHub Models | Planned | Live agent via GitHub Models API (OpenAI-compatible) |
| BYOK | Planned | Visitor provides their own API key |

## References

- [A2UI Specification](https://a2ui.org/specification/v0.9-a2ui/)
- [A2UI React Renderer](https://github.com/google/A2UI/tree/main/renderers/react)
- [AG-UI Protocol](https://docs.ag-ui.com/introduction)
- [AG-UI GitHub](https://github.com/ag-ui-protocol/ag-ui)
