---
name: 1k-defi-module-integration
description: OneKey App Earn, Borrow, Staking, and DeFi Portfolio implementation or debugging. Use for protocol data, action visibility, claim/withdraw/repay, transactions, pending/history, refresh, and Earn routes.
---

# Earn / DeFi Domain Guide

Use this skill as an owner and contract router. Ground every decision in the
current code, payload, and owning service; do not treat an old issue or
implementation snapshot as product truth.

## Working Loop

1. Observe the failing or requested user path. If the user names an issue,
   thread, PR, payload, or server contract, inspect its current state.
2. Locate the first wrong owner: entry/route, UI state, portfolio data,
   supported action, transaction builder, order/status, or refresh.
3. Write down the stable identity and sequence before editing: account,
   network, provider, position, action, amount units, setup, business action,
   terminal state, and refresh target.
4. Find the closest current implementation with `rg`; reuse it only where its
   identity and operation semantics match.
5. Change the smallest stable owner and protect the nearest sibling protocols,
   actions, routes, and platforms.
6. Run focused tests and exercise the real owning route. If the fix fails,
   revisit the owner and contract instead of adding another local exception.

## Owner Router

| Symptom or change                                         | Start with                                                      | Load                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Earn home, list, recommendation, or detail                | Earn view/state owner and its service request                   | [app-architecture.md](references/app-architecture.md), [code-map.md](references/code-map.md) |
| Borrow market, reserve, collateral, or health factor      | Borrow view/hooks plus current lending contract                 | [operation-flow.md](references/operation-flow.md)                                            |
| Portfolio action missing or failing                       | Position metadata, supported actions, then transaction builder  | [portfolio-actions-guide.md](references/portfolio-actions-guide.md)                          |
| Claim, withdraw, repay, approval, permit, or order status | Operation sequence and terminal ownership                       | [operation-flow.md](references/operation-flow.md)                                            |
| Native route, modal, restart, event, or account switch    | Platform host and runtime ownership                             | [app-architecture.md](references/app-architecture.md)                                        |
| External protocol website                                 | Discovery/browser until a chain RPC enters the App              | [app-architecture.md](references/app-architecture.md)                                        |
| Funding or conversion after a handoff to Swap             | DeFi owns the prefill; Swap owns execution after quoting starts | `$1k-trade-swap-market`                                                                      |

## Stable Contracts

- Trace the full path from entry and data through action, setup, business
  transaction, status, and refresh. A successful build response is not a
  completed action.
- Preserve account, network, provider, position, action, token, and route
  identity across modal params, background calls, pending rows, and events.
- Treat portfolio positions, supported actions, and transaction building as
  separate contracts. Never infer all three from one response.
- Derive claim/config token and vault identity from current service data;
  never infer either from provider identity.
- Keep approval/permit/setup separate from the business transaction. Every
  success, failure, and cancel terminal must release duplicate-submit state.
- Refresh only the affected account/network after a successful
  position-changing outcome; reject stale results after owner changes.
- Native Earn is hosted by Discovery. AssetDetails modal routes must carry
  their own account context rather than assuming a Home provider is mounted.

## Reference Routing

Load only what the task needs:

- [app-architecture.md](references/app-architecture.md): surfaces, routing,
  runtime ownership, and cross-surface boundaries.
- [code-map.md](references/code-map.md): stable directories and search paths.
- [operation-flow.md](references/operation-flow.md): typed operation,
  transaction, pending, and refresh contracts.
- [portfolio-actions-guide.md](references/portfolio-actions-guide.md): action
  visibility, claim identity, grouped metadata, and build responses.
- [validation.md](references/validation.md): focused tests and runtime proof.

## Hard Stops

- Do not invent product behavior or request fields when client, server, or
  runtime evidence is missing or contradictory.
- Do not hide a portfolio position merely because it has no executable action.
- Do not create an internal DeFi action for an external DApp before an App-owned
  RPC or operation contract exists.
- Do not broaden shared Staking/Borrow utilities without sibling-protocol
  regression reasoning.
- Do not claim runtime success from a static diff, a passing utility test, or
  the existence of a rendered element.
- Do not edit generated locale files; use `$1k-i18n`.

## Done When

The owner and contract are explicit, the change is scoped to that owner,
focused tests pass, the affected route/platform demonstrates the intended
terminal state, and any unverified runtime or server dependency is disclosed.

## Related Skills

- `$1k-trade-swap-market` for Swap execution after a DeFi handoff.
- `$1k-state-management` for Jotai ownership.
- `$1k-cross-platform` for platform-specific UI and routing.
- `$1k-coding-patterns` for TypeScript, React, and error handling.
