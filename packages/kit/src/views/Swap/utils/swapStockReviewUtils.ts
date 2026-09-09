import BigNumber from 'bignumber.js';

import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getSwapTokenDisplayFiatValue } from './swapDisplayFiatValue';

export function calculateSwapStockEstimatedShares({
  stockTokenAmount,
  tokenToAssetRatio,
}: {
  stockTokenAmount?: string;
  tokenToAssetRatio?: string;
}) {
  const amountBN = new BigNumber(stockTokenAmount ?? '');
  const ratioBN = new BigNumber(tokenToAssetRatio ?? '');
  if (
    !amountBN.isFinite() ||
    !amountBN.gt(0) ||
    !ratioBN.isFinite() ||
    !ratioBN.gt(0)
  ) {
    return undefined;
  }

  return amountBN.multipliedBy(ratioBN).toFixed();
}

export function buildSwapStockReviewDisplay({
  currencyMap,
  fromAmount,
  fromToken,
  targetCurrency,
  toAmount,
  toToken,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  fromAmount: string;
  fromToken?: ISwapToken;
  targetCurrency: string;
  toAmount: string;
  toToken?: ISwapToken;
}) {
  const isBuy = Boolean(toToken?.isStock && !fromToken?.isStock);
  const isSell = Boolean(fromToken?.isStock && !toToken?.isStock);
  if (!isBuy && !isSell) {
    return undefined;
  }

  const stockToken = isBuy ? toToken : fromToken;
  const paymentToken = isBuy ? fromToken : toToken;
  const stockTokenAmount = isBuy ? toAmount : fromAmount;
  const paymentTokenAmount = isBuy ? fromAmount : toAmount;
  const estimatedShares = calculateSwapStockEstimatedShares({
    stockTokenAmount,
    tokenToAssetRatio: stockToken?.stock?.tokenToAssetRatio,
  });
  if (!estimatedShares) {
    return undefined;
  }

  const paymentFiatValue = getSwapTokenDisplayFiatValue({
    token: paymentToken,
    amount: paymentTokenAmount,
    targetCurrency,
    currencyMap,
  });
  const paymentFiatValueBN = new BigNumber(paymentFiatValue);
  const estimatedSharesBN = new BigNumber(estimatedShares);
  const sharePrice =
    paymentFiatValueBN.isFinite() && paymentFiatValueBN.gt(0)
      ? paymentFiatValueBN.dividedBy(estimatedSharesBN).toFixed()
      : undefined;

  return {
    estimatedShares,
    sharePrice,
    underlyingSymbol:
      stockToken?.stock?.underlyingAssetTicker ?? stockToken?.symbol ?? '',
  };
}
