import BigNumber from 'bignumber.js';

import type { ICurrencyItem } from '@onekeyhq/shared/types';
import { swapProPositionsListMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { convertFiat } from '../../../utils/fiatConvert';

export function compareTradePositionFiatValues(left?: string, right?: string) {
  const leftValue = new BigNumber(left ?? '0');
  const rightValue = new BigNumber(right ?? '0');
  return (rightValue.isFinite() ? rightValue : new BigNumber(0)).comparedTo(
    leftValue.isFinite() ? leftValue : new BigNumber(0),
  );
}

export function hasTradePositionBalance(balance?: string) {
  const value = new BigNumber(balance ?? '0');
  return value.isFinite() && value.gt(0);
}

export function isTradePositionVisible({
  balance,
  fiatValue,
  isStock = false,
  currency = 'usd',
  currencyMap,
}: {
  balance?: string;
  fiatValue?: string;
  isStock?: boolean;
  currency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
}) {
  if (isStock && !hasTradePositionBalance(balance)) {
    return false;
  }

  const value = new BigNumber(fiatValue ?? NaN);
  if (!value.isFinite()) {
    return isStock;
  }

  const currencyId = currency.toLowerCase();
  if (currencyId === 'usd') {
    return value.gte(swapProPositionsListMinValue);
  }

  const sourceRate = new BigNumber(currencyMap?.[currencyId]?.value ?? NaN);
  const usdRate = new BigNumber(currencyMap?.usd?.value ?? NaN);
  if (
    !currencyMap ||
    !sourceRate.isFinite() ||
    !sourceRate.gt(0) ||
    !usdRate.isFinite() ||
    !usdRate.gt(0)
  ) {
    // Missing rates must not turn a value in another currency into USD.
    return value.gt(0);
  }

  return new BigNumber(
    convertFiat({
      value: fiatValue ?? '0',
      sourceCurrency: currencyId,
      targetCurrency: 'usd',
      currencyMap,
    }),
  ).gte(swapProPositionsListMinValue);
}
