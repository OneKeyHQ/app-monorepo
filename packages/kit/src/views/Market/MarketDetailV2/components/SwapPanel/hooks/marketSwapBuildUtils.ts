import BigNumber from 'bignumber.js';

import {
  isSameSwapQuoteAmount,
  isSwapQuoteActionable,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import { isSameSwapTokenIdentity } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchSwapQuoteParams,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapQuoteKind,
  SwapBuildShouldFallBackNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

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

export function buildDefaultMarketSpeedCheckState() {
  return {
    speedCheckError: '',
    checkSpenderAddress: '',
    isStock: false,
    shouldApprove: false,
    shouldResetApprove: false,
  };
}

export function shouldFetchMarketQuoteFallbackData(
  buildRes?: IFetchBuildTxResponse,
) {
  const buildGasLimitBN = new BigNumber(buildRes?.result?.gasLimit ?? 0);

  return (
    buildGasLimitBN.isNaN() ||
    buildGasLimitBN.isZero() ||
    !buildRes?.result?.routesData?.length
  );
}

export function pickMarketQuoteResultByProvider({
  quotes,
  provider,
  providerName,
}: {
  quotes?: IFetchQuoteResult[];
  provider?: string;
  providerName?: string;
}) {
  if (!quotes?.length) {
    return undefined;
  }

  return (
    quotes.find(
      (item) =>
        item.info.provider === provider &&
        item.info.providerName === providerName,
    ) ??
    quotes.find((item) => item.info.provider === provider) ??
    quotes.find((item) => item.info.providerName === providerName)
  );
}

export function filterMarketSpeedQuoteFallbackResults({
  quotes,
  request,
}: {
  quotes: IFetchQuoteResult[];
  request: IFetchSwapQuoteParams;
}) {
  const expectedKind = request.kind ?? ESwapQuoteKind.SELL;
  const expectedAmount =
    expectedKind === ESwapQuoteKind.BUY
      ? request.toTokenAmount
      : request.fromTokenAmount;

  return quotes.filter((quote) => {
    const quoteKind = quote.kind ?? ESwapQuoteKind.SELL;
    const quoteAmount =
      quoteKind === ESwapQuoteKind.BUY ? quote.toAmount : quote.fromAmount;
    return (
      quoteKind === expectedKind &&
      isSameSwapTokenIdentity({
        token1: quote.fromTokenInfo,
        token2: request.fromToken,
      }) &&
      isSameSwapTokenIdentity({
        token1: quote.toTokenInfo,
        token2: request.toToken,
      }) &&
      isSameSwapQuoteAmount({ left: quoteAmount, right: expectedAmount }) &&
      isSwapQuoteActionable(quote)
    );
  });
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
