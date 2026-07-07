---
title: Agent Learning Documentation
description: Non-obvious patterns that prevent repeated mistakes across sprints
---

## Template

- **Context**: When/where this applies
- **Problem**: What issue this solves
- **Solution**: Implementation approach
- **Example**: Working code
- **References**: Related files

## Learned Patterns

### Sync `origin/main` before implementing

- **Context**: Starting any non-trivial change in this repo.
- **Problem**: Topic PRs merge fast here, so a local branch cut from a stale `main`
  silently redoes already-merged work (a whole merged PR was rebuilt before this was caught).
- **Solution**: `git fetch origin`, compare `HEAD` to `origin/main`, and skim
  `origin/main`'s tree/`package.json` before writing code. Branch off an up-to-date `main`.
- **Example**: `git fetch origin && git rev-parse HEAD origin/main && git ls-tree -r --name-only origin/main src`
- **References**: `AGENTS.md` (one topic per branch, merge on green).

### `gui-check.py` false-drifts on Tailwind v4 token names

- **Context**: Screenshotting/verifying this app with `brand/scripts/gui-check.py`
  (via polyfetch-scrape's Patchright).
- **Problem**: gui-check audits **bare** CSS var names (`--bg`, `--primary`), but this app
  uses Tailwind v4 `@theme`, which emits `--color-bg`/`--color-primary` with the *same*
  EyeRest values. The token-drift audit exits 1 (false fail) even though theming is correct.
- **Solution**: Ignore the `DRIFT` failures for this Tailwind-v4 app — the `<slug>-{light,dark}.png`
  screenshots are still written. Do **not** rename tokens to bare names (breaks Tailwind utilities).
- **Example**: `uv run --directory ../polyfetch-scrape python ../qte77/brand/scripts/gui-check.py --url http://localhost:4173 --out /tmp/shots`
- **References**: `ui/src/index.css` (`@theme` tokens), `brand/scripts/gui-check.py`.

### Provider/account errors masquerade as a live-agent "silent hang"

- **Context**: Debugging the live BYOK agent (`ui/src/agent/liveAgent.ts`) when a run appears to do nothing.
- **Problem**: A stale model id (404 "No endpoints found") or an out-of-credits key (402) presents like a
  code regression — the proxy returns 200, the SSE stream carries only an error part, and the headless
  sandbox can't observe it, so it reads as a hang. Handoff/plan 007 nearly reverted #147's `toolChoice`
  on this false signal before a real-browser check showed the agent streams fine.
- **Solution**: Before suspecting streaming / `toolChoice` / `stepCountIs` code, read the browser console
  for the actual `AI_APICallError` — a 404/402 is almost always a config/account issue (dead model id or
  no credits), fixable in `ui/src/config.ts`, not in agent code.
- **Example**: `anthropic/claude-3.5-sonnet` → 404 "No endpoints found"; an OpenRouter key with 0 credits → 402.
- **References**: `ui/src/config.ts` (model lists + `verified` dates), `docs/plans/007-live-interactive-multicol.md`.

### Dependabot: `0.x` deps break on a *minor*, so major-only ignores don't guard them

- **Context**: Adding a Dependabot `ignore` to hold a dependency at a known-good line (e.g. pinning
  `@a2ui/react` to the v0.8 renderer API).
- **Problem**: Under semver, a `0.x` package signals breaking changes with a **minor** bump
  (`0.10` → `0.11`), not a major. An `ignore` of `version-update:semver-major` (correct for `1.x+`
  deps like `ai`/`@ai-sdk/openai`) lets a breaking `0.x` release through into the grouped auto-bump.
- **Solution**: For a `0.x` dependency you want to freeze, ignore **both** `semver-major` **and**
  `semver-minor` (patches still flow). Comment *why* it differs from the `1.x+` entries above it.
- **Example**: `- dependency-name: "@a2ui/react"` → `update-types: ["version-update:semver-major",
  "version-update:semver-minor"]` (`.github/dependabot.yml`, #197).
- **References**: `.github/dependabot.yml`, `docs/plans/008-a2ui-generative-ui-parity.md` (#140 renderer
  freeze on v0.8).
