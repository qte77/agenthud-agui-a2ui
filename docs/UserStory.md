# User Stories — agenthud-agui-a2ui

## Epic: Interactive GitHub Portfolio Tour via AG-UI + A2UI

As a **visitor to qte77.github.io/agenthud-agui-a2ui**, I want to see an AI agent compose a UI in real time from a standard component catalog, so that I understand how AG-UI and A2UI work together.

---

## Prototype (current — `prototype/agui-a2ui-replay`)

### US-1: Replay pre-recorded AG-UI event sequence

**As a** visitor,
**I want to** click Play and watch a pre-recorded agent session unfold with timing delays,
**so that** I see how an agent progressively builds a UI.

### Acceptance criteria:

- [ ] Play button starts the replay; Restart resets the surface and event log
- [ ] AG-UI events fire with realistic timing delays (50-500ms between events)
- [ ] A2UI components render progressively on the left panel as events fire
- [ ] EventStream sidebar shows each AG-UI event type with timestamp and color-coded badge
- [ ] Replay runs to RUN_FINISHED without errors
- [ ] Play button is disabled during replay

**Status:** Done

---

### US-2: Show different component compositions per tool call

**As a** visitor,
**I want to** see each tool call use a different set of A2UI components,
**so that** I understand the agent selects components based on context, not a fixed template.

### Acceptance criteria:

- [ ] At least 5 tool calls in the recording, each with a distinct component mix
- [ ] EventStream shows component types and count per TOOL_CALL_START (e.g., "8 components: Card, Text, Row")
- [ ] At least 10 of 18 standard catalog components used across the recording
- [ ] Components include both layout (Column, Row, Card, Tabs) and interactive (CheckBox, Slider, Button)
- [ ] Decision tree navigation: user choices drive which components render
- [ ] Components accumulate across choices (append mode)

**Status:** Done (10 of 18 components, 10 segments, decision tree with 10 nodes)

---

### US-3: View the A2UI component catalog

**As a** visitor,
**I want to** open a catalog listing all available A2UI components with descriptions,
**so that** I understand the full set of building blocks the agent can use.

### Acceptance criteria:

- [ ] Catalog button in the header opens a modal
- [ ] All 18 standard A2UI catalog components listed with descriptions
- [ ] Components used in the current demo are highlighted
- [ ] First-party links to A2UI spec, A2UI React renderer, AG-UI protocol docs, AG-UI GitHub
- [ ] Modal is dismissible

**Status:** Done

---

### US-4: Indicate replay mode clearly

**As a** visitor,
**I want to** see that the current session is a pre-defined replay, not a live agent,
**so that** I don't confuse it with real-time AI interaction.

### Acceptance criteria:

- [ ] Visible "Replay" badge in the header
- [ ] Empty state text explains this is a pre-defined sequence
- [ ] Narration events explain why the agent chose specific components

**Status:** Done

---

### US-5: Deploy to GitHub Pages

**As a** maintainer,
**I want to** deploy the app to qte77.github.io/agenthud-agui-a2ui via GitHub Actions,
**so that** visitors can access it without cloning the repo.

### Acceptance criteria:

- [ ] `npm run build` produces a deployable `dist/` with correct base path `/agenthud-agui-a2ui/`
- [ ] GitHub Actions workflow (`.github/workflows/pages.yml`) builds and deploys on push to main
- [ ] Site loads and replay works at the published URL

**Status:** Not started

---

## Future — GitHub Models integration

### US-6: Live agent mode via GitHub Models API

**As a** visitor,
**I want to** interact with a live agent that queries the qte77 GitHub account in real time,
**so that** the UI is generated dynamically based on my questions, not replayed.

### Acceptance criteria:

- [ ] Agent runs ADK-JS (`@google/adk`) in the browser with OpenAI-compatible endpoint
- [ ] Connects to `https://models.github.ai/inference` using build-time injected token
- [ ] Fine-grained PAT with `models:read` only, no repo access
- [ ] Agent calls GitHub REST API for public repo data (no auth needed)
- [ ] AG-UI events stream in real time as the agent processes
- [ ] A2UI components render progressively based on agent decisions
- [ ] Falls back to replay mode if no token available

**Status:** Planned

---

### US-7: Bring Your Own Key (BYOK)

**As a** visitor,
**I want to** provide my own API key to use the live agent,
**so that** I can try it without depending on the owner's quota.

### Acceptance criteria:

- [ ] Input field for visitor to paste their GitHub PAT or OpenAI-compatible key
- [ ] Key stored in sessionStorage only (never persisted)
- [ ] Key takes precedence over build-time injected token
- [ ] Clear indication of which mode is active (Replay / Live / BYOK)

**Status:** Planned

---

## Future — Multiple tours

### US-8: Tour selector with multiple recordings

**As a** visitor,
**I want to** choose between different pre-recorded tours,
**so that** I can explore different aspects of the qte77 portfolio.

### Acceptance criteria:

- [ ] TourSelector component with at least 3 options (Overview, AI Projects, DevTools)
- [ ] Each tour uses a different recording JSON from `src/recordings/`
- [ ] Switching tours resets the surface and event log
- [ ] Each tour emphasizes different A2UI component compositions

**Status:** Planned

---

## Future — Expanded scope

### US-9: Support arbitrary GitHub accounts

**As a** visitor,
**I want to** enter any GitHub username and explore their portfolio,
**so that** the tool is useful beyond the qte77 account.

### Acceptance criteria:

- [ ] Text input for GitHub username
- [ ] Agent fetches public repos for the given account
- [ ] Components and layout adapt to the account's actual data
- [ ] qte77 remains the default

**Status:** Planned (future feature, not in current scope)

---

## Priority order

1. ~~US-1: Replay~~ (done)
2. ~~US-2: Component diversity~~ (done)
3. ~~US-3: Catalog viewer~~ (done)
4. ~~US-4: Replay indicator~~ (done)
5. US-5: GitHub Pages deployment
6. US-8: Multiple tours
7. US-6: GitHub Models live mode
8. US-7: BYOK
9. US-9: Arbitrary accounts
