---
name: 1k-defi-module-integration
description: Navigate and implement OneKey App Earn, Borrow, Staking, and DeFi Portfolio flows. Use for protocol data, portfolio actions, transactions, pending/history, refresh, and Earn routes.
---

# Earn / DeFi

Use this skill to preserve DeFi ownership and operation boundaries. Start from
current code, server data, and the real runtime; do not treat the skill as a
path catalog or an implementation snapshot.

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
settled states. Preserve a complete visible snapshot during refresh and make
identity changes invalidate the old result. Close a selector/modal at the user
action boundary, then load the new market/reserve asynchronously.

## Quick Start

1. Reproduce the real entry and affected platform.
2. Trace `entry -> data/position -> action -> transaction -> status -> refresh`.
3. Find the first owner whose identity, capability, or transition is wrong.
4. Reuse a nearby pattern only when its protocol and operation semantics match;
   then verify the changed path and a relevant sibling.

## Choose The Reference

Locate the current owner in the live source before editing, then load only the
reference that matches the failure class:

- [Architecture](references/app-architecture.md) for surface ownership, hosts,
  runtime boundaries, and cross-module handoffs.
- [Operation flow](references/operation-flow.md) for setup, status, async
  identity, replacement, and refresh behavior.
- [Portfolio actions](references/portfolio-actions-guide.md) for position
  read-model and capability/build contracts.
- [Validation](references/validation.md) for focused checks and platform proof.
- For a funding handoff, stop DeFi ownership when Swap begins quoting and use
  `$1k-trade-swap-market` for the remainder.

## Finish

State the owning surface/service and the identities that matter. Run nearby
tests and repository-required checks, then prove the affected route reaches the
intended terminal and refresh state. Report unavailable runtime or server proof.

Related skills: `$1k-trade-swap-market`, `$1k-state-management`,
`$1k-cross-platform`, `$1k-coding-patterns`.
