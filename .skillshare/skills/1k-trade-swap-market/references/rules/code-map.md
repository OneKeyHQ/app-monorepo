# Code Map

Start with symbols and `rg`; do not assume exact paths if files moved.

## Shared Swap Core

| Area | Search Anchors |
| --- | --- |
| Background service | `ServiceSwap`, `fetchQuotesEvents`, `buildSwapTx`, `addSwapHistoryItem`, `refreshSwapHistoryPendingStatusOnce` |
| State/actions | `swap/atoms.ts`, `swap/actions.ts`, `quoteProgress.ts` |
| Quote hook | `useSwapQuote`, `swapQuoteCurrentSelectAtom`, `currentEventProviderKeys`, `manualSelectedProviderKey` |
| Build hook | `useSwapBuiltTx`, `checkSwapLatestBalanceSufficient`, `swapBalanceUtils` |
| Review state | `buildSwapReviewState`, `swapReviewState`, `PreSwapDialogContent`, `SwapReviewDialog`, `SwapReviewInitializer` |
| Provider UI | `SwapQuoteResult`, `SwapProviderListPanel`, `SwapProviderSelectModal`, `ProviderManageContainer` |

## Market Speed-Swap

| Area | Search Anchors |
| --- | --- |
| Panel | `MarketDetailV2`, `SwapPanelWrap`, `SwapPanelContent`, `useSpeedSwapActions` |
| Review/execute | `MarketSwapReviewDialog`, `marketDirectSendTx`, `marketBuildExecutionUtils`, `buildMarketExecutionFromBuildRes` |
| Preset | `marketPresetSettings`, `useMarketPresetSettings`, `SimpleDbEntityMarketPresetSettings`, `MarketPresetSelector` |
| Preset overrides | `useMarketPresetSwapOverridesEffect`, `marketPresetSwapOverrides`, `presetMultiTxsFee` |
| Fee utilities | `marketPresetFeeUtils`, `presetFeeInfoUtils` |

## Swap Pro And Limit

| Area | Search Anchors |
| --- | --- |
| Swap Pro shell | `SwapProContainer`, `SwapProTradingPanel`, `SwapProActionButton`, `SwapProTabListContainer` |
| Token detail | `SwapProTokenDetailGroup`, `BtcTokenDetailGroup`, `StockTokenDetailGroup`, `useBtcMetadata` |
| Slippage | `SwapProSlippageSetting`, `useSwapSlippageActions`, `slippageItem` |
| Limit price | `useSwapLimitRate`, `swapLimitPriceMarketPriceAtom`, `limitOrderMarketPriceIntervalAction`, `LimitRateInput` |
| Limit history | `LimitOrderOpenItem`, `LimitOrderList`, `LimitOrderDetailModal`, `LimitOrderCancelDialog` |

## Token Selector And Filters

| Area | Search Anchors |
| --- | --- |
| Selector | `TokenSelector`, `AssetSelector`, `SwapTokenSelectModal`, `SwapProSelectTokenModal` |
| LP/filter UI | `TokenSelectorLpTokenSwitch`, `TokenSelectorFilter`, `tokenSelectorFilterUtils` |
| Swap tokens | `useSwapTokens`, `useSwapTokenList`, `flag=token-selector` |

## History And Pending

| Area | Search Anchors |
| --- | --- |
| History list | `SwapHistoryListModal`, `SwapMarketHistoryList`, `SwapPendingHistoryList`, `SwapTxHistoryListCell` |
| Detail modal | `SwapHistoryDetailModal`, `SwapHistoryTxViewInBrowser` |
| Status helpers | `swapHistoryStatusUtils`, `rawStatus`, `finalStatus`, `clearLocalHistoryPendingTxByTxId` |

## Provider-Specific Anchors

| Provider/Case | Search Anchors |
| --- | --- |
| SWFT BTC | `selectedUtxoKeys`, `ForceSelected`, `btcSwapSingleAddressUtxoPlan`, `refundAddress`, `refundAddr` |
| Houdini | `Houdini`, `Privacy`, `receivingAddress`, provider status mapping |
| RocketX | `RocketX`, `limit.max`, `limit.min`, fixed rate, max amount |
| LiFi | `Li.fi`, `lifiFee`, `feeSplit`, long pending, cross-chain status |
| Cow Limit | `SellAmountDoesNotCoverFee`, `NoLiquidity` |
