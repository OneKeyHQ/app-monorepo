import BigNumber from 'bignumber.js';

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
  if (quoteResult.quoteShowTip || !quoteTip) {
    return quoteResult;
  }

  const toAmountBN = new BigNumber(quoteResult.toAmount ?? 0);
  const toTokenPriceBN = new BigNumber(toTokenPrice ?? 0);

  if (toAmountBN.isNaN()) {
    return quoteResult;
  }

  const receiveFiatValueBN = toAmountBN.multipliedBy(
    toTokenPriceBN.isNaN() ? 0 : toTokenPriceBN,
  );

  if (!receiveFiatValueBN.isNaN() && receiveFiatValueBN.gt(0)) {
    return quoteResult;
  }

  return {
    ...quoteResult,
    quoteShowTip: quoteTip,
  };
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
