# Perps Code Map

Use this map as starting anchors, then confirm current paths/usages with `rg` before editing. Open only the files that own the requested behavior.

## UI entry and layouts

- Pages/layouts: `packages/kit/src/views/Perp/pages/Perp.tsx`, `packages/kit/src/views/Perp/pages/MobilePerpMarket.tsx`, `packages/kit/src/views/Perp/pages/ExtPerp.tsx`, `packages/kit/src/views/Perp/layouts/`.
- Routing/providers: `packages/kit/src/views/Perp/router/index.ts`, `packages/kit/src/views/Perp/PerpsProvider.tsx`, `PerpsProviderMirror.tsx`, `PerpsAccountSelectorProviderMirror.tsx`.

## Trading and order UI

- Form/submit: `packages/kit/src/views/Perp/components/TradingPanel/PerpTradingPanel.tsx`, `packages/kit/src/views/Perp/components/TradingPanel/PerpTradingButton.tsx`.
- Confirm/price: `packages/kit/src/views/Perp/hooks/useOrderConfirm.ts`, `packages/kit/src/views/Perp/hooks/useOrderPrice.ts`, `packages/kit/src/views/Perp/hooks/useTradingPrice.ts`.
- Guards: `packages/kit/src/views/Perp/utils/timeInForce.ts`, `packages/kit/src/views/Perp/utils/minimumOrderGuard.ts`, `packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts`.

## Positions, orders, and activity

- Panel/modals: `packages/kit/src/views/Perp/components/OrderInfoPanel/PerpOrderInfoPanel.tsx`, `CancelAllOrdersModal.tsx`, `CloseAllPositionsModal.tsx`, `ClosePositionModal.tsx`, `SetTpslModal.tsx`.
- Lists/rows: `packages/kit/src/views/Perp/components/OrderInfoPanel/List/` and `Components/`; TWAP rows live in `PerpTwapList.tsx`, trade history in `PerpTradesHistoryList.tsx`.
- Helpers/state: `packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts`, `packages/kit/src/views/Perp/hooks/usePerpsAccountScopedActivePositions.ts`, `packages/kit/src/views/Perp/hooks/usePerpOrderInfoPanel.ts`.

## Orderbook, ticker, token selector

- Orderbook: `packages/kit/src/views/Perp/components/PerpOrderBook.tsx`, `packages/kit/src/views/Perp/components/OrderBook/index.tsx`, `useAggregatedBook.tsx`, `useTickOptions.ts`, `tickSizeUtils.ts`.
- Ticker/selector: `packages/kit/src/views/Perp/components/TickerBar/`, `packages/kit/src/views/Perp/components/TokenSelector/`, `packages/kit/src/views/Perp/hooks/usePerpTokenSelector.ts`, `packages/kit/src/views/Perp/hooks/usePerpMarketData.ts`.
- Freshness guards: `packages/kit/src/views/Perp/utils/l2BookFreshness.ts`, `perpsMarketDataFreshness.ts`.

## TradingView and K-line

- Chart surface: `packages/kit/src/views/Perp/components/PerpCandles.tsx`.
- Bridge: `packages/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2.tsx`; owns `SYMBOL_CHANGE` and chart-line postMessage.
- Message constants: `packages/kit/src/components/TradingView/TradingViewPerpsV2/constants/messageTypes.ts`.
- Display/signing helpers: `packages/shared/src/utils/perpsUtils.ts`; EIP712 webview types are in `packages/shared/types/hyperliquid/webview.ts` and are **not** TradingView messages.

## State and actions

- Context: `packages/kit/src/states/jotai/contexts/hyperliquid/atoms.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/utils/`.
- Persisted/background atoms: `packages/kit-bg/src/states/jotai/atoms/perps.ts`.

## Background services

- Deposit quote/status: `packages/kit-bg/src/services/ServiceSwap.ts` (`fetchPerpDepositQuote`, `fetchPerpDepositOrderStatus`, `perpDepositOrderFetchLoop`).
- Account/info/cache: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`, `ServiceHyperliquidCache.ts`, `hyperLiquidApiClients.ts`.
- Orders: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts`.
- Subscriptions: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/SubscriptionMutationQueue.ts`, `SubscriptionConfig.ts`.

## Shared contracts and utilities

- Types/constants: `packages/shared/types/hyperliquid/sdk.ts`, `packages/shared/types/hyperliquid/types.ts`, `packages/shared/types/hyperliquid/perp.constants.ts`.
- Utilities: `packages/shared/src/utils/perpsUtils.ts`, `packages/shared/src/utils/hyperliquidScaleOrderUtils.ts`.

## Source-of-truth rule

Display files should not become the source of trading behavior. Trading behavior belongs in shared types/utils, `actions.ts`, `ServiceSwap.ts`, or `ServiceHyperliquidExchange.ts`; realtime behavior belongs in `ServiceHyperliquidSubscription.ts`, context atoms/actions, or L2/BBO helpers.
