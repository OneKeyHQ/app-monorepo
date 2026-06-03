import BigNumber from 'bignumber.js';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

type IMarketTokenPriceFields = Pick<
  IMarketTokenDetail,
  'price' | 'priceConverted' | 'priceChange24hPercent'
>;

function getFiniteStringValue(value: BigNumber, fallback?: string) {
  return value.isFinite() ? value.toFixed() : fallback;
}

export function getRealtimePriceConverted({
  basePrice,
  basePriceConverted,
  realtimePrice,
}: {
  basePrice?: string;
  basePriceConverted?: string;
  realtimePrice: string;
}) {
  return getFiniteStringValue(
    new BigNumber(basePriceConverted ?? Number.NaN)
      .div(basePrice ?? Number.NaN)
      .multipliedBy(realtimePrice),
    basePriceConverted,
  );
}

export function getRealtimePriceChange24hPercent({
  basePrice,
  basePriceChange24hPercent,
  realtimePrice,
}: {
  basePrice?: string;
  basePriceChange24hPercent?: string;
  realtimePrice: string;
}) {
  const previous24hPrice = new BigNumber(basePrice ?? Number.NaN).div(
    new BigNumber(basePriceChange24hPercent ?? Number.NaN).div(100).plus(1),
  );
  return getFiniteStringValue(
    new BigNumber(realtimePrice)
      .div(previous24hPrice)
      .minus(1)
      .multipliedBy(100),
    basePriceChange24hPercent,
  );
}

export function buildRealtimePriceDerivedFields({
  tokenDetail,
  realtimePrice,
}: {
  tokenDetail: IMarketTokenPriceFields;
  realtimePrice: string;
}): Pick<IMarketTokenDetail, 'priceConverted' | 'priceChange24hPercent'> {
  return {
    priceConverted: getRealtimePriceConverted({
      basePrice: tokenDetail.price,
      basePriceConverted: tokenDetail.priceConverted,
      realtimePrice,
    }),
    priceChange24hPercent: getRealtimePriceChange24hPercent({
      basePrice: tokenDetail.price,
      basePriceChange24hPercent: tokenDetail.priceChange24hPercent,
      realtimePrice,
    }),
  };
}
