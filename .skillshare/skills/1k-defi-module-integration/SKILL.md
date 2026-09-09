---
name: 1k-defi-module-integration
description: Navigate and implement OneKey App Earn, Borrow, Staking, and DeFi Portfolio flows. Use for protocol data, portfolio actions, transactions, pending/history, refresh, and Earn routes.
---

# Earn / DeFi

Use this skill as a map to the owning surface and service contract. Derive
product behavior from current code, server data, and the real runtime.

## Quick Start

1. Reproduce the real entry and affected platform.
2. Trace `entry -> data/position -> action -> transaction -> status -> refresh`.
3. Find the first owner whose identity, capability, or transition is wrong.
4. Reuse a nearby pattern only when its protocol and operation semantics match;
   then verify the changed path and a relevant sibling.

## Find The Owner

| Task | Start here | Read next |
| --- | --- | --- |
| Earn home, list, recommendation, or detail | Earn view/state and its service request | [Architecture](references/app-architecture.md), [Code map](references/code-map.md) |
| Borrow, staking, claim, withdraw, repay, or status | Operation owner and current service contract | [Operation flow](references/operation-flow.md) |
| Portfolio position or action | Position data, supported action, transaction builder | [Portfolio actions](references/portfolio-actions-guide.md) |
| Native route, modal, event, or account switch | Discovery host and runtime owner | [Architecture](references/app-architecture.md) |
| External protocol website | Discovery/browser until an App-owned RPC begins | [Architecture](references/app-architecture.md) |
| Funding handoff to Swap | DeFi prefill before quote; Swap execution afterward | `$1k-trade-swap-market` |

## Load Detail As Needed

- [Architecture](references/app-architecture.md) explains surfaces, hosts,
  runtimes, and cross-module boundaries.
- [Code map](references/code-map.md) gives stable directories and search anchors.
- [Operation flow](references/operation-flow.md) covers operation identity,
  setup, transaction, status, and refresh.
- [Portfolio actions](references/portfolio-actions-guide.md) covers how visible
  positions, supported actions, and transaction building join.
- [Validation](references/validation.md) helps choose focused tests and runtime
  evidence for the changed layer.

## Finish

State the owning surface/service and the identities that matter. Run nearby
tests and repository-required checks, then prove the affected route reaches the
intended terminal and refresh state. Report unavailable runtime or server proof.

Related skills: `$1k-trade-swap-market`, `$1k-state-management`,
`$1k-cross-platform`, `$1k-coding-patterns`.
