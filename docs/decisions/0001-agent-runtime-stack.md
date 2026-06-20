# ADR-0001 — Agent runtime stack

**Status:** Accepted (2026-06-20)
**Relates to:** [US-6 / US-7](../UserStory.md) (live agent mode, BYOK)

## Context

The prototype must connect a real, *simple* agentic system to demonstrate AG-UI +
A2UI with a live LLM, while staying static-first (GitHub Pages). The frontend is
already TypeScript (Vite/React). Two candidate stacks were considered for the agent
runtime: a Python backend (pydantic + pydantic-settings + pydantic-ai) versus a
TypeScript-only stack (Vercel AI SDK + AG-UI SDK + zod).

## Decision

Use the **TypeScript-only** stack. The simplest real path is **BYOK in-browser**:
`ai` + `@ai-sdk/openai` call an OpenAI-compatible endpoint; a `render_ui` tool whose
`inputSchema` is the zod A2UI contract (`src/agent/contract.ts`) produces validated
A2UI component batches that feed the existing `applyA2UIEvent` seam. `zod` is the
single contract for both internal (recordings) and external (live agent) data.

**Pros vs the Pydantic stack**

- Static-first: BYOK runs 100% in the browser on GitHub Pages — no server.
- Single language: one toolchain shared with the frontend; one zod contract (DRY).
- Edge-portable: the same portable Web-standard TS runs in the browser, a Cloudflare
  Worker, or Node.
- Reuses existing deps (`zod`, `@ag-ui/core`) and the `applyA2UIEvent` render seam.

**Cons / what we give up**

- Pydantic-AI's tool-arg validation + automatic reprompting is best-in-class; the
  Vercel AI SDK offers equivalent zod validation + `experimental_repairToolCall` but
  is less batteries-included.
- No Python `src/` package (the paperverse convention) — not applicable here.

**Why not Python / Pydantic-AI:** its AG-UI backend is an ASGI app (uvicorn/Starlette)
that needs an always-on or serverless Python host — it cannot run on GitHub Pages and
splits the repo into two languages.

## Consequences

- BYOK in-browser is the live tier (PR2). The keyless GitHub-Models path (GitHub Models
  has no browser CORS) and the `@ag-ui/client` `HttpAgent` SSE transport are **deferred**
  (YAGNI) to an optional Cloudflare Worker, built only if a no-key public demo is wanted.
- The BYOK key is held in `sessionStorage` only (never persisted), per US-7.
- The three replay tiers degrade gracefully: Live (BYOK) → Demo (offline replay).

## References

- [AG-UI client SDK](https://docs.ag-ui.com/sdk/js/client/overview)
- [Vercel AI SDK — tools & tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Pydantic AI — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/)
- [GitHub Models REST API](https://docs.github.com/en/rest/models/inference) (no browser CORS)
