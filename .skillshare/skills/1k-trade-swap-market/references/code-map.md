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

## Cross-Surface Swap Entrypoints

- `packages/kit/src/views/Home/components/WalletActions/WalletActionSwap.tsx`
- `packages/kit/src/components/TokenListView/TokenActionsView.tsx`
- `packages/kit/src/views/Send/pages/SendAmountInput/SendAmountInputContainer.tsx`
- `packages/kit/src/views/Receive/pages/ReceiveSelector.tsx`
- `packages/kit/src/views/Staking/hooks/useHandleSwap.ts`
- `packages/kit/src/views/Staking/components/TradeOrBuy.tsx`
- `packages/kit/src/views/Staking/components/ProtocolDetails/EarnSwapRoute.tsx`
- `packages/kit/src/views/Market/components/tradeHook.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/ActionButton.tsx`
- `packages/kit/src/views/Swap/pages/modal/SwapMainLandModal.tsx`
- `packages/kit/src/views/Swap/hooks/useSwapGlobal.ts`

Important anchors:

- `EModalSwapRoutes.SwapMainLand`
- `ESwapSource.WALLET_HOME`, `ESwapSource.WALLET_HOME_TOKEN_LIST`,
  `ESwapSource.WALLET_TAB`, `ESwapSource.MARKET`, and `ESwapSource.EARN`
- `importFromToken`, `importToToken`, `importNetworkId`,
  `swapTabSwitchType`

Use these paths when a bug starts from Home Token, Send, Receive, Market,
Earn, or Buy but lands in Swap. The source surface owns the handoff params;
Swap owns quote, review, build, send, and history once the route is mounted.

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
- `packages/kit/src/views/Swap/utils/swapMarketHistory.ts`
- `packages/shared/src/utils/swapHistoryUtils.ts`
- `packages/kit-bg/src/services/ServiceHistory.ts`
- `packages/kit-bg/src/services/ServiceSwap.ts`
- `packages/kit-bg/src/vaults/impls/*/Vault.ts`

Important anchors:

- `useSwapTxHistoryActions`
- `addSwapHistoryItem`
- `swapHistoryStatusRunFetch`
- `fetchTxState`
- `fetchSwapOrderDetailTxState`
- `fetchPrivateSendOrderDetailHistoryItem`
- `maybeOpenPrivateSendHistoryDetail`
- `isSwapHistoryProtocolExcluded`
- `ServiceHistory.batchUpdateLocalHistoryTxs`
- chain-specific `Vault.buildDecodedTx`
- channel-specific progress and detail display helpers

Use this area for history display, channel listeners, local writeback, replay
enrichment, and repair. Do not add a new channel-specific history path until the
shared predicate, pending-list behavior, and detail route fallback have been
checked.

When display depends on decoded actions or `decodedTx.extraInfo`, inspect the
chain-specific decode path as well as swap-history repair. On-chain history
replacement should not erase locally decoded channel metadata before detail
rendering has a richer replacement source.

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

Market speed-swap should hand an execution payload into the Swap spine. Market
detail owns token context and presets; Swap owns quote/build/send/history after
the execution payload is built.

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

When channel identity needs to be shared across `kit` and `kit-bg`, put only the
minimal type, enum, constant, or pure predicate in `shared`. Keep UI display and
background service logic in their owning packages.
