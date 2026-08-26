---
title: Plan 012 — Free-tier BYOK endpoints (#187) + vendor bundle chunking (#121)
description: Two small, independent config/build PRs. #187 adds OpenRouter `:free` models + a CORS-verified Cerebras endpoint to the BYOK dropdown; #121 splits react/@a2ui into vendor chunks to clear the >500 kB Vite warning without breaking the AI-SDK code-split. Carries a full source map (config.ts, vite.config.ts), verified free-model ids, the Cerebras CORS probe, and the code-split marker check — so the next session doesn't re-gather context.
date: 2026-07-08
status: open
issues: [187]
handoff: handoffs/012-free-byok-endpoints-bundle-chunking.md
---

# Plan 012 — Free-tier BYOK endpoints (#187) + vendor chunking (#121)

## Reconciled 2026-08-26 (audit)

**#121 (vendor chunking) is DONE** — `ui/vite.config.ts`'s `rolldownOptions.codeSplitting.groups`
ships the react/a2ui split described below; CHANGELOG 0.5.0 "Closes #121"; issue #121 closed on
GitHub. No further action.

**#187 (free-tier BYOK endpoints + Cerebras) is OPEN and NOT implemented**, despite GitHub showing
it closed (`stateReason: COMPLETED`, closed 2026-07-08T23:07:32Z). That timestamp exactly matches
PR #207's merge — but PR #207 was titled `docs(plan/handoff-012): ...` and only added THIS plan +
its handoff; it never touched `ui/src/config.ts`. A `Closes #187` reference in that PR's body
auto-closed the issue for scaffolding the plan, not for doing the work. Verified directly against
`ui/src/config.ts` (2026-08-26): the OpenRouter preset still has zero `:free` ids, and there is no
Cerebras entry. **The design below (free ids + Cerebras) is still accurate and still unbuilt** — the
verified-2026-07-08 external data (OpenRouter free-model scan, Cerebras CORS probe) should be
RE-VERIFIED before implementing, since ~7 weeks have passed and ids/CORS posture can drift.

Two independent PRs, each its own branch off `main`, gates green, squash-merge (**user runs the merge** —
the auto-mode classifier blocks agent-authored PR merges). Neither is TDD-shaped: #187 is config data
(verify by build/E2E), #121 is build config (verify by build + the code-split marker check). No unit tests.

## Context

- **#187** — after a 401 with a paid key this session, lower the "need a funded key" barrier by offering
  free, tool-capable models. Two additions, both CORS-safe from the static site: OpenRouter `:free` ids +
  the `openrouter/free` auto-router (same endpoint, zero CORS risk), and **Cerebras** (direct, CORS
  verified). Config-data change; per AGENTS.md, config/data is verified **by effect**, not a unit test.
- **#121** — the eager `index-*.js` built at **534 kB** (gzip 166 kB), tripping Vite's >500 kB warning.
  Split `react` + `@a2ui/react` into named vendor chunks → silences the warning + improves caching. It
  does **not** reduce first-load bytes. The single real risk: a naive split pulling the AI SDK eager.

## Decisions (from AskUserQuestion, 2026-07-08)

- #187 layout: **fold `:free` ids into the existing OpenRouter preset** (not a separate preset).
- #187 Cerebras: **include this PR** — CORS confirmed below, so it's safe to list direct.
- #121: **selective vendor `manualChunks`** (not merely raising `chunkSizeWarningLimit`).

## Verified external data (re-runnable; ids drift — bump the `verified` date on refresh)

**OpenRouter free + tool-capable models** — 20 hits on 2026-07-08 via:
```bash
node -e "fetch('https://openrouter.ai/api/v1/models').then(r=>r.json()).then(d=>{const z=x=>x==='0'||x===0;const f=d.data.filter(m=>z((m.pricing||{}).prompt)&&z((m.pricing||{}).completion)&&(m.supported_parameters||[]).includes('tools'));console.log(f.length);f.forEach(m=>console.log(m.id))})"
```
Curated picks (well-known, strong tool-calling): `openrouter/free` (auto-router, free+tool-filtered),
`openai/gpt-oss-120b:free`, `meta-llama/llama-3.3-70b-instruct:free`. (Others available: `openai/gpt-oss-20b:free`,
`qwen/qwen3-coder:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `google/gemma-4-31b-it:free`, several `nvidia/nemotron-3-*:free`.)

**Cerebras CORS** — preflight is open (`Access-Control-Allow-Origin: *`, `authorization` allowed), so BYOK
works direct from the browser, no proxy. Verified 2026-07-08 via:
```bash
node -e "fetch('https://api.cerebras.ai/v1/chat/completions',{method:'OPTIONS',headers:{Origin:'https://qte77.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}}).then(r=>console.log(r.status,r.headers.get('access-control-allow-origin'),r.headers.get('access-control-allow-headers')))"
# → 200 * authorization,content-type
```
Cerebras `/v1/models` needs a key (403), so **confirm the exact model ids against Cerebras docs at
implementation** — candidates (tool-capable): `gpt-oss-120b`, `llama-3.3-70b`, `qwen-3-235b-a22b-instruct-2507`.

## 🗺️ Source map

### `ui/src/config.ts` (single source of truth for URLs/endpoints; docs point here, nothing restated in prose)
- Header comment `:17-26` — states only CORS-working endpoints are listed; `models` is a curated static
  list; `verified` date per provider is the freshness signal (the #165 drift convention). **A direct-CORS
  Cerebras addition fits this note as-is — no comment rewrite needed.**
- `interface Endpoint { label; baseURL; editable?; models? }` `:27-32`.
- `export const ENDPOINTS: Endpoint[]` `:34-95` — order matters (CORS-friendly first, then the two
  `(via proxy)` entries `:80-93`, then `Custom…` `:94`). OpenRouter preset `models` at `:39-46`.
- Consumers: `LiveDashboard.tsx` reads `ENDPOINTS` for the provider `<select>` + `ModelPicker`; selection
  is derived from the persisted `baseURL` (`selected = ENDPOINTS.find(...) ?? CUSTOM`). Adding entries/ids
  needs **no** consumer change.

### `ui/vite.config.ts` (build config)
Current `build` block `:22-24` is just `{ target: "es2022" }` — no `rollupOptions`, no `manualChunks`, no
`chunkSizeWarningLimit`. `plugins: [react(), tailwindcss()]`. This is a Vitest-config file (`defineConfig`
from `vitest/config`) that also carries the Vite build config.

### Code-split invariant (must be preserved by #121)
`App.tsx:7-11` lazy-imports `LiveDashboard`, whose static import chain (`useLiveAgent → liveAgent → ai` +
`@ai-sdk/openai`) confines the AI SDK to the lazy `LiveDashboard-*.js` chunk. `@a2ui/react` is **eager**
(via `A2UISurface`) → safe to put in a vendor chunk. `ai`/`@ai-sdk` must **never** enter an eager chunk.

## #187 — changes (`ui/src/config.ts`)

1. OpenRouter preset `models` (`:39-46`) — prepend the 3 free picks above the paid ids, with an inline
   `// free tier ↑ (verified 2026-07-08)` marker on the boundary.
2. New endpoint among the CORS-friendly presets (e.g. after DeepSeek `:79`, before the proxy entries):
   ```ts
   {
     label: "Cerebras",
     baseURL: "https://api.cerebras.ai/v1",
     // verified 2026-07-08 (CORS: ACAO * on /v1/chat/completions; confirm ids vs Cerebras docs)
     models: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-235b-a22b-instruct-2507"],
   },
   ```

## #121 — changes (`ui/vite.config.ts`)

Replace the `build` block with:
```ts
build: {
  target: "es2022",
  rollupOptions: {
    output: {
      // Eager vendors only. Do NOT use a blanket node_modules rule — it would pull ai/@ai-sdk into
      // the eager graph and break the Live code-split (see the marker check in Verification).
      manualChunks: {
        react: ["react", "react-dom"],
        a2ui: ["@a2ui/react"],
      },
    },
  },
},
```
`@a2ui/web_core` (transitive) rides into the `a2ui` chunk via reachability. If a chunk still warns after
the split, split further (or fallback: add `chunkSizeWarningLimit: 600`).

## Docs & issues touched (audit answers)

**Docs:**
- **CHANGELOG.md** — REQUIRED both: `### Added` (free BYOK models: OpenRouter `:free` + Cerebras, Closes #187);
  `### Changed` (vendor chunking, Closes #121). Lead with the file path per CONTRIBUTING.
- **README.md** — OPTIONAL-recommended for #187 only: one clause in the Live paragraph noting free-tier
  options exist (the whole point is lowering the key barrier). No change for #121.
- **architecture.md / docs/roadmap (none exists) / UserStory.md / ADRs / protocols** — no change. Cerebras
  is another direct-CORS provider like OpenRouter/Groq (architecture is provider-agnostic, points at
  config.ts); US-7 (BYOK) criteria are unaffected; vendor chunking is an impl detail, not architecture.
- **env / URL / CLI** — already documented properly: the Cerebras URL lives in config.ts (the SoT; docs
  reference it), with a `verified` date per the #165 convention. #187 adds no env var/CLI; #121 changes none.

**Issues:**
- **#121** — already closed (shipped, see Reconciled note above).
- **#187** — GitHub shows it closed, but the work described below is unbuilt (see Reconciled note).
  Don't reference `Closes #187` in a docs-only PR again — only the PR that actually adds the
  `:free` ids + Cerebras entry should close it, and it may need reopening first (flagged to owner).
- **#165** (recurring BYOK model-id refresh / drift) — keep OPEN (recurring); add a comment noting the
  2026-08-26 reconciliation. No new issues.

## Verification

**Both PRs:** `cd ui && npm run typecheck && npm run lint && npm test` (130/130) green.

**#121 — the code-split guard (mandatory):** `npm run build`; confirm the >500 kB warning is gone and
eyeball `index-*`, `react-*`, `a2ui-*` all <500 kB; then run the marker check — the AI SDK must appear
ONLY in `LiveDashboard-*.js`:
```bash
node -e "const fs=require('fs'),d='dist/assets';for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.js'))){const s=fs.readFileSync(d+'/'+f,'utf8');if(/^(index|react|a2ui|LiveDashboard)-/.test(f))console.log(f,'createOpenAI',s.includes('createOpenAI'),'streamText',s.includes('streamText'))}"
# expect: streamText=true ONLY on LiveDashboard-*; false on index/react/a2ui
```
Optional: `npm run preview` + patchright load to confirm no missing-chunk boot errors.

**#187 — live E2E smoke** (headless; recipe in docs/testing.md; works with `ui/.env` `VITE_BYOK_*` prefill):
dev server → Live (connection prefilled) → set model to `openai/gpt-oss-120b:free` (or `openrouter/free`)
→ Run → assert a surface renders (forced `toolChoice` + `stepCountIs(1)` completes). **Drop any free id
that fails forced tool_choice.** Cerebras render needs a Cerebras free key (optional — endpoint + CORS are
already verified; note this in the PR). Patchright is driven via `uv run --directory
/workspaces/qte77/polyfetch-scrape python <script.py>`; the existing `.env` holds an OpenRouter key.

## Guardrails / workflow

- Branch off `main`; `feat/187-free-byok-endpoints` and `chore/121-vendor-chunking`.
- `git push`/`gh pr create` with **`env -u GH_TOKEN -u GITHUB_TOKEN`** (repo token workflow).
- **Do not attempt to merge** — the classifier denies agent PR merges; open PR + report, the human merges.
- KISS/YAGNI: no unit tests for config/build; minimal diffs.
