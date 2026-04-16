import BigNumber from 'bignumber.js';

import { attachUnknownTokenValueTip } from '@onekeyhq/kit/src/views/Swap/utils/unknownTokenValueTip';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IQuoteTip,
} from '@onekeyhq/shared/types/swap/types';
import { SwapBuildShouldFallBackNetworkIds } from '@onekeyhq/shared/types/swap/types';

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

export function attachMarketUnknownTokenValueTip({
  quoteResult,
  toTokenPrice,
  quoteTip,
}: {
  quoteResult: IFetchQuoteResult;
  toTokenPrice?: string;
  quoteTip?: IQuoteTip;
}) {
  return attachUnknownTokenValueTip({
    quoteResult,
    toTokenPrice,
    quoteTip,
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

  if (!nextBuildRes.result?.quoteShowTip && quoteResult?.quoteShowTip) {
    nextBuildRes.result.quoteShowTip = quoteResult.quoteShowTip;
  }

  return nextBuildRes;
}
