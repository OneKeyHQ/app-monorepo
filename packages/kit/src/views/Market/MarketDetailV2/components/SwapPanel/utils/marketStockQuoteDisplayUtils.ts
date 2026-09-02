import BigNumber from 'bignumber.js';

import {
  STOCK_PRICE_SOURCE_CURRENCY,
  getStockTokenFiatValue,
  resolveStockTokenPrice,
} from '@onekeyhq/kit/src/views/Swap/hooks/swapStockFiatValueUtils';
import { buildSwapRateDifference } from '@onekeyhq/kit/src/views/Swap/utils/swapRateDifferenceUtils';
import { calculateSwapStockEstimatedShares } from '@onekeyhq/kit/src/views/Swap/utils/swapStockReviewUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export function calculateMarketStockEstimatedShares({
  stockTokenAmount,
  tokenToAssetRatio,
}: {
  stockTokenAmount?: string;
  tokenToAssetRatio?: string;
}) {
  return calculateSwapStockEstimatedShares({
    stockTokenAmount,
    tokenToAssetRatio,
  });
}

export function hasValidMarketStockTokenToAssetRatio(
  tokenToAssetRatio?: string,
) {
  const ratioBN = new BigNumber(tokenToAssetRatio ?? '');
  return ratioBN.isFinite() && ratioBN.gt(0);
}

export function resolveMarketStockTokenToAssetRatio({
  tokenPrice,
  tokenToAssetRatio,
  underlyingStockPrice,
}: {
  tokenPrice?: string;
  tokenToAssetRatio?: string;
  underlyingStockPrice?: string;
}) {
  const normalizedRatio = tokenToAssetRatio?.trim();
  if (hasValidMarketStockTokenToAssetRatio(normalizedRatio)) {
    return normalizedRatio;
  }

  const tokenPriceBN = new BigNumber(tokenPrice ?? '');
  const underlyingStockPriceBN = new BigNumber(underlyingStockPrice ?? '');
  if (
    !tokenPriceBN.isFinite() ||
    !tokenPriceBN.gt(0) ||
    !underlyingStockPriceBN.isFinite() ||
    !underlyingStockPriceBN.gt(0)
  ) {
    return undefined;
  }

  // Both prices are USD values from the stock endpoints. Their quotient is
  // the estimated token-to-share ratio when explicit ratio metadata is absent.
  return tokenPriceBN.dividedBy(underlyingStockPriceBN).toFixed();
}

export function buildMarketStockQuoteDisplay({
  currencyMap,
  fallbackCurrencySymbol,
  fromToken,
  quoteResult,
  targetCurrency,
  toToken,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  fallbackCurrencySymbol: string;
  fromToken: ISwapToken;
  quoteResult?: IFetchQuoteResult;
  targetCurrency: string;
  toToken: ISwapToken;
}) {
  const quoteFromTokenPrice = resolveStockTokenPrice({
    token: quoteResult?.fromTokenInfo,
    fallbackCurrency: targetCurrency,
  });
  const quoteToTokenPrice = resolveStockTokenPrice({
    token: quoteResult?.toTokenInfo,
    fallbackCurrency: targetCurrency,
  });
  const fromTokenPrice =
    quoteFromTokenPrice ??
    resolveStockTokenPrice({
      token: fromToken,
      fallbackCurrency: fromToken.isStock
        ? STOCK_PRICE_SOURCE_CURRENCY
        : targetCurrency,
    });
  const toTokenPrice =
    quoteToTokenPrice ??
    resolveStockTokenPrice({
      token: toToken,
      fallbackCurrency: toToken.isStock
        ? STOCK_PRICE_SOURCE_CURRENCY
        : targetCurrency,
    });

  return {
    currencySymbol:
      currencyMap[targetCurrency]?.unit ??
      currencyMap[STOCK_PRICE_SOURCE_CURRENCY]?.unit ??
      fallbackCurrencySymbol,
    receiveFiatValue: getStockTokenFiatValue({
      amount: quoteResult?.toAmount ?? '',
      tokenPrice: toTokenPrice,
      targetCurrency,
      currencyMap,
    }),
    rateDifference: buildSwapRateDifference({
      fromTokenPrice: fromTokenPrice?.price,
      toTokenPrice: toTokenPrice?.price,
      fromTokenCurrency: fromTokenPrice?.currency,
      toTokenCurrency: toTokenPrice?.currency,
      currencyMap,
      instantRate: quoteResult?.instantRate,
    }),
  };
}
