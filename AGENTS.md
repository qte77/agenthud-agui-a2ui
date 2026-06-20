# AGENTS.md

Working agreement for AI agents in `agenthud-agui-a2ui` — a static Vite/React app that
replays AG-UI events and renders A2UI components. This file is self-contained and tracked;
treat it as the source of truth.

## Principles

- **KISS / DRY / YAGNI** — simplest solution that works; single source of truth (link, don't
  duplicate); build only what's asked, no speculative features.
- **Concise & focused** — minimal change for the task; touch only task-related code; reuse
  existing patterns instead of rebuilding. Resolve ambiguity before acting.

## Tests

- **Co-locate** `*.test.ts(x)` next to the file under test (`Foo.tsx` → `Foo.test.tsx`).
  See [docs/testing.md](docs/testing.md).
- **Test what matters:** modules and non-trivial behavior (logic, contracts, component
  callbacks). Skip trivial scripts, library internals, and styling; don't chase coverage.

## Commits & PRs

- Conventional-commit prefixes (`feat`/`fix`/`chore`/`docs`/`test(...)`); one topic per
  branch; open a PR; merge when CI is green.

## Where things live

- Docs are indexed in [docs/README.md](docs/README.md) — protocols, testing, user stories,
  and the ADRs in `docs/decisions/`.
- Contributor dev setup + PR workflow: [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md).
- A local `.claude/rules/` may carry these principles in more depth, but it is **gitignored
  (not shipped)** — so this file, not that directory, is authoritative.

Keep this file behavioral — no infrastructure, sandbox, or CI-token recipes.
