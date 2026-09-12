---
name: 1k-perps-module
description: "Use for OneKey Perps/Hyperliquid development/review: views/Perp, ServiceHyperLiquid, 永续合约, 订单簿, orderbook, TWAP, scale, Chase, Relay/Unifold deposits, signing, charts or layouts. Excludes generic Swap/Market."
allowed-tools: Read, Grep, Glob, Bash
---

# Perps / Hyperliquid

Use this guide to find the code and contracts relevant to the task. Start with the matching topic below; add another reference when the investigation crosses that boundary.

Paths describe the current implementation, not the only valid edit locations. Confirm them in the working branch. Older branches may have different providers or transports; follow their code without adding features or upgrading dependencies merely to match this guide.

## Find the relevant topic

| Task | Read first | Starting owner |
| --- | --- | --- |
| Copy, spacing, table rows, resize, scroll, keyboard | [Layout and interaction](references/rules/layout-interactions.md) | Perps component or layout |
| Submit, cancel, close, TP/SL, TWAP, scale, Chase, execution price | [Orders](references/rules/order-contracts.md) | Hyperliquid actions and exchange service |
| L2/BBO, switching, reconnect, stale quotes, tick performance | [Market data](references/rules/state-subscriptions.md) | Subscription service, context, orderbook |
| Positions, PnL, balances, account mode, funding | [Account state](references/rules/positions-account-state.md) | Account services and scoped hooks |
| Enable trading, lock/unlock, agent credentials, signing | [Session and signing](references/rules/session-signing.md) | Trading guards, account service, wallet proxy |
| Perps deposit, pending delivery, withdrawal routing | [Deposits](references/rules/deposits.md) | Select Relay or Unifold at the entry hook |
| Perps K-line, chart lines, chart messages, chart recovery | [TradingView](references/rules/tradingview-bridge.md) | PerpCandles and TradingViewPerpsV2 |

Generic Swap/Relay work belongs with `$1k-trade-swap-market`; generic chart bridge work with `$1k-tradingview-communication`. Use this skill when the actual surface is OneKey Perps, including its spot mode.

## Keep the task proportional

- Reuse known platform, account, instrument and repro details. Infer missing context from code; ask when the missing information prevents a correct next step.
- For a local display change, edit and verify that surface using existing repo checks. For trading, state or lifecycle changes, select the relevant topic's validation cases. The lists are choices, not a suite required for every Perps edit.
- UI formatting, selectors and local interaction state are valid owners. Trace incorrect trading facts to their source; reasonable refactoring can change ownership while preserving the contract.

## Shared boundaries

- Preserve account/instrument identity and distinguish display snapshots from data eligible for trading. Do not use another surface's recovery as proof of the affected surface's readiness.
- Keep secrets and signatures out of diagnostics; retain account binding, signing and risk validation. Production order placement, cancellation, deposits or withdrawals require explicit user authorization for the action and account. Reuse authorization already given in the task.

For cross-layer or runtime questions, use [ownership map](references/rules/code-map.md). For SDK/API uncertainty or dependency changes, use [source index](references/rules/source-index.md). For review or choosing evidence, use [validation recipes](references/rules/validation-recipes.md). For Perps analytics/埋点 changes, use `$1k-analytics`. Load related state, performance or cross-platform skills when their specialist guidance is needed.

Report the result and relevant evidence. In reviews, identify concrete code consequences; a preferred pattern or an unrelated unrun scenario is not itself a blocker. Note material validation gaps without inventing additional approval or CI requirements.
