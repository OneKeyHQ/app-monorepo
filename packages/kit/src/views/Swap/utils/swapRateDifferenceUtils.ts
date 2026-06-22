import BigNumber from 'bignumber.js';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import {
  swapRateDifferenceMax,
  swapRateDifferenceMin,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapPreSwapData } from '@onekeyhq/shared/types/swap/types';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

function resolveRateDifferenceTokenPrice({
  price,
  sourceCurrency,
  commonCurrency,
  currencyMap,
}: {
  price?: string;
  sourceCurrency?: string;
  commonCurrency: string;
  currencyMap?: Record<string, ICurrencyItem>;
}) {
  const priceBN = new BigNumber(price ?? '');
  if (!priceBN.isFinite() || priceBN.isZero()) {
    return undefined;
  }

  if (!sourceCurrency || sourceCurrency === commonCurrency) {
    return priceBN.toFixed();
  }

  if (!currencyMap?.[sourceCurrency] || !currencyMap?.[commonCurrency]) {
    return undefined;
  }

  const convertedPrice = new BigNumber(
    convertFiat({
      value: priceBN.toFixed(),
      sourceCurrency,
      targetCurrency: commonCurrency,
      currencyMap,
    }),
  );

  return convertedPrice.isFinite() && !convertedPrice.isZero()
    ? convertedPrice.toFixed()
    : undefined;
}

export function buildSwapRateDifference({
  fromTokenPrice,
  toTokenPrice,
  fromTokenCurrency,
  toTokenCurrency,
  defaultTokenCurrency,
  currencyMap,
  instantRate,
}: {
  fromTokenPrice?: string;
  toTokenPrice?: string;
  fromTokenCurrency?: string;
  toTokenCurrency?: string;
  defaultTokenCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
  instantRate?: string;
}): ISwapPreSwapData['rateDifference'] {
  if (!fromTokenPrice || !toTokenPrice || !instantRate) {
    return undefined;
  }

  const fromPriceSourceCurrency = fromTokenCurrency ?? defaultTokenCurrency;
  const toPriceSourceCurrency = toTokenCurrency ?? defaultTokenCurrency;
  const hasOnlyOneKnownCurrency =
    Boolean(fromPriceSourceCurrency) !== Boolean(toPriceSourceCurrency);
  if (hasOnlyOneKnownCurrency) {
    return undefined;
  }

  const commonCurrency =
    fromPriceSourceCurrency ?? toPriceSourceCurrency ?? USD_CURRENCY_ID;
  const resolvedFromTokenPrice = resolveRateDifferenceTokenPrice({
    price: fromTokenPrice,
    sourceCurrency: fromPriceSourceCurrency,
    commonCurrency,
    currencyMap,
  });
  const resolvedToTokenPrice = resolveRateDifferenceTokenPrice({
    price: toTokenPrice,
    sourceCurrency: toPriceSourceCurrency,
    commonCurrency,
    currencyMap,
  });
  if (!resolvedFromTokenPrice || !resolvedToTokenPrice) {
    return undefined;
  }

  const fromTokenPriceBN = new BigNumber(resolvedFromTokenPrice);
  const toTokenPriceBN = new BigNumber(resolvedToTokenPrice);
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
