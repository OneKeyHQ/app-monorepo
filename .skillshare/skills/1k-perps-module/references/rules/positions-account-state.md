# Perps Accounts, Positions and Funding

Use for account summary, positions/orders, PnL, balances, account mode, funding, margin, liquidation or stale account data. Pure row formatting can remain in the component. Generic wallet portfolio work is outside this reference.

## Starting points

- Account info/status: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`; readiness, snapshots and summary atoms in `packages/kit-bg/src/states/jotai/atoms/perps.ts`.
- UI readiness: `packages/kit/src/views/Perp/hooks/usePerpsAccountDisplayState.ts`; scoped helpers `usePerpsAccountScopedCacheAddress.ts`, `usePerpsAccountScopedActivePositions.ts`, `usePerpsActivePositionsByAddress.ts` in the same hooks directory.
- Identity/merge: `packages/kit/src/views/Perp/utils/accountScopedData.ts`; `packages/kit/src/states/jotai/contexts/hyperliquid/utils/accountSwitchCleanup.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/utils/coldStartMergeUtils.ts` and context `actions.ts`.
- Panels/actions: `packages/kit/src/views/Perp/components/OrderInfoPanel/` lists, rows and position/order modals.
- Account mode: `packages/kit/src/views/Perp/components/TradingPanel/modals/AccountModeModal.tsx`, `packages/kit-bg/src/services/ServiceHyperLiquid/userAbstractionMode.test.ts`.
- Portfolio: `packages/kit/src/views/Perp/components/Portfolio/usePerpPortfolioData.ts`, `packages/shared/src/utils/hyperliquidPortfolioUtils.ts`.

## Identity and readiness

Account IDs/indexed account IDs and addresses serve different lookup/readiness roles. Select the actual dimensions needed by each state/query (including dex/coin/mode where applicable), rather than putting every identifier in every cache key.

An account display snapshot can avoid an empty transition while live status is pending. Its identity must match the selected account. `usePerpsAccountDisplayState` distinguishes selection resolved, display ready and live status pending; a painted snapshot does not establish trading eligibility.

On account switch, prevent old positions, spot/perp orders, TWAP, balances and summaries from being presented as the next account. Existing cleanup can retain next-account cache and clear invalid data individually. Do not unconditionally erase valid caches or assume clearing one atom handles all consumers.

Close/reduce-only/add-position/TP-SL actions must use the intended scoped position after asynchronous work, including when the active chart has another coin. For action payload and price rules, read [orders](order-contracts.md). For unreadable credentials or enable-trading status, read [session/signing](session-signing.md).

## Account modes and financial fields

The current mode UI distinguishes unified account and portfolio margin. Follow the abstraction-mode action, cache/live result and active-account checks when changing mode handling. Keep eligibility thresholds/configuration tied to their current source; do not hardcode a remembered product limit.

Account value, withdrawable balance, available margin and spot holdings are different measures. Trace their existing portfolio helpers instead of summing balances in a row or treating missing data as a funded/empty account. `useLiquidationPrice.ts` and `utils/leverageDisplay.ts` own relevant display/estimation helpers; preserve the intended mark/oracle/position inputs.

## Funding sources

- Settled user funding: `usePerpUserFundingHistory` is exported from `packages/kit/src/views/Perp/hooks/usePerpOrderInfoPanel.ts`; it uses account scope and active/focus state. `ServiceHyperliquid.getUserFundingHistory` supplies history.
- Market funding and forecasts: service methods `getPerpFundingHistory` / `getPerpPredictedFundings` and `packages/kit-bg/src/services/ServiceHyperLiquid/utils/fundingHistory.ts`.
- Rendering/calculation: `packages/kit/src/views/Perp/components/OrderInfoPanel/fundingHistoryDisplay.ts`, `packages/kit/src/views/Perp/components/OrderInfoPanel/Components/positionFundingUtils.ts`, `packages/kit/src/views/Perp/components/MarketDetail/PerpFundingChart.tsx` and portfolio components.

Keep settled payments, current/predicted rates and projected payments distinct. Preserve account/coin scope, payment-token units, sign, time units and period selection. Missing rates or metadata need the existing unavailable state, not an invented zero. Scope refreshes and inactive-tab behavior to the relevant consumer.

## Select validation

Start with the matching existing tests: `packages/kit/src/views/Perp/hooks/usePerpsAccountDisplayState.test.ts`, `packages/kit/src/views/Perp/utils/accountScopedData.test.ts`, `packages/kit/src/views/Perp/hooks/usePerpsActivePositionsByAddress.test.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/utils/accountSwitchCleanup.test.ts` or `packages/kit/src/states/jotai/contexts/hyperliquid/utils/coldStartMergeUtils.test.ts`.

For financial/mode changes, examples include `packages/kit-bg/src/services/ServiceHyperLiquid/userAbstractionCache.test.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/userAbstractionMode.test.ts`, `packages/kit/src/views/Perp/hooks/useLiquidationPrice.test.ts`, `packages/kit/src/views/Perp/utils/leverageDisplay.test.ts`, `packages/kit/src/views/Perp/hooks/usePerpUserFundingHistory.test.ts`, `packages/kit/src/views/Perp/components/OrderInfoPanel/fundingHistoryDisplay.test.ts` and `packages/kit/src/views/Perp/components/Portfolio/usePerpPortfolioData.test.ts`.

Relevant scenarios include A -> B account switching with late responses, valid B cache versus stale A cache, mode changes interrupted by an account switch, a non-active-coin position action, funding refresh while inactive and unavailable API fields. Select only scenarios affected by the change.
