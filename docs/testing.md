# Testing — file layout conventions

Where test files live in this repo, and the general Vitest/TypeScript guidance.

## This repo: co-locate tests

Put each `*.test.ts(x)` **next to the file it tests** (`Foo.tsx` → `Foo.test.tsx`).

- **Why:** this is a Vite + Vitest **app** (`"private": true`, deployed to GitHub Pages,
  not a published package), and co-location is the idiomatic convention for that stack.
  Already followed in `src/agent/` and `src/theme/`.
- **No config needed:** Vitest's default `include` finds tests anywhere; `tsc -b` runs
  `noEmit` (type-check only) and Vite bundles only *imported* files, so co-located tests
  never reach `dist/`. Keep tests inside the typecheck `include` so test type errors are caught.

> Legacy tests under `src/__tests__/` predate this and are being relocated to match.

## Vitest is layout-agnostic

Default include glob: `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` — it matches tests whether
co-located, under `__tests__/`, or in a top-level `tests/`. Switching layout needs no config.

## When to use which

| Approach | Use when |
|---|---|
| **Co-located** — `Foo.test.tsx` beside `Foo.tsx` | **Default for apps** (this repo). Component/feature-centric code; best discoverability; no published-package concern. |
| **Centralized `src/__tests__/`** | Jest-era habit; a flat `src/` with no feature folders; many shared fixtures you don't want scattered. Valid, just older. |
| **Top-level `tests/`** (outside `src/`) | **Publishable libraries/packages** — keeps tests + test-utils out of the shipped tarball (`files` / `.npmignore`); also the Node-backend tradition. Not idiomatic for an unpublished app. |

## TypeScript note

Co-located tests can leak into `dist/` under a raw `tsc` build; the standard fix is a
`tsconfig.build.json` that `exclude`s `**/*.test.*`. **Not needed here** — `tsc -b` is
`noEmit` and Vite's bundler only includes imported files, so tests never reach the build.

## Sources

- Vitest `include` — <https://vitest.dev/config/include>
- Next.js Vitest guide (notes both `__tests__` and co-location) — <https://nextjs.org/docs/app/guides/testing/vitest>
- Excluding test files from a TS build — <https://bobbyhadz.com/blog/typescript-exclude-test-files-from-compilation>
