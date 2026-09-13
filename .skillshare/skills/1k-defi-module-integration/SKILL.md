---
name: 1k-defi-module-integration
description: Navigate and implement OneKey App Earn, Borrow, Staking, and DeFi Portfolio flows. Use for protocol data, portfolio actions, transactions, pending/history, refresh, and Earn routes.
---

# Earn / DeFi

Use this skill as a map to the owning surface and service contract. Derive
product behavior from current code, server data, and the real runtime.

## Operation And Refresh Boundary

Keep the full operation scope—account, network, provider, market/reserve,
position, token/symbol, action, and request id—through setup, business
transaction, status, and refresh. A seeded approval/allowance or cached
position is a display/input hint, not proof of current chain state: reconcile
chain allowance when an approval-sensitive dialog mounts. Preserve native versus
wrapped assets and server-derived symbols instead of inferring them from a
provider name.

Treat pending/history metadata as a contract. SpeedUp replacements inherit the
metadata needed by pending guards; replacement linkage remains available for
those guards, while Cancel replacements must not render as the original
collateral/staking action after an indexer merge. Keep display filtering
separate from operation locks and carry replacement identity through
local/remote reconciliation.

For Earn/Borrow refreshes, distinguish cached, empty, loading, error, and
settled states. Preserve a complete visible snapshot during refresh, keep
dynamic rows mounted while their height transitions, and invalidate recycled
lists explicitly when expanded content changes. Close a selector/modal at the
user action boundary, then load the new market/reserve asynchronously.

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
| Approval, collateral, or pending/history mismatch | Exact account/network/provider/market/reserve owner and merge path | [Operation flow](references/operation-flow.md), [Portfolio actions](references/portfolio-actions-guide.md) |
| Portfolio position or action | Position data, supported action, transaction builder | [Portfolio actions](references/portfolio-actions-guide.md) |
| Market asset → Earn detail handoff | Market response plus existing Earn route helper | [Architecture](references/app-architecture.md), [Code map](references/code-map.md) |
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
