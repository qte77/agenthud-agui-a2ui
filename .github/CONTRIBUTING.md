# Contributing

Thanks for considering a contribution to **agenthud-agui-a2ui** — a static Vite/React app
that replays AG-UI events and renders A2UI components.

## Before you start

- Check open issues to avoid duplication; for non-trivial changes, open an issue first.
- See [AGENTS.md](../AGENTS.md) for the working conventions (principles, tests, commits).

## Development

Requires Node.js 22+.

```bash
npm install        # dependencies
npm run dev        # Vite dev server
npm test           # vitest
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint
npm run build      # tsc -b && vite build
```

Run `npm run typecheck && npm run lint && npm test` before opening a PR. Test layout:
[docs/testing.md](../docs/testing.md).

## Pull requests

- One concern per PR, one topic per branch; reference issues (`Closes #123`).
- Ensure CI is green before review/merge.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — enable the template once with
`git config commit.template .gitmessage` (it lists the accepted types).

## Questions

Open an issue with the `question` label.
