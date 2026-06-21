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
