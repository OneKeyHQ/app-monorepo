import BigNumber from 'bignumber.js';

import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  swapRateDifferenceMax,
  swapRateDifferenceMin,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapPreSwapData } from '@onekeyhq/shared/types/swap/types';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

export function buildSwapRateDifference({
  fromTokenPrice,
  toTokenPrice,
  instantRate,
}: {
  fromTokenPrice?: string;
  toTokenPrice?: string;
  instantRate?: string;
}): ISwapPreSwapData['rateDifference'] {
  if (!fromTokenPrice || !toTokenPrice || !instantRate) {
    return undefined;
  }

  const fromTokenPriceBN = new BigNumber(fromTokenPrice);
  const toTokenPriceBN = new BigNumber(toTokenPrice);
  const quoteRateBN = new BigNumber(instantRate);
  if (
    !fromTokenPriceBN.isFinite() ||
    !toTokenPriceBN.isFinite() ||
    !quoteRateBN.isFinite() ||
    fromTokenPriceBN.isZero() ||
    toTokenPriceBN.isZero()
  ) {
    return undefined;
  }

  const difference = quoteRateBN
    .dividedBy(fromTokenPriceBN.dividedBy(toTokenPriceBN))
    .minus(1)
    .multipliedBy(100);
  if (!difference.absoluteValue().gte(swapRateDifferenceMin)) {
    return undefined;
  }

  let unit = ESwapRateDifferenceUnit.POSITIVE;
  if (difference.isNegative()) {
    unit = difference.lte(swapRateDifferenceMax)
      ? ESwapRateDifferenceUnit.NEGATIVE
      : ESwapRateDifferenceUnit.DEFAULT;
  }

  return {
    value: `${difference.isPositive() ? '+' : ''}${numberFormat(
      difference.toFixed(),
      {
        formatter: 'priceChange',
      },
    )}`,
    unit,
  };
}
