---
name: 1k-trade-swap-market
description: Navigate OneKey App Swap, Bridge, Limit, and Stock/Market flows. Use for token selection, quotes, review/build/send, providers, cold start, and history/status; use the Perps skill for Hyperliquid.
---

# Trade / Swap / Market

Use this skill to preserve trade ownership and lifecycle boundaries. Start from
the current code, payloads, and runtime; do not treat this skill as a path
catalog or an implementation snapshot.

## Shared Market Trade Boundary

Market's embedded token/stock trade is an entry adapter, not a second trade
implementation. Once the embedded route mounts, reuse Swap's provider, quote,
timer, manual-refresh, review, build/send, fallback, and history owners. Keep
only Market-owned context (for example K-line/detail layout, stock variant
selection, speed config, sizing data, or header slots) at the boundary and pass
it through typed Swap extensions. Do not recreate a Market quote effect,
review dialog, action state, or input state beside the shared Swap ticket.

When a stock variant or network changes, migrate the full trade identity and
network-scoped pay-token state atomically. Keep the ticket mounted for partial
refresh, but reuse in-flight/detail/pay-token state only for the same complete
identity; clear incompatible selections before the next network's candidates
arrive. Treat transient config/quote readiness separately
from terminal unsupported/unavailable states so a fallback or explicit
unavailable surface is not hidden behind an endless skeleton or disabled action.

## Quick Start

1. Reproduce the real entry and affected platform.
2. Trace `entry -> selection -> quote -> review -> execution -> history/status`.
3. Identify the first owner whose state or contract is wrong; inspect adjacent
   consumers before editing.
4. Preserve the trade identity across async boundaries, make the smallest
   owner-correct change, and verify the same user path.

## Choose The Reference

Locate the current owner in the live source before editing, then load only the
reference that matches the failure class:

- [Architecture](references/app-architecture.md) for entry ownership, runtime,
  handoff, and cold-start boundaries.
- [Provider contracts](references/provider-contracts.md) for quote, review,
  build/send, provider lifecycle, and history semantics.
- [Validation](references/validation.md) for focused checks and owning-platform
  proof.

## Finish

State the entry, first wrong owner, and identities that matter. Run nearby tests
and the repository-required checks, then prove the affected route and payload on
the owning platform. Report any runtime or provider evidence you could not get.

Related skills: `$1k-perps-module`, `$1k-tradingview-communication`,
`$1k-state-management`, `$1k-cross-platform`, `$1k-defi-module-integration`.
