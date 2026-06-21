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

## Sources

- Vitest `include` — <https://vitest.dev/config/include>
- Next.js Vitest guide (notes both `__tests__` and co-location) — <https://nextjs.org/docs/app/guides/testing/vitest>
