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

Semi-automated by design: the **version bump is a manual PR** (it keeps the human-curated
Keep-a-Changelog accurate), while **tagging and the GitHub Release are automated**. The bump
is deliberately not a tool — `changesets`/`release-please`/`semantic-release` all fight the
`ui/` subdir layout or overwrite the Keep-a-Changelog format. To cut `vX.Y.Z`:

1. **Bump — one PR off `main`.** Run `( cd ui && npm version <patch|minor|major>
   --no-git-tag-version )` to set the version in `ui/package.json` + `ui/package-lock.json`;
   update the README badge (`version-X.Y.Z-58f4c2`); and in `CHANGELOG.md` rename
   `## [Unreleased]` to `## [X.Y.Z] - <YYYY-MM-DD>`, adding a fresh `## [Unreleased]` above.
   Commit as `chore(release): vX.Y.Z` and merge on green CI.
2. **Tag — automatic.** The merge changes `ui/package.json` on `main`, so
   [`tag-release`](workflows/tag-release.yaml) tags `vX.Y.Z` on the squash-merge commit.
3. **Release — one click.** Run [`publish-release`](workflows/publish-release.yaml) (Actions
   tab, or `gh workflow run publish-release.yaml -f tag=vX.Y.Z`) to publish a GitHub Release
   with notes from the matching `CHANGELOG.md` block. Tag-only is fine.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — enable the template once with
`git config commit.template .gitmessage` (it lists the accepted types).

## Questions

Open an issue with the `question` label.
