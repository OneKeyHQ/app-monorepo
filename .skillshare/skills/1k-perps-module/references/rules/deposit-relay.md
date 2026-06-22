# Relay Deposit for Perps

Open this for Perps deposit, Hyperliquid enable-trading fallback, Relay quote/deposit-address flow, pending cards, or deposit status bugs.

## Code anchors

- `packages/kit/src/views/Perp/hooks/usePerpDeposit.ts` - deposit flow/state.
- `packages/kit/src/views/Perp/hooks/usePerpDeposit.ts` (`usePerpDepositOrder`) - pending deposit filtering and polling kickoff.
- `packages/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback.ts` - enable-trading + deposit fallback orchestration.
- `packages/kit/src/views/Perp/hooks/useShowDepositWithdrawModal.ts` - modal entry/visibility.
- `packages/kit/src/views/Perp/components/TradingPanel/modals/DepositWithdrawModal.tsx` - deposit/withdraw UI surface.
- `packages/kit-bg/src/services/ServiceSwap.ts` - Perps deposit quote/status owner on BG (`fetchPerpDepositQuote`, `fetchPerpDepositOrderStatus`, `perpDepositOrderFetchLoop`).
- `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts` - Perps account/session and server deposit-token config parsing; not the quote/status owner.
- `packages/kit-bg/src/states/jotai/atoms/perps.ts` - `perpsDepositOrderAtom` pending deposit storage.

## Stable contract

- Do not client-index all chains to discover Perps deposits.
- Use Relay-supported quote/status paths for the current deposit flow.
- Current app-side owner asks the swap backend for `/swap/v1/perp-deposit-quote`; recheck backend/Relay request fields before changing quote shape.
- If a deposit-address Relay response is used, trust deposit addresses only from explicit deposit-address fields such as `step.depositAddress` or `item.data.depositAddress`.
- Do not fallback to generic `item.data.to` as a deposit address.
- Current persisted pending status is tx-scoped by `fromTxId`. Treat backend/Relay `requestId` as a stronger scope only when the current API response exposes it.
- If the same deposit address gets a new explicit request scope, do not reuse old completed/refund/failure state.

## UX boundaries

- Closing a deposit modal must not make a pending deposit disappear if the user still needs tracking.
- Pending tracking cards should survive modal close where product expects continued visibility.
- Copy-address UX must be tied to the currently selected quote/request, not a stale quote.
- Amount/source-chain changes invalidate quote-dependent address/status assumptions.

## Risk gates

- Non-EVM origin chains need explicit refund UX before enabling if origin-native refund is not handled.
- Relay error strings are not a stable protocol guarantee; do not encode business logic only from text matching.
- Recheck current backend/API expectations before changing quote fields, `requestId`, refund, or failure-state handling.

## Validation focus

- Change amount after quote: no stale deposit address/request reused.
- Copy address after quote refresh: copied address matches visible active request.
- Close modal with pending deposit: pending card remains if required.
- Same deposit address with a new explicit request scope if available: old terminal status does not override new request.
- Pending tx polling: status update matches the active `fromTxId` and account/indexedAccount scope.
- Refund/failure/completed paths: visible status matches active request.
