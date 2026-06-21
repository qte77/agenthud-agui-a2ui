# Contributing

Thanks for considering a contribution to **agenthud-agui-a2ui** — a static Vite/React app
that replays AG-UI events and renders A2UI components.

## Before you start

- Check open issues to avoid duplication; for non-trivial changes, open an issue first.
- See [AGENTS.md](../AGENTS.md) for the working conventions (principles, tests, commits).

## Development

Requires Node.js 22+. The frontend lives in `ui/` — run npm from there:

```bash
cd ui
npm install        # dependencies
npm run dev        # Vite dev server
npm test           # vitest
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint
npm run build      # tsc -b && vite build
```

Run `npm run typecheck && npm run lint && npm test` (from `ui/`) before opening a PR.
Test layout: [docs/testing.md](../docs/testing.md).

## Pull requests

- One concern per PR, one topic per branch; reference issues (`Closes #123`).
- Ensure CI is green before review/merge.

## Releasing

Tier-1 maintainer flow — manual version bump, automated tag + release:

1. In the release PR, from `ui/`, run `npm version <patch|minor|major> --no-git-tag-version`
   (updates `package.json` + `package-lock.json`), bump the README version badge
   (`version-X.Y.Z-58f4c2`), and in `CHANGELOG.md` rename `## [Unreleased]` to
   `## [X.Y.Z] - <YYYY-MM-DD>` with a fresh `## [Unreleased]` added above.
2. Merge to `main` — [`tag-release`](workflows/tag-release.yaml) auto-tags `vX.Y.Z` on the
   squash-merge commit.
3. Optionally run [`publish-release`](workflows/publish-release.yaml) (Actions tab, or
   `gh workflow run publish-release.yaml -f tag=vX.Y.Z`) to cut a GitHub Release with notes from
   the matching `CHANGELOG.md` block. Tag-only is fine.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — enable the template once with
`git config commit.template .gitmessage` (it lists the accepted types).

## Questions

Open an issue with the `question` label.
