---
title: Architecture Decision Records
description: Index of ADRs in MADR format, filed sequentially by number.
---

# Architecture Decision Records

Format: [MADR][madr] (simplified) — filenames `NNNN-kebab.md`,
numbers assigned sequentially and never reused.

New ADR: copy the most recent file, increment the number, and fill in
**Status / Context / Decision / Consequences**. Supersedes/amendments go in the
**Status** line of both ADRs.

| ADR | Title | Status |
|---|---|---|
| [0001][adr-0001] | Agent runtime stack | Accepted |
| [0002][adr-0002] | Edge proxy platform: Cloudflare Workers | Accepted |
| [0003][adr-0003] | Live-agent catalog instruction | Accepted |
| [0004][adr-0004] | Self-contained replay snapshots | Accepted |

[madr]: https://adr.github.io/madr/
[adr-0001]: 0001-agent-runtime-stack.md
[adr-0002]: 0002-edge-proxy-platform.md
[adr-0003]: 0003-live-catalog-instruction.md
[adr-0004]: 0004-self-contained-replay-snapshots.md
