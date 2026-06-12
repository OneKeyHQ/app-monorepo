# Perps Positions and Account State

Open for Perps/Hyperliquid positions, account summary, balances, PnL/P&L, funding, margin, liquidation, withdrawable/account value, or stale account-scoped state. Do **not** use for generic wallet portfolio, token balances, or non-Perps topics.

## Starting anchors

- Account summary: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`, `packages/kit-bg/src/states/jotai/atoms/perps.ts` (`perpsActiveAccountSummaryAtom`).
- Hyperliquid context state/actions: `packages/kit/src/states/jotai/contexts/hyperliquid/atoms.ts`, `actions.ts`, `utils/`.
- Account-scoped helpers: `packages/kit/src/views/Perp/utils/accountScopedData.ts`, `packages/kit/src/views/Perp/hooks/usePerpsAccountScopedCacheAddress.ts`, `usePerpsAccountScopedActivePositions.ts`, `usePerpsActivePositionsByAddress.ts`.
- Positions/orders panel: `packages/kit/src/views/Perp/components/OrderInfoPanel/PerpOrderInfoPanel.tsx`, `List/`, `Components/`, `ClosePositionModal.tsx`, `SetTpslModal.tsx`.
- Funding/liquidation display helpers: `packages/kit/src/views/Perp/hooks/useFundingCountdown.ts`, `useLiquidationPrice.ts`, `packages/kit/src/views/Perp/utils/leverageDisplay.ts`.
- Source/API: `packages/shared/types/hyperliquid/sdk.ts`, `packages/shared/types/hyperliquid/types.ts`, [source-index.md](source-index.md).

## Owner rules

- Treat accountId/indexed account, account address, dex, asset/coin, and asset type as query/cache/state key dimensions.
- Account/position truth belongs in Hyperliquid account/webData/service/context owners; list rows and modals may format or filter but must not invent truth.
- During account/asset/dex switches, hide/empty or clear stale positions, balances, PnL, margin, funding, liquidation, open orders, and TP/SL references until scoped data is valid.
- Reduce-only, close-position, and TP/SL flows must validate against the currently selected scoped position, not a cached row from a previous account/symbol.
- Funding, margin, and liquidation fields are API/product-versioned; recheck source/business contract before hardcoding.

## Validation focus

- Account switch replay: A has positions -> switch to B -> address mismatch hides A positions, PnL, summary, margin, and liquidation until B data is valid.
- Asset/dex switch: selected position and TP/SL/close modal still match the visible instrument.
- Funding/liquidation display: existing tests first (`useLiquidationPrice.test.ts`, `leverageDisplay.test.ts`), then missing/undefined API-field scenarios.
- Account-scoped helpers: run or extend `packages/kit/src/views/Perp/utils/accountScopedData.test.ts` and `usePerpsActivePositionsByAddress.test.ts` when changing scoping behavior.
