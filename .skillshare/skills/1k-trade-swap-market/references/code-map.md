# Code Map

Use these anchors to orient in the current repository. Prefer the local pattern around the anchor over inventing a parallel path. The executable anchor map was reviewed at `ec605542881e`; run the readiness script before relying on it.

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

## Cold Start, Readiness, And Alert Guards

- `packages/kit/src/views/Swap/hooks/useSwapGlobal.ts`
- `packages/kit/src/views/Swap/hooks/useSwapTokens.ts`
- `packages/kit/src/views/Swap/utils/swapColdStartTokenCacheUtils.ts`
- `packages/kit/src/views/Swap/utils/swapNoWalletWarningGuard.ts`
- `packages/kit/src/states/jotai/contexts/swap/atoms.ts`
- `packages/shared/src/consts/jotaiConsts.ts`
- `packages/kit-bg/src/states/jotai/utils/index.ts`

Important anchors:

- `swapSelectedTokensColdStartContextAtom`
- `buildSwapSelectedTokensColdStartContext`
- `shouldHandleSwapColdStartHomeAccountUpdate`
- `shouldAllowSwapNoConnectWalletWarning`
- `shouldShowSwapAccountUnsupportedAlert`

Use these paths for first-frame defaults, unsupported-network entry, no-wallet
warning, disconnected-wallet, app-restart, and route-param one-shot bugs. Keep
cached display state separate from quote/build readiness.

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

Receive DeFi-token filtering is an explicit adjacent-owner exception:

- `packages/kit/src/views/Receive/pages/ReceiveSelector.tsx` passes
  `showDeFiTokenSwitch`.
- `packages/kit/src/views/AssetSelector/pages/TokenSelector.tsx` owns the
  selector/filter composition.
- `packages/shared/src/utils/tokenSelectorFilterUtils.ts` owns the pure filter.

Do not edit the Swap selector for this path unless runtime/source tracing proves
the failure occurs after the handoff reaches Swap.

Entry-specific anchors:

- Wallet Home action opens `SwapMainLand` with `importNetworkId` and
  `ESwapSource.WALLET_HOME`; it does not own token selection after route mount.
- Home Token action builds `importFromToken`, can omit BTC native token for
  unsupported ordinary Swap, can set a Bridge default `importToToken`, and
  passes `importDeriveType`.
- Earn/Staking funding uses `useHandleSwap` with `ESwapSource.EARN`; DeFi owns
  source context and Swap owns quote/review/build/send after handoff.
- `SwapMainLandModal` wraps the modal in the swap account selector mirror and
  forwards only `swapInitParams`; route params are not long-term state.

## Quote Progress And Provider Selection

- `packages/kit/src/states/jotai/contexts/swap/quoteProgress.ts`
- `packages/kit/src/states/jotai/contexts/swap/actions.ts`
- `packages/kit/src/views/Swap/components/SwapProviderListPanel.tsx`
- `packages/kit/src/views/Swap/components/ProviderManageComponent.tsx`
- `packages/kit/src/views/Swap/components/SwapQuoteResultRate.tsx`
- `packages/kit/src/views/Swap/components/ProtocolFeeComparisonList.tsx`

Keep manual provider selection, quote progress, and provider availability separate.

For Stock and other multi-provider quote events, the closest error-settlement
pattern is `selectSwapCurrentQuote` with
`deferNonActionableQuoteUntilEventSettled`, wired from swap atoms/actions.
Track `totalQuoteCountReceived`, `quoteEventCompleted`, actionable `toAmount`,
manual provider intent, and current event identity separately. An early error
must not replace a later actionable quote.

## Stock Channel Owners

- `packages/kit/src/views/Swap/hooks/useSwapStockChannel.ts`
- `packages/kit/src/views/Swap/hooks/swapStockChannelUtils.ts`
- `packages/kit/src/views/Swap/hooks/useSwapStockTradeInputs.ts`
- `packages/kit/src/views/Swap/hooks/useSwapStockDefaultToken.ts`
- `packages/kit/src/views/Swap/utils/stockTokenDetailFreshness.ts`
- `packages/kit/src/views/Swap/utils/swapStockTradeControl.ts`
- `packages/kit/src/views/Swap/utils/swapStockAnalytics.ts`
- `packages/kit/src/views/Swap/pages/components/SwapStockTradeAlertUtils.ts`

Important anchors:

- `resolveStockChannelSwapPair`
- `useSwapStockAmountInputState`
- `isStockTokenDetailStateLanded`
- `getStockQuoteTradeControl`
- `getStockTradeAnalyticsPayload`

These owners keep Stock/pay-token identity, default restoration, amount side,
market readiness, trade alerts, and analytics distinct from ordinary Swap.

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
- `packages/kit/src/views/Swap/utils/swapHistoryIdentity.ts`
- `packages/kit/src/views/Swap/hooks/useSwapLocalDataVisibility.ts`
- `packages/kit/src/views/Swap/utils/swapNoWalletWarningGuard.ts`
- `packages/shared/src/utils/swapHistoryUtils.ts`
- `packages/kit-bg/src/services/ServiceHistory.ts`
- `packages/kit-bg/src/services/ServiceSwap.ts`
- `packages/kit-bg/src/dbs/simple/entity/SimpleDbEntitySwapHistory.ts`
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
- `swapHistoryIdentity`
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

For disconnected-wallet display, Stock pending counts, and order-backed
channels, treat visibility filters, local row retention, txid/order id choice,
and detail-route fallback as separate decisions.

`useShouldShowSwapLocalData` and `shouldShowSwapLocalData` are `main` visibility
owners. `ServiceSwap` and `SimpleDbEntitySwapHistory` are `bg` read/write
owners. Recent pairs, pending rows, Swap history, Limit history, and Stock
history may hide when account-selector readiness is false, but a visibility
requirement must not call the SimpleDB delete/clean paths.

Protected `main` consumers include:

- `packages/kit/src/views/Swap/components/SwapRecentTokenPairsGroup.tsx`
- `packages/kit/src/views/Swap/pages/components/SwapPendingHistoryList.tsx`
- `packages/kit/src/views/Swap/pages/modal/SwapHistoryListModal.tsx`
- `packages/kit/src/views/Swap/pages/components/LimitOrderList.tsx`
- `packages/kit/src/views/Swap/pages/components/SwapStockDesktopContainer.tsx`
- `packages/kit/src/components/TabPageHeader/components/WebAccountPanel/WebAccountPanelMain.tsx`
  for the real web disconnect transition

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
- `packages/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/useTradingViewV2.ts`
- `packages/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/messageHandlers/klineDataHandler.ts`
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
