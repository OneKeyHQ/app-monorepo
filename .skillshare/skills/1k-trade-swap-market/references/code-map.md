# Code Map

Use these anchors to orient in the current repository. Prefer the local pattern around the anchor over inventing a parallel path.

## Shared Swap Core

- `packages/kit-bg/src/services/ServiceSwap.ts`
- `packages/kit/src/states/jotai/contexts/swap/actions.ts`
- `packages/kit/src/states/jotai/contexts/swap/quoteProgress.ts`
- `packages/kit/src/views/Swap/index.tsx`

Key operations:

- `ServiceSwap.fetchQuotes`
- `ServiceSwap.fetchQuotesEvents`
- `ServiceSwap.fetchBuildTx`
- `ServiceSwap.fetchBuildSpeedSwapTx`
- `ServiceSwap.fetchTxState`
- `runQuoteEvent`
- `selectSwapCurrentQuote`

## Account And Token Selection

- `packages/kit/src/views/Swap/hooks/useSwapAccount.ts`
- `packages/kit/src/views/Swap/hooks/useSwapAccount.utils.ts`
- `packages/kit/src/views/Swap/hooks/useSwapTokens.ts`
- `packages/kit/src/views/Swap/pages/modal/SwapTokenSelectModal.tsx`
- `packages/kit/src/views/Swap/pages/modal/SwapProSelectTokenModal.tsx`

Important anchors:

- `useSwapFromAccountNetworkSync`
- `useSwapAddressInfo`
- `useSwapTokenList`
- token key builders and native-token handling utilities

## Quote Progress And Provider Selection

- `packages/kit/src/states/jotai/contexts/swap/quoteProgress.ts`
- `packages/kit/src/states/jotai/contexts/swap/actions.ts`
- `packages/kit/src/views/Swap/components/SwapProviderListPanel.tsx`
- `packages/kit/src/views/Swap/components/ProviderManageComponent.tsx`
- `packages/kit/src/views/Swap/components/SwapQuoteResultRate.tsx`
- `packages/kit/src/views/Swap/components/ProtocolFeeComparisonList.tsx`

Keep manual provider selection, quote progress, and provider availability separate.

## Review And Execution

- `packages/kit/src/views/Swap/utils/buildSwapReviewState.ts`
- `packages/kit/src/views/Swap/utils/swapReviewState.ts`
- `packages/kit/src/views/Swap/hooks/useSwapBuiltTx.ts`
- `packages/kit/src/views/Swap/hooks/useSwapReviewActions.ts`
- `packages/kit/src/views/SignatureConfirm/components/SwapInfo/SwapInfo.tsx`

Important anchors:

- `buildSwapReviewState`
- `ISwapReviewAdapter`
- `useSwapBuiltTx`

## History And Status

- `packages/kit/src/views/Swap/hooks/useSwapTxHistory.ts`
- `packages/kit/src/views/Swap/components/SwapTxHistoryListCell.tsx`
- `packages/kit/src/views/Swap/pages/modal/SwapHistoryDetailModal.tsx`
- `packages/kit/src/views/Swap/utils/privateSendHistory.ts`
- `packages/kit-bg/src/services/ServiceSwap.ts`

Important anchors:

- `useSwapTxHistoryActions`
- `addSwapHistoryItem`
- `swapHistoryStatusRunFetch`
- PrivateSend progress and detail display helpers

## Market Speed-Swap

- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/SwapPanelWrap.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/SwapPanelContent.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapActions.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils.ts`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx.ts`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/MarketPresetSelector/MarketPresetSelector.tsx`

Important anchors:

- `useSpeedSwapActions`
- `buildMarketExecutionPayload`
- `useMarketPresetSettings`

## Market And K-Line Data

- `packages/kit/src/views/Swap/pages/modal/SwapKLineContent.tsx`
- `packages/kit/src/views/Swap/pages/modal/swapKLineTokenUtils.ts`
- `packages/kit/src/components/TradingView/TradingViewV2/hooks/useTradingViewV2.ts`
- `packages/kit/src/components/TradingView/TradingViewV2/messageHandlers/klineDataHandler.ts`
- `packages/kit-bg/src/services/ServiceMarketV2.ts`

Important anchors:

- `TradingViewV2`
- `useTradingViewV2`
- `klineDataHandler`
- `ServiceMarketV2.fetchMarketTokenDetailByTokenAddress`

## Shared Types And Routes

- `packages/shared/src/routes/swap.ts`
- `packages/shared/types/swap/`
- `packages/shared/types/marketV2.ts`
- `packages/shared/src/logger/scopes/swap/`

Do not add imports that violate the package hierarchy. `shared` cannot import from other OneKey packages, and `kit-bg` cannot import from `components` or `kit`.
