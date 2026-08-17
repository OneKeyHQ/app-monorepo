import BigNumber from 'bignumber.js';

import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';
import { SwapBuildShouldFallBackNetworkIds } from '@onekeyhq/shared/types/swap/types';

export function resolveMarketQuoteActionState({
  hasActionableQuote,
  quoteRequestMatchesCurrentInput,
  quoteRequestLocked,
  quoteFetching,
  shouldRefreshQuote,
  hasQuoteError,
}: {
  hasActionableQuote: boolean;
  quoteRequestMatchesCurrentInput: boolean;
  quoteRequestLocked: boolean;
  quoteFetching: boolean;
  shouldRefreshQuote: boolean;
  hasQuoteError: boolean;
}) {
  const quoteRequestSettled = !quoteRequestLocked && !quoteFetching;
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
  };
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
