---
name: 1k-perps-module
description: Use only for explicit OneKey Perps/Hyperliquid (`views/Perp`, ServiceHyperLiquid, perpetuals, 永续/合约, Perps trading). Covers orderbook/L2/BBO, TWAP, scale/TIF/trigger/reduce-only, Perps TradingView/K-line, Perps Relay deposit, token selector, positions/account state/PnL/funding/margin/liquidation. Exclude generic Swap/Market/TradingView; Swap Relay quote/status/pending/requestId alone is not enough unless Perps deposit/Hyperliquid/`views/Perp`/`usePerpDeposit`/`fetchPerpDeposit*`/`perpsDepositOrderAtom` is explicit.
allowed-tools: Read, Grep, Glob, Bash
---

# Perps / Hyperliquid Domain Guide

Use this as a **Perps/Hyperliquid domain router** for order semantics, realtime subscriptions, and UI/background state races. Choose the owner and proof path; verify anchors with `rg` before editing.

## 60-Second Triage

1. **Gate**: use only when OneKey Perps/Hyperliquid is explicit in the prompt or file path.
2. **Infer scope**: asset type (`perp`/`spot`), account/dex, order mode, and platform. Ask only if missing scope blocks correctness or creates trading risk.
3. **Pick owner** from the matrix; avoid downstream display shims for trading/realtime contracts.
4. **Load minimum refs**: one matching reference first; add [code-map.md](references/rules/code-map.md) / [validation-recipes.md](references/rules/validation-recipes.md) only for owner/proof/implementation.

## Trigger Boundary

| Prompt/file signal | Use this skill? | First move |
| --- | --- | --- |
| `views/Perp`, ServiceHyperLiquid, Hyperliquid, Perps/永续/合约 trading | Yes | Pick owner below, then one reference |
| Generic Market K-line, generic TradingView bridge, generic token selector | No | Use adjacent Market/TradingView/token-selector skill or repo search |
| Generic Swap Relay quote/status/pending/requestId | No | Use `$1k-trade-swap-market` unless Perps deposit is explicit |
| Perps deposit, `usePerpDeposit`, `fetchPerpDeposit*`, `perpsDepositOrderAtom`, `perp-deposit` endpoint | Yes | Open [deposit-relay.md](references/rules/deposit-relay.md) |

If Perps/Hyperliquid is only a guess, do **not** load all references; verify the file/surface with `rg` or use the adjacent skill.

## Owner Matrix

| Surface | Primary owner | Usual proof |
| --- | --- | --- |
| Order submit/cancel/TWAP/scale/TIF | `ServiceHyperliquidExchange.ts`, Hyperliquid `actions.ts`, shared Perps utils/types | SDK type/source check + targeted order utility/action tests |
| L2/BBO/orderbook subscriptions | `ServiceHyperliquidSubscription.ts`, Hyperliquid context actions, freshness utils | rapid switch/reconnect + L2/BBO freshness proof |
| Deposit quote/status | `packages/kit-bg/src/services/ServiceSwap.ts`, `perpsDepositOrderAtom` | active `fromTxId`; `requestId` only when backend/Relay exposes it |
| Positions/account state/funding/margin/liquidation | `ServiceHyperliquid.ts`, Hyperliquid context atoms/actions, account-scoped Perps hooks/utils | account/dex/asset scoped proof; no stale positions/account summary |
| Perps TradingView/K-line/chart lines | `packages/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2.tsx` | readiness/message/reconnect scenarios |
| UI-only display | Perps component/list/row files | display proof only; do not mutate trading contracts here |

## Quick Reference

