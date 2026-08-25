---
title: Agent-Readiness — status, findings, and playbook
description: What was shipped to make agenthud + the qte77 origin agent-discoverable/callable, the non-obvious architecture findings, a best-practice playbook, and the ranked remaining gaps against the ora.ai / orank scan and the Agent Native Builders Hackathon categories.
# Volatile status — the ONLY place the current numbers live (keep prose evergreen). Update on rescan.
ora_target: qte77.github.io
ora_score: 56
ora_grade: C
ora_scanned: 2026-08-25
snapshot: 2026-08-25
---

# Agent-Readiness — status, findings, playbook

Cross-cutting reference for making the qte77 estate **agent-discoverable** (crawlers/scanners find it)
and **agent-callable** (agents invoke it over MCP/A2A). Prompted by the **Agent Native Builders
Hackathon** (6 categories: Discovery, Content, Trust, Execution, Agent-to-Agent, Identity & Auth) and
the **ora.ai / orank** agent-readiness scan of `qte77.github.io`.

## Status — snapshot 2026-08-25

> **This section is a dated snapshot**, not evergreen. The live source of truth is the ora scan; this
> doc *curates* it. Refresh per [Keeping this doc current](#keeping-this-doc-current). Durable content
> (the architecture finding + playbook + gotchas below) does not go stale — edit those only on a real
> topology/spec change.

- **Arc 017 shipped, deployed, verified** — the Worker (`agenthud-proxy.cloudflare-driveway392.workers.dev`)
  serves, alongside the BYOK relay:
  - `GET /.well-known/agent-card.json` — A2A Agent Card (skills = the MCP tools; interface → `/a2a`).
  - `POST /mcp` — stateless MCP server (`createMcpHandler`): `render_ui`, `validate_a2ui_batch`.
  - `POST /a2a` — minimal A2A JSON-RPC; `message/send` → a completed Task carrying the A2UI batch.
  - Verified live: card `200`; MCP `tools/list` (Streamable HTTP SSE); A2A `message/send` → a rendered
    2-message batch. See [ADR-0005][adr-0005] · [`worker/README.md`][worker].
- **Origin discovery shipped** in the **`qte77/qte77.github.io`** repo (PR #55): origin-level
  `/.well-known/agent-card.json`, `/openapi.json` (OpenAPI 3.1), `robots.txt` Content-Signal, llms.txt
  (now names agenthud + links the OpenAPI), homepage `SoftwareApplication` JSON-LD.
- **ora score: 45 → 56 (grade D → C).** Rescan:
  `POST https://ora.ai/api/scan {"url":"qte77.github.io"}` then
  `GET https://ora.ai/api/score/qte77.github.io` (the POST echoes the stale cached score; the GET ~45s
  later has the fresh one).

## The architecture finding that trips everyone

**ora scans the ORIGIN ROOT `qte77.github.io` — which is a *different* repo than this one.**

- `qte77.github.io` is a GitHub **user site** served by the **`qte77/qte77.github.io`** repo (Jekyll).
- **agenthud deploys to a subpath**: `qte77.github.io/agenthud-agui-a2ui/` (`ui/vite.config.ts` `base`).
- The **Worker is a third origin**: `agenthud-proxy…workers.dev`.

Consequences (each cost real time to learn):

1. **`robots.txt` and `/.well-known/*` are only honored at the origin root.** A file in agenthud's
   `ui/public/` deploys under the subpath and is **invisible** to origin-root probes. Discovery files
   MUST live in `qte77/qte77.github.io`.
2. **Cross-origin pointer pattern:** publish thin docs/specs at the origin root (`/openapi.json`,
   llms.txt entries, `/.well-known/*`) that **link to the Worker's live endpoints**. ora appears to
   credit these (it follows llms.txt links cross-origin) — but confirm by rescan.
3. **GitHub Pages cannot set custom response headers.** So origin-scoped checks that need a header —
   HTTP `Link:` (RFC 8288), markdown `Vary: Accept` negotiation, a 401 `WWW-Authenticate` — are
   **capped** unless served from the Worker (or a CDN fronting the origin). Do header-dependent signals
   on the Worker, not the Pages origin.
4. **Jekyll gotchas:** dot-dirs like `.well-known/` are ignored unless added to `include:` in
   `_config.yml`; a file with **no front matter** is copied verbatim (good for JSON/`.md`); root `.json`
   files (e.g. `openapi.json`) are served as `application/json`.

## What moved the score 45 → 56

| Signal | File (origin repo) | ora gap closed |
|---|---|---|
| A2A Agent Card | `/.well-known/agent-card.json` (Jekyll `include`) | `a2a-agent-card` |
| OpenAPI 3.1 | `/openapi.json` (typed ops, servers→Worker) | `openapi-spec`, dev-resource-discovery |
| Content-Signal + AI-crawler allows | `robots.txt` | robots AI-crawler policy (Trust) |
| llms.txt names agenthud + when-to-use + OpenAPI link | `llms.txt` (+ `.tpl`) | `agent-instruction`, discovery |
| SoftwareApplication JSON-LD | `_includes/meta.html` (homepage) | `schema-type-breadth` |

## Best-practice playbook — where each signal lives

- **[origin-root · `qte77/qte77.github.io`]** robots + Content-Signal + `schemamap:`; llms.txt (+ per-section
  `/docs/llms.txt`); `/index.md` + `.md` twins; JSON-LD breadth (SoftwareApplication/Organization/FAQPage,
  `sameAs`); `/.well-known/agent-card.json`, `ai-catalog.json`, `agent-skills/index.json`,
  `mcp/server-card.json`, `oauth-*` metadata; `/openapi.json`; `/auth.md`; `/contact`+`/privacy`;
  agent-friendly `404`. (Header-dependent ones are capped here — see finding #3.)
- **[Worker · agenthud]** live MCP (`/mcp`) + A2A (`/a2a`), JSON error envelopes, `WWW-Authenticate`
  + OAuth PRM (the MCP SDK exports `oauthMetadataResponse`/`requireBearerAuth`/
  `getOAuthProtectedResourceMetadataUrl`), rate-limit headers, versioning, MCP Apps (`ui://`).
- **[in-page · agenthud `ui/`]** WebMCP (`document.modelContext.registerTool` + tool-attribute forms).
- **[external]** Wikipedia/Wikidata entity, npm/PyPI SDK, ChatGPT app directory, skills.sh.

## Gotchas / learnings

- **A POST-only endpoint is a "dead link" to llms.txt checkers.** ora GETs each llms.txt link; `/mcp`
  and `/a2a` are POST-only → they 404/405 on GET → flagged as unresolved. **Reference MCP/A2A via a
  GET-able pointer** (a `server-card.json`, the agent-card, or descriptive text), not the raw
  POST endpoint URL.
- The default llms.txt template linked GitHub **blob** URLs; ora flags those as non-resolving too —
  prefer links to the published site or raw content.
- Deploying the Worker doesn't move the origin score by itself; the **origin repo** must publish the
  pointers and be **merged** (GitHub Pages rebuilds only on merge to `master`).

## Remaining gaps at 56/100 (ranked, grouped by where)

**Origin-root static (cheap, `qte77/qte77.github.io`):**
`/.well-known/ai-catalog.json` (ARD) · `/.well-known/agent-skills/index.json` · `/.well-known/mcp/server-card.json`
+ a `/.well-known/mcp` or llms.txt MCP reference · **`/auth.md`** (WorkOS structure — the Auth goal is the
lowest-scoring) + `/.well-known/oauth-protected-resource` · `/index.md` + `.md` twins + `<link rel="alternate"
type="text/markdown">` · fix llms.txt dead links (drop the raw `/mcp` link) · JSON-LD breadth (FAQPage,
Organization `contactPoint`/`address`) · `schemamap:` in robots · `/contact` + `/privacy` (500+ chars) ·
agent-friendly 404 body · `/developers` portal page · `?mode=agent` view · `plugin.json` (agent-plugins.org).

**Worker code (agenthud, PR + redeploy — deploy is unblocked now):**
consistent **JSON error envelope** (405/403 are plain text today) · rate-limit response headers ·
`WWW-Authenticate` + OAuth PRM/AS metadata on the Worker (header-capable origin) · OpenAPI extras
(Idempotency-Key, pagination, versioning, async-job, batch) · **MCP Apps** (`ui://` resources +
`_meta.ui.resourceUri` on tools — closes the A2UI-in-chat gap) · a live `/.well-known/mcp` handshake ·
optional NLWeb `/ask`.

**in-page (agenthud `ui/`):** WebMCP.

**External / long-lead:** Wikipedia/Wikidata entity · npm SDK for the Worker API · ChatGPT app directory ·
more skills.sh repos · Web Bot Auth directory (needs Ed25519 key mgmt).

Full upside-ranked roadmap: the approved plan in the session notes (`deep-conjuring-pie.md`).

## Next steps — actionable, ordered (snapshot 2026-08-25)

Cheapest origin-root wins first (one PR in `qte77/qte77.github.io` → merge → rescan), then the Worker
batch (PR here → `wrangler deploy`), then in-page, then external. **Tick each item in the PR that ships
it.**

1. [ ] **Fix llms.txt dead links** — drop the raw `/mcp` POST URL (it 404s on a GET probe); repoint the
   GitHub-blob links to published/raw content. (origin) — *quick, and it's an active `-2pt` failure.*
2. [ ] **`/auth.md`** (WorkOS sections: Discover · Pick a method · Register · Claim · Use · Errors ·
   Revocation) **+ `/.well-known/oauth-protected-resource`** JSON. (origin) — *the Auth goal is the
   lowest-scoring; biggest single cluster left that's static.*
3. [ ] **`/.well-known/ai-catalog.json`** (ARD) · **`/.well-known/agent-skills/index.json`** ·
   **`/.well-known/mcp/server-card.json`** (name/description/version/serverUrl/tools[]). (origin — verify
   each emerging schema at source first)
4. [ ] **`/index.md`** + `<link rel="alternate" type="text/markdown">` in `<head>`; **`schemamap:`** in
   robots. (origin)
5. [ ] **JSON-LD breadth**: FAQPage + Organization `contactPoint`/`address`; **`/contact` + `/privacy`**
   (500+ chars each). (origin)
6. [ ] **Worker: JSON error envelope** on every error path + **rate-limit headers** + OpenAPI extras
   (Idempotency-Key/pagination/versioning/async-job). (agenthud Worker — PR + redeploy)
7. [ ] **MCP Apps** — `ui://` resources + `_meta.ui.resourceUri` on tools (renders A2UI in-chat; closes
   the A2UI/generative-UI gap). (Worker)
8. [ ] **WebMCP** — `document.modelContext.registerTool` + tool-attribute forms. (agenthud `ui/`; needs disk)
9. [ ] **External:** npm SDK for the Worker API · Wikipedia/Wikidata entity · ChatGPT app directory. (own arcs)

## Estate pattern

Bank these as a reusable **baseline** in `qte77/__repo-baseline` (L2), generated via
`qte77/gha-llms-txt-action`, with an estate-wide skills index from `qte77/gha-repo-index`; backport the
Worker pattern to `sortmy.london` (ldnmxx-hack); consolidate the shared A2UI contract + reusable MCP tool
factories into `@qte77/a2ui-agui-kit` (arc 018).

## Deploy + verify (Worker)

```bash
# CLOUDFLARE_API_TOKEN (Edit Cloudflare Workers scope) in gitignored worker/.env, sourced inline:
bash -c 'set -a; . worker/.env; set +a; npm --prefix worker run deploy'
# verify live: node-fetch the card + an MCP tools/list + an A2A message/send (see docs history).
```

## Keeping this doc current

Structured to age well by separating **durable** from **volatile**:

- **Durable (evergreen — the value):** the *architecture finding*, the *playbook* (where each signal
  lives), and the *gotchas/learnings*. Independent of the score; edit only when the estate topology or a
  spec changes.
- **Volatile (point-in-time):** the current score/grade/date live **in the frontmatter**
  (`ora_score`/`ora_grade`/`ora_scanned`) — the single place to update, so the number can't drift across
  prose. The *Status*, *Next steps*, and *Remaining gaps* sections are dated snapshots that curate the
  live scan.

Rules that prevent staleness:

1. **Numbers live in frontmatter, not prose.** Update `ora_score`/`ora_grade`/`ora_scanned` on each
   rescan; the body narrates *changes* (e.g. "45 → 56"), not the current absolute.
2. **Don't duplicate the raw ora gap list** — it changes every scan. Keep only *our prioritization* + a
   link to the live scan (<https://ora.ai/score/qte77.github.io>).
3. **Tick the Next-steps checkbox in the same PR that ships the item** (same discipline as a plan's
   remaining-work table — a merged PR must not leave its item unchecked).
4. **When a gap closes, move it to the Score history below** (one line) instead of re-listing everything.
5. **Date every snapshot heading**; re-run the refresh command when you touch one.

Refresh: `POST https://ora.ai/api/scan {"url":"qte77.github.io"}` → wait ~45 s →
`GET https://ora.ai/api/score/qte77.github.io` (the POST echoes the stale cached score; the GET has the
fresh one). Then update the frontmatter.

### Score history

- **2026-08-25: 45 → 56** (D → C) — PR #55 shipped the origin A2A card, `/openapi.json`, robots
  Content-Signal, llms.txt (names agenthud + OpenAPI link), and homepage `SoftwareApplication` JSON-LD;
  Worker (arc 017) deployed live (MCP + A2A + card).

## References

- ora.ai methodology <https://ora.ai/methodology> · [`worker/README.md`][worker] · [protocols][protocols]
- Specs: A2A <https://a2a-protocol.org> · MCP <https://modelcontextprotocol.io> · ARD
  <https://agenticresourcediscovery.org/> · agent-plugins <https://agent-plugins.org/specification> ·
  WorkOS auth.md <https://workos.com/auth-md> · RFC 9728/8414 (OAuth metadata) · RFC 9727 (api-catalog) ·
  RFC 8288 (Link) · NLWeb <https://github.com/microsoft/NLWeb>.

[adr-0005]: decisions/0005-agent-native-endpoints.md
[worker]: ../worker/README.md
[protocols]: protocols.md
