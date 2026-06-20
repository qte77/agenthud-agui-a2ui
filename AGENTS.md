# AGENTS.md

Working agreement for AI agents in `agenthud-agui-a2ui` — a static Vite/React app that
replays AG-UI events and renders A2UI components.

## Where the rules live (don't duplicate them here)

- **Behavioral rules:** `.claude/rules/` — `core-principles.md` (KISS/DRY/YAGNI),
  `tdd.md`, `context-management.md`, `compound-learning.md`. These are authoritative.
- **Test layout:** `docs/testing.md` — co-locate `*.test.ts(x)` next to the file under test.
- **Architecture & decisions:** `docs/` — `protocols.md` and the ADRs in `docs/decisions/`.

## Conventions specific to this repo

- **Test what matters:** unit-test modules and non-trivial behavior (logic, contracts,
  component callbacks). Skip trivial scripts, library internals, and styling.
- **Commits & PRs:** Conventional-commit prefixes (`feat`/`fix`/`chore`/`docs`/`test(...)`),
  one topic per branch, open a PR, merge when CI is green.

Keep this file behavioral — no infrastructure, sandbox, or CI-token recipes.
