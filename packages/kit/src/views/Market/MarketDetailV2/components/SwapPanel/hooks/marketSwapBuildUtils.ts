import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapSlippageSegmentItem,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSlippageSegmentKey,
  SwapBuildShouldFallBackNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

export function resolveMarketQuoteActionState({
  hasActionableQuote,
  quoteRequestMatchesCurrentInput,
  quoteRequestLocked,
  quoteFetching,
  quoteEventFetching,
  shouldRefreshQuote,
  hasQuoteError,
  manualRefreshRequest = false,
}: {
  hasActionableQuote: boolean;
  quoteRequestMatchesCurrentInput: boolean;
  quoteRequestLocked: boolean;
  quoteFetching: boolean;
  quoteEventFetching: boolean;
  shouldRefreshQuote: boolean;
  hasQuoteError: boolean;
  manualRefreshRequest?: boolean;
}) {
  const isLoading = quoteRequestLocked || quoteFetching || quoteEventFetching;
  const quoteRequestSettled = !isLoading;
  const canRefresh =
    shouldRefreshQuote &&
    quoteRequestMatchesCurrentInput &&
    quoteRequestSettled;

  return {
    canRefresh,
    canReview:
      hasActionableQuote &&
      quoteRequestMatchesCurrentInput &&
      quoteRequestSettled &&
      !shouldRefreshQuote &&
      !hasQuoteError,
    isRefreshAction: canRefresh || (manualRefreshRequest && isLoading),
    isLoading,
  };
}

export function resolveMarketSelectedQuoteSlippage({
  quoteResult,
  slippageItem,
}: {
  quoteResult: Pick<IFetchQuoteResult, 'autoSuggestedSlippage' | 'slippage'>;
  slippageItem: ISwapSlippageSegmentItem;
}) {
  if (slippageItem.key === ESwapSlippageSegmentKey.AUTO) {
    return (
      quoteResult.autoSuggestedSlippage ??
      quoteResult.slippage ??
      slippageItem.value
    );
  }

  return slippageItem.value;
}

export function buildMarketReviewShouldFallback({
  networkId,
  isCustomRpcUnavailable,
}: {
  networkId?: string;
  isCustomRpcUnavailable?: boolean;
}) {
  return (
    SwapBuildShouldFallBackNetworkIds.includes(networkId ?? '') ||
    Boolean(isCustomRpcUnavailable)
  );
}

export function mergeMarketBuildResultWithQuote({
  buildRes,
  quoteResult,
}: {
  buildRes: IFetchBuildTxResponse;
  quoteResult?: IFetchQuoteResult;
}) {
  const nextBuildRes: IFetchBuildTxResponse = {
    ...buildRes,
    result: {
      ...buildRes.result,
    },
  };
  if (
    quoteResult &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.fromTokenInfo,
      token2: nextBuildRes.result.fromTokenInfo,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.toTokenInfo,
      token2: nextBuildRes.result.toTokenInfo,
    })
  ) {
    nextBuildRes.result.honeypot ??= quoteResult.honeypot;
    nextBuildRes.result.lowLiquidity ??= quoteResult.lowLiquidity;
  }

  const buildGasLimitBN = new BigNumber(nextBuildRes.result?.gasLimit ?? 0);
  const quoteGasLimitBN = new BigNumber(quoteResult?.gasLimit ?? 0);

  if (
    (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
    !quoteGasLimitBN.isNaN() &&
    !quoteGasLimitBN.isZero()
  ) {
    nextBuildRes.result.gasLimit = quoteGasLimitBN.toNumber();
  }

  if (
    !nextBuildRes.result?.routesData?.length &&
    quoteResult?.routesData?.length
  ) {
    nextBuildRes.result.routesData = quoteResult.routesData;
  }

  if (!nextBuildRes.result?.minToAmount && quoteResult?.minToAmount) {
    nextBuildRes.result.minToAmount = quoteResult.minToAmount;
  }

  return nextBuildRes;
}
