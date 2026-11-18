import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentEventProviderKeysAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventErrorAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapShouldRefreshQuoteAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  type IStockResolvedTokenPrice,
  resolveStockInputPrice,
} from '../../hooks/swapStockFiatValueUtils';
import {
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
} from '../../hooks/useSwapStockChannel';
import { useSwapStockEstimatedReceiveState } from '../../hooks/useSwapStockTradeInputs';
import {
  calculateSwapStockEstimatedShares,
  getValidStockTokenToAssetRatio,
} from '../../utils/swapStockReviewUtils';
import {
  getStockQuoteTradeControl,
  isQuoteResultForStockTrade,
} from '../../utils/swapStockTradeControl';

import {
  isStockReceiveQuoteCurrent,
  shouldInvalidateStockReceiveSnapshot,
} from './SwapStockDesktopContainer.utils';
import { isCurrentStockQuoteEventError } from './SwapStockTradeAlertUtils';
import { useStockReceiveDisplaySnapshot } from './useStockReceiveDisplaySnapshot';

export function useStockEstimatedReceiveModel({
  forceLoading,
  inputToken,
  inputTokenPrice,
  receiveDisplayScope,
  quoteMatchesAccount,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
  stockReviewToken,
}: {
  forceLoading?: boolean;
  inputToken?: ISwapToken;
  inputTokenPrice?: IStockResolvedTokenPrice;
  receiveDisplayScope?: string;
  quoteMatchesAccount: boolean;
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  stockChannel: IUseSwapStockChannelReturn;
  stockReviewToken?: ISwapToken;
}) {
  const intl = useIntl();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [currentEventProviderKeys] = useSwapQuoteCurrentEventProviderKeysAtom();
  const [shouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const hasPositiveAmount = new BigNumber(fromTokenAmount.value || 0).gt(0);
  const invalidateSnapshot = shouldInvalidateStockReceiveSnapshot({
    hasPositiveAmount,
    matchesAccount: quoteMatchesAccount,
    completed: quoteEventCompleted,
    shouldRefreshQuote,
    currentEventProviderKeys,
  });
  const quoteIsCurrentEvent = isStockReceiveQuoteCurrent({
    quote: quoteResult,
    eventId: quoteEventTotalCount.eventId,
    currentEventProviderKeys,
    matchesAccount: quoteMatchesAccount,
    matchesTrade: isQuoteResultForStockTrade({
      quoteResult,
      sendAmount: fromTokenAmount.value,
      sendToken:
        stockChannel.tradeSide === ESwapStockTradeSide.Buy
          ? stockChannel.payToken
          : stockChannel.currentStockToken,
      receiveToken:
        stockChannel.tradeSide === ESwapStockTradeSide.Buy
          ? stockChannel.currentStockToken
          : stockChannel.payToken,
    }),
  });
  const shouldHideQuoteResult = useMemo(() => {
    const hasStockQuoteControl = Boolean(
      getStockQuoteTradeControl({
        quoteResult,
        fromTokenAmount: fromTokenAmount.value,
        fromTokenSymbol: stockChannel.fromToken?.symbol,
        intl,
      }),
    );
    return (
      hasStockQuoteControl ||
      isCurrentStockQuoteEventError({
        fromToken: stockChannel.fromToken,
        fromTokenAmount: fromTokenAmount.value,
        quoteEventError,
        toToken: stockChannel.toToken,
      })
    );
  }, [
    fromTokenAmount.value,
    intl,
    quoteEventError,
    quoteResult,
    stockChannel.fromToken,
    stockChannel.toToken,
  ]);
  const receiveQuoteLoading = Boolean(
    forceLoading || quoteLoading || (quoteEventFetching && !quoteResult),
  );
  const currentInputTokenPrice = resolveStockInputPrice({
    token: inputToken,
    tokenDetail:
      inputToken && inputTokenPrice
        ? { ...inputToken, ...inputTokenPrice }
        : undefined,
    quoteToken:
      quoteIsCurrentEvent &&
      !shouldHideQuoteResult &&
      !forceLoading &&
      !invalidateSnapshot
        ? quoteResult?.fromTokenInfo
        : undefined,
    stockTokenDetail: stockChannel.activeStockTokenDetail,
  });
  const {
    canSelectReceiveToken,
    currencySymbol: currentCurrencySymbol,
    isLoading,
    isSellSide,
    isReceiveTokenPopoverOpen,
    onReceiveTokenPress,
    quoteMatchesStockTrade,
    rateDifference: currentRateDifference,
    receiveAmount: currentReceiveAmount,
    receiveFiatValue: currentReceiveFiatValue,
    receiveToken,
    receiveTokenPrice: currentReceiveTokenPrice,
    setIsReceiveTokenPopoverOpen,
  } = useSwapStockEstimatedReceiveState({
    inputTokenPrice: currentInputTokenPrice,
    forceHideQuote:
      shouldHideQuoteResult ||
      forceLoading ||
      invalidateSnapshot ||
      (hasPositiveAmount && !quoteIsCurrentEvent),
    quoteEventFetching: false,
    quoteLoading: receiveQuoteLoading,
    quoteResult,
    stockChannel,
  });
  const currentReceiveTokenSymbol = receiveToken?.symbol ?? '';
  const estimatedStockTokenAmount =
    stockChannel.tradeSide === ESwapStockTradeSide.Buy
      ? quoteResult?.toAmount
      : quoteResult?.fromAmount;
  const tokenToAssetRatio = stockReviewToken?.stock?.tokenToAssetRatio;
  const currentEstimatedShares = calculateSwapStockEstimatedShares({
    stockTokenAmount: quoteMatchesStockTrade
      ? estimatedStockTokenAmount
      : undefined,
    tokenToAssetRatio,
  });
  const currentStockUnderlyingSymbol =
    stockReviewToken?.stock?.underlyingAssetTicker ?? '';
  const currentShouldShowEstimatedShares = Boolean(
    getValidStockTokenToAssetRatio(tokenToAssetRatio),
  );
  const displayScope = receiveDisplayScope
    ? JSON.stringify([receiveDisplayScope, currentCurrencySymbol])
    : undefined;
  const snapshot = useStockReceiveDisplaySnapshot({
    scope: displayScope,
    isLoading,
    hideQuote: shouldHideQuoteResult,
    invalidate: invalidateSnapshot,
    canSave:
      (!hasPositiveAmount && !quoteResult) ||
      (quoteEventCompleted && quoteIsCurrentEvent && quoteMatchesStockTrade),
    value: {
      inputTokenPrice: currentInputTokenPrice,
      receiveTokenPrice: currentReceiveTokenPrice,
      currencySymbol: currentCurrencySymbol,
      rateDifference: currentRateDifference,
      receiveAmount: hasPositiveAmount ? currentReceiveAmount : '',
      receiveFiatValue: hasPositiveAmount ? currentReceiveFiatValue : '0',
      receiveTokenSymbol: currentReceiveTokenSymbol,
      estimatedShares: currentEstimatedShares,
      stockUnderlyingSymbol: currentStockUnderlyingSymbol,
      shouldShowEstimatedShares: currentShouldShowEstimatedShares,
    },
  });
  const showReceiveSkeleton = isLoading && !snapshot;
  const currencySymbol = snapshot?.currencySymbol ?? currentCurrencySymbol;
  const rateDifference = snapshot
    ? snapshot.rateDifference
    : currentRateDifference;
  const receiveAmount = snapshot
    ? snapshot.receiveAmount
    : currentReceiveAmount;
  const receiveFiatValue = snapshot
    ? snapshot.receiveFiatValue
    : currentReceiveFiatValue;
  const receiveTokenSymbol = snapshot
    ? snapshot.receiveTokenSymbol
    : currentReceiveTokenSymbol;
  const estimatedShares = snapshot
    ? snapshot.estimatedShares
    : currentEstimatedShares;
  const stockUnderlyingSymbol = snapshot
    ? snapshot.stockUnderlyingSymbol
    : currentStockUnderlyingSymbol;
  const shouldShowEstimatedShares = snapshot
    ? snapshot.shouldShowEstimatedShares
    : currentShouldShowEstimatedShares;
  return {
    inputTokenPrice: snapshot
      ? snapshot.inputTokenPrice
      : currentInputTokenPrice,
    receiveTokenPrice: snapshot
      ? snapshot.receiveTokenPrice
      : currentReceiveTokenPrice,
    canSelectReceiveToken,
    currencySymbol,
    estimatedShares,
    isReceiveTokenPopoverOpen,
    isSellSide,
    onReceiveTokenPress,
    rateDifference,
    receiveAmount,
    receiveFiatValue,
    receiveTokenSymbol,
    setIsReceiveTokenPopoverOpen,
    shouldShowEstimatedShares,
    showReceiveSkeleton,
    stockUnderlyingSymbol,
  };
}
