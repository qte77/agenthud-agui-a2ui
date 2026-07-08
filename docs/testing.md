---
title: Testing — file layout conventions
description: Where test files live, Vitest guidance, and headless UI checks via patchright.
---

# Testing — file layout conventions

Where test files live in this repo, and the general Vitest/TypeScript guidance.

## This repo: tests in `ui/tests/`

The frontend lives under `ui/`; tests live in a flat **`ui/tests/`** directory
(separate from `ui/src/`) and import the module under test via `../src/…`:

```text
ui/
  src/agent/liveAgent.ts
  tests/liveAgent.test.ts   →  import … from "../src/agent/liveAgent"
```

- **Why:** mirrors the `ui/` package layout used across qte77 repos (e.g. `qte77/paperverse`),
  keeping `src/` free of test files and all test code in one place.
- **Config:** `ui/tsconfig.app.json` includes both `src` and `tests` so test type errors are
  caught; `ui/vite.config.ts` sets `setupFiles: ["tests/setup.ts"]`. Tests never reach `dist/`
  — `tsc -b` is `noEmit` and Vite bundles only *imported* files.

## Vitest is layout-agnostic

Default include glob: `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` — it matches tests whether in a
top-level `tests/`, co-located, or under `__tests__/`. Switching layout needs no config.

## When to use which

| Approach | Use when |
|---|---|
| **Top-level `tests/`** (this repo) | Keeps `src/` clean; all tests in one place; matches the cross-repo `ui/` convention. |
| **Co-located** — `Foo.test.tsx` beside `Foo.tsx` | Component-centric apps wanting maximum discoverability; the common Vite default. |
| **Centralized `src/__tests__/`** | Jest-era habit; a flat `src/` with many shared fixtures. |

## Headless UI checks (dynamic pages, interaction, visuals)

Vitest + Testing Library cover component logic in jsdom. For checks that need a **real browser** —
confirming a dynamic page actually renders, driving real clicks/inputs, then inspecting the
resulting DOM or a screenshot — drive the running app with **patchright** (a stealth Playwright
fork) via the [`polyfetch-scrape`][polyfetch-scrape] tool. Unlike a static HTML fetch it
executes the app's JS, so it can load SPA state, trigger actions, and evaluate visuals.

```bash
npm --prefix ui run dev    # serve the app → http://localhost:5173/
```

```python
# uv run --directory /workspaces/qte77/polyfetch-scrape python <script.py>
from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    page = pw.chromium.launch(headless=True).new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto("http://localhost:5173/", wait_until="load")

    # trigger an action — page.evaluate is robust when a toggle defeats strict locators
    page.evaluate("() => [...document.querySelectorAll('button')]"
                  ".find(b => b.textContent.trim() === 'Live')?.click()")

    # evaluate the DOM, then the visuals
    opts = page.eval_on_selector_all("option", "els => els.map(e => e.textContent)")
    print("endpoints:", opts, "| console errors:", errors)
    page.screenshot(path="/tmp/agenthud.png", full_page=True)
```

- **Scope:** manual smoke / visual verification — **not** part of `vitest run` CI. It needs the
  external tool plus a one-time Chromium install (`make setup_browsers` in `polyfetch-scrape`).
- **Proxy caveat:** the two "(via proxy)" endpoints are CORS-locked to `https://qte77.github.io`,
  so from `localhost` they fail unless you run the localhost-allowed worker — see
  [`worker/README.md`][worker-readme].

## Live BYOK E2E (headless — works since 2026-07-05)

The full **live agent loop is verifiable headlessly** (the earlier "sandbox can't observe the live
SSE stream" belief was a misdiagnosis — the real failures were a stale model id / no-credits key):

1. Copy `ui/.env.example` → `ui/.env` (gitignored) and set `VITE_BYOK_*` with a **CORS-friendly**
   provider (e.g. Groq — works direct from localhost, no worker needed).
2. `npm --prefix ui run dev` — dev builds prefill the Live connection from `ui/.env`.
3. Drive with patchright: switch to Live (`get_by_role("button", name="Live")`), open the Prompt
   panel, click **Run** (the submittable default prompt works untouched), then
   `wait_for_selector(".a2ui-surface .qte-card", timeout=90000)` — generous timeouts for model
   latency. Click a rendered `.qte-button` and poll for a second `RUN_FINISHED`.
4. **Probe the event log via `textContent`, not `innerText`** — the log sits in a `<details>`
   accordion and hidden text is invisible to `innerText`.
5. **Transcript + composer (#195):** after the first render, type into the composer
   (`input[placeholder^='Message the agent']`) and submit → a frozen prior-turn surface
   (`[aria-label='previous turn (read-only)']`) appears with the new user row above the live surface.
   A clicked live `.qte-button` adds another frozen turn labelled `Clicked "…"`; frozen-turn buttons
   are inert (`pointer-events-none`). Verified live: Run → composer follow-up → button = 2 frozen
   turns, 0 console errors.

## Sources

- Vitest `include` — <https://vitest.dev/config/include>
- Next.js Vitest guide (notes both `__tests__` and co-location) — <https://nextjs.org/docs/app/guides/testing/vitest>
- patchright (stealth Playwright fork) — <https://github.com/Kaliiiiiiiiii-Vinyzu/patchright>

[polyfetch-scrape]: https://github.com/qte77/polyfetch-scrape
[worker-readme]: ../worker/README.md
