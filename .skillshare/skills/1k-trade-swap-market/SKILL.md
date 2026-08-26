---
name: 1k-trade-swap-market
description: Navigate OneKey App Swap, Bridge, Limit, and Stock/Market flows. Use for token selection, quotes, review/build/send, providers, cold start, and history/status; use the Perps skill for Hyperliquid.
---

# Trade / Swap / Market

Use this skill as a map to the owning code and contract. Let current code,
payloads, and runtime behavior decide implementation details.

## Quick Start

1. Reproduce the real entry and affected platform.
2. Trace `entry -> selection -> quote -> review -> execution -> history/status`.
3. Identify the first owner whose state or contract is wrong; inspect adjacent
   consumers before editing.
4. Preserve the trade identity across async boundaries, make the smallest
   owner-correct change, and verify the same user path.

## Find The Owner

| Task | Start here | Read next |
| --- | --- | --- |
| Swap selection, quote, review, or send | Swap state/actions, view hooks, background service | [Architecture](references/app-architecture.md), [Code map](references/code-map.md) |
| Wallet, Send, Earn, Buy, or Market handoff | Source params, then settled Swap state | [Architecture](references/app-architecture.md) |
| Bridge, Limit, Stock, privacy, or provider work | Capability, payload, and lifecycle adapter | [Provider contracts](references/provider-contracts.md) |
| Cold start, default asset, tab, or first-frame issue | Route seed, persisted display state, readiness | [Architecture](references/app-architecture.md) |
| Pending, history, status, restart, or repair | Persistent owner and status source | [Provider contracts](references/provider-contracts.md) |
| Receive-only filtering | Receive and AssetSelector before any Swap handoff | [Code map](references/code-map.md) |

## Load Detail As Needed

- [Architecture](references/app-architecture.md) explains the execution spine,
  handoff ownership, runtime boundaries, and cold-start model.
- [Code map](references/code-map.md) gives stable directories and useful search
  anchors.
- [Provider contracts](references/provider-contracts.md) covers channels whose
  quote, settlement, or persistence semantics differ from an ordinary swap.
- [Validation](references/validation.md) helps choose focused tests and runtime
  evidence for the changed layer.

## Finish

State the entry, first wrong owner, and identities that matter. Run nearby tests
and the repository-required checks, then prove the affected route and payload on
the owning platform. Report any runtime or provider evidence you could not get.

Related skills: `$1k-perps-module`, `$1k-tradingview-communication`,
`$1k-state-management`, `$1k-cross-platform`, `$1k-defi-module-integration`.
