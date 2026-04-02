# agenthud-agui-a2ui

Feasibility prototype: AG-UI event replay + A2UI rendering in a static Vite/React app.

![Prototype mockup](assets/mockup-prototype.svg)

## Stack

| Package | Purpose |
|---|---|
| `@a2ui/react` | Google's A2UI React renderer |
| `@ag-ui/core` | AG-UI event types |
| `react` | UI framework |
| `vite` | Build + dev server |
| `tailwindcss` | Styling |

## Run

```bash
npm install
npm run dev
```

Click **Play** to replay pre-baked AG-UI events. Left panel renders A2UI components, right panel shows the event stream.

## Build

```bash
npm run build
npx vite preview
```
