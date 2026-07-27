---
name: 1k-trade-swap-market
description: OneKey App Swap, Bridge, Limit, and Stock/Market implementation or debugging. Use for entries, token selection, quotes, review/build/send, providers, cold start, and history/status; excludes Perps.
---

# Trade / Swap / Market Domain Guide

Use this skill to locate the owning transition and execution contract. Trust
current code, payloads, and runtime behavior rather than a past issue or
implementation snapshot.

## Working Loop

1. Reproduce or inspect the real entry and state transition. Retrieve any
   current issue, thread, PR, payload, or API contract named by the user.
2. Trace in order: host/framework -> state machine -> hook/component. Do not
   patch the first component that displays the symptom.
3. Freeze identity and ownership: account, networks, tokens/assets, provider,
   receiver, amount mode, request/event id, execution type, and route source.
4. Follow `selection -> quote -> review -> build/send -> history/status` and
   identify the first incorrect transition.
5. Reuse the closest current pattern only when its identity, quote, settlement,
   and persistence semantics match; otherwise add a typed local adapter.
6. Make the smallest owner-correct change, run focused tests, and verify the
   real owning surface. If it still fails, revisit the hypothesis.

## Owner Router

| Symptom or change                                            | Start with                                                             | Load                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Direct Swap, token selection, quote, review, or send         | Swap state/actions, view hooks, background service                     | [app-architecture.md](references/app-architecture.md), [code-map.md](references/code-map.md) |
| Wallet, Home Token, Send, Earn, Buy, or Market handoff       | Source params, then settled Swap state after mount                     | [app-architecture.md](references/app-architecture.md)                                        |
| Bridge, Limit, Stock, broker, privacy, or new provider       | Channel capability and lifecycle contract                              | [provider-contracts.md](references/provider-contracts.md)                                    |
| Cold start, first-frame flicker, default token, or tab drift | Route seed, persisted display state, readiness, then quote state       | [app-architecture.md](references/app-architecture.md)                                        |
| Pending/history/status, disconnect, restart, or replay       | Visibility owner, persistent writer, identity, repair source           | [provider-contracts.md](references/provider-contracts.md)                                    |
| Receive-only token filtering                                 | Receive -> AssetSelector -> shared filter; use Swap only after handoff | [code-map.md](references/code-map.md)                                                        |
| Perps order, position, or deposit                            | Perps owner                                                            | `$1k-perps-module`                                                                           |

## Stable Contracts

- Entry surfaces own navigation, prefill, and analytics source. Once quoting
  starts, Swap owns selection, quote, review, build/send, and Swap history.
- Visible tab and internal execution type are separate. Sharing a combined Swap
  and Bridge surface must not erase Bridge, Limit, Stock, or provider semantics.
- Guard async results with account, network, token, provider, receiver, amount,
  request/event, and execution identity. Older work cannot update new state.
- A provider error is terminal only when the current quote event cannot still
  produce an actionable quote. Preserve manual provider intent.
- Review uses a frozen snapshot. It must not reread mutable page atoms after
  the user enters confirmation.
- Missing fee, rate, ETA, limit, or finality means unknown/unavailable unless
  the current contract explicitly defines zero.
- txid, order id, route id, and provider id have different roles. Define local
  writeback, listener, replay, repair, and terminal state for long-lived flows.
- Hiding local history while disconnected is not permission to delete it.

## Reference Routing

Load only what the task needs:

- [app-architecture.md](references/app-architecture.md): execution spine,
  entry ownership, platform runtimes, and cold-start boundaries.
- [code-map.md](references/code-map.md): stable directories and search paths.
- [provider-contracts.md](references/provider-contracts.md): quote, review,
  build/order, history, replay, and repair contracts.
- [validation.md](references/validation.md): focused tests and runtime proof.

## Hard Stops

- Do not invent or coerce provider fields to make a UI path proceed.
- Do not normalize missing values to zero or unknown finality to success.
- Do not use route params or cached display tokens as proof that quote/build is
  ready.
- Do not let mutable page state alter an open review/confirmation.
- Do not change persisted data to satisfy a visibility-only requirement.
- Do not claim a transaction or cold-start fix from unit tests or a settled
  screenshot alone; inspect the relevant transition and payload.
- Do not edit generated locale files; use `$1k-i18n`.

## Done When

The entry, first wrong transition, identities, and owners are explicit; the
change is scoped to that owner; focused tests pass; the real surface proves
the expected quote/review/send/history or first-frame behavior; and protected
Swap/Bridge/Limit/Stock/Market flows remain coherent.

## Related Skills

- `$1k-perps-module` for Perps/Hyperliquid-specific flows.
- `$1k-tradingview-communication` for TradingView message contracts.
- `$1k-state-management` for Jotai ownership.
- `$1k-cross-platform` for platform-specific UI and hosts.
- `$1k-defi-module-integration` for the DeFi side of an Earn-to-Swap handoff.