| Topic | Guide | Start With |
| --- | --- | --- |
| Code map | [code-map.md](references/rules/code-map.md) | `views/Perp`, Hyperliquid context, BG service, shared types/utils |
| Order contracts | [order-contracts.md](references/rules/order-contracts.md) | TWAP, scale, TIF, trigger, reduce-only, precision |
| State and subscriptions | [state-subscriptions.md](references/rules/state-subscriptions.md) | account/dex/asset scoping, L2/BBO, active target, cleanup |
| Perps TradingView bridge | [tradingview-bridge.md](references/rules/tradingview-bridge.md) | `TradingViewPerpsV2`, Perps K-line readiness, chart lines |
| Relay deposit | [deposit-relay.md](references/rules/deposit-relay.md) | Perps deposit address flow, requestId tracking, pending cards |
| Positions/account state | [positions-account-state.md](references/rules/positions-account-state.md) | positions, balances, PnL/PNL/P&L, funding, margin, liquidation |
| Failure patterns | [failure-patterns.md](references/rules/failure-patterns.md) | recurring bugs and hard-to-see regressions |
| Validation recipes | [validation-recipes.md](references/rules/validation-recipes.md) | targeted tests and runtime paths |
| Review checklist | [review-checklist.md](references/rules/review-checklist.md) | PR/source checks and release risk gates |
| Source index | [source-index.md](references/rules/source-index.md) | volatile SDK/API/docs/vault lookup points |

## Agent Routing Examples

| User asks about | Load first | Then verify |
| --- | --- | --- |
| "TWAP cancel/list/history is wrong" | order contracts + code map | TWAP state/cancel/history recipes |
| "Scale order children/precision/TIF" | order contracts | scale utility tests + partial-failure runtime path |
| "Orderbook flashes old BTC after ETH switch" | state/subscriptions + code map | rapid asset/account switch; L2/BBO freshness |
| "Perps K-line blank after offline/reconnect" | TradingView bridge | ready-state/reconnect scenarios, native if touched |
| "Perps deposit pending/completed wrong" | Relay deposit | active tx/request scope and stale quote cases |
| "Perps positions/PnL/funding/margin/liquidation/account summary stale" | positions/account state | account/dex/asset scope; no stale position/account display |
| "Review a Perps PR" | changed-surface reference first; review checklist second | use failure patterns to challenge findings and validation gaps |

## Output Defaults

- Implementation: report surface, state owner, order/subscription contract touched, files changed, targeted validation, and runtime proof gaps.
- Review: lead with findings; separate correctness blockers, release blockers, and follow-up improvements.
- Research: distinguish stable module rules from volatile backend/API/business facts that must be rechecked.

## Hard Stops

- Do not log private keys, signatures, mnemonics, raw sensitive payloads, or user secrets while debugging Perps.
- Do not bypass enable-trading, account bind, signing, or risk validation just to make a UI submit succeed.
- Do not use production live order placement/cancel/withdraw/deposit as validation unless the user explicitly authorizes that exact action and account.
- Do not change the owner of truth through a downstream display shim; edit the owner itself.
- Do not use ticker/mid recovery as proof that orderbook, token selector, or TradingView recovered — verify each surface's own freshness/readiness.
- Do not leave old L2/BBO/orderbook/chart-line data visible after an asset/account/dex switch.
- Do not couple K-line WebView recovery to global WS recovery.
- Do not trust Relay deposit status by deposit address alone when a request/requestId scope exists.

## Verify Against the Source

Order semantics, TIF, TWAP, scale, trigger, and reduce-only are **volatile, SDK-versioned contract facts** — confirm them against the source, do not trust memory:

- SDK types (type-enforced, in repo): the action method files under `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/`.
- Official docs: <https://hyperliquid.gitbook.io/hyperliquid-docs> (API → Exchange endpoint).
- Recheck on every `@nktkas/hyperliquid` bump; new fields/TIF values (e.g. `FrontendMarket`) appear over time.

## Related Skills

- `$1k-tradingview-communication` - TradingView message contracts and iframe bridge.
- `$1k-state-management` - Jotai atom/context conventions.
- `$1k-performance` - Render, subscription, and hot-path performance.
- `$1k-trade-swap-market` - Adjacent trade/review/history patterns; do not copy swap provider semantics blindly.
- `$1k-cross-platform` - Platform-specific RN/Web/Desktop behavior.
- `$1k-analytics` - Perps analytics/logging changes.
