---
title: User Stories — agenthud-agui-a2ui
description: Acceptance criteria and status for all user stories, from prototype to live agent.
---

# User Stories — agenthud-agui-a2ui

## Epic: Interactive GitHub Portfolio Tour via AG-UI + A2UI

As a **visitor to qte77.github.io/agenthud-agui-a2ui**, I want to see an AI agent compose a UI in real time from a standard component catalog, so that I understand how AG-UI and A2UI work together.

---

## Prototype (current — `prototype/agui-a2ui-replay`)

### US-1: Replay pre-recorded AG-UI event sequence

**As a** visitor,
**I want to** click Play and watch a pre-recorded agent session unfold with timing delays,
**so that** I see how an agent progressively builds a UI.

**Acceptance criteria:**

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

**Acceptance criteria:**

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

**Acceptance criteria:**

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

**Acceptance criteria:**

- [ ] Visible "Replay" badge in the header
- [ ] Empty state text explains this is a pre-defined sequence
- [ ] Narration events explain why the agent chose specific components

**Status:** Done

---

### US-5: Deploy to GitHub Pages

**As a** maintainer,
**I want to** deploy the app to qte77.github.io/agenthud-agui-a2ui via GitHub Actions,
**so that** visitors can access it without cloning the repo.

**Acceptance criteria:**

- [x] `npm run build` produces a deployable `dist/` with correct base path `/agenthud-agui-a2ui/`
- [x] GitHub Actions workflow (`.github/workflows/pages.yml`) builds and deploys on push to main
- [ ] Site loads and replay works at the published URL

**Status:** Done (deploy workflow in place; a `ci.yml` gate runs typecheck/lint/test/build on PRs)

---

## Future — GitHub Models integration

### US-6: Keyless live agent via GitHub Models (optional worker)

**As a** visitor,
**I want to** try the live agent without supplying my own key,
**so that** I can see it work with zero setup.

**Acceptance criteria:**

- [ ] A tiny edge worker (Cloudflare/Vercel) holds a `models:read` GitHub token server-side
- [ ] The worker calls `https://models.github.ai/inference` and streams AG-UI events (SSE)
- [ ] The browser consumes the stream and renders A2UI on the same surface
- [ ] Falls back to BYOK / Demo when the worker is unavailable

**Status:** CORS-relay delivered & live. The edge worker is **deployed** as a **BYOK pass-through CORS proxy** (`worker/`): it relays the non-CORS endpoints (GitHub Models, Google) server-to-server so they work in-browser with the *visitor's own* key — satisfying criteria 2-3, and the "(via proxy)" options are now active in the dashboard. The **keyless** variant (criterion 1 — the worker holding a `models:read` token so visitors need no key) stays deferred (abuse/secret surface). The original ADK-JS (`@google/adk`) plan is obsolete. See [ADR-0001][adr-0001] and `worker/README.md`.

---

### US-7: Bring Your Own Key (BYOK)

**As a** visitor,
**I want to** provide my own API key to use the live agent,
**so that** I can try it without depending on the owner's quota.

**Acceptance criteria:**

- [x] Inputs for an OpenAI-compatible base URL, API key, and model id
- [x] Key stored in `sessionStorage` only (never persisted, never logged)
- [x] In-browser only — no server; the `render_ui` tool emits contract-validated A2UI
- [x] Clear indication of the active mode (Demo | Live header toggle + "Live · BYOK" badge)

**Status:** Done — in-browser Vercel AI SDK agent; the AI SDK is code-split to the Live tier. See [ADR-0001][adr-0001].

---

## Future — Multiple tours

### US-8: Tour selector with multiple recordings

**As a** visitor,
**I want to** choose between different pre-recorded tours,
**so that** I can explore different aspects of the qte77 portfolio.

**Acceptance criteria:**

- [ ] TourSelector component with at least 3 options (Overview, AI Projects, DevTools)
- [ ] Each tour uses a different recording JSON from `src/recordings/`
- [ ] Switching tours resets the surface and event log
- [ ] Each tour emphasizes different A2UI component compositions

**Status:** Descoped — streamlined to the single decision-tree tour (KISS); the three extra linear tours and `TourSelector` were removed. See [ADR-0001][adr-0001] context + CHANGELOG.

---

## Future — Expanded scope

### US-9: Support arbitrary GitHub accounts

**As a** visitor,
**I want to** enter any GitHub username and explore their portfolio,
**so that** the tool is useful beyond the qte77 account.

**Acceptance criteria:**

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
5. ~~US-5: GitHub Pages deployment~~ (done)
6. ~~US-8: Multiple tours~~ (descoped — single tour)
7. ~~US-7: BYOK live agent~~ (done)
8. US-6: GitHub Models proxy (CORS-relay delivered via worker; keyless deferred)
9. US-9: Arbitrary accounts

[adr-0001]: decisions/0001-agent-runtime-stack.md
