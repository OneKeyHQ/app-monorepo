import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenDetailRealtimePriceSource,
} from '@onekeyhq/shared/types/marketV2';

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

export function buildRealtimeTokenDetail({
  tokenDetail,
  realtimePrice,
  realtimePriceSource,
  lastUpdated = Date.now(),
}: {
  tokenDetail: IMarketTokenDetail;
  realtimePrice: string;
  realtimePriceSource: IMarketTokenDetailRealtimePriceSource;
  lastUpdated?: number;
}): IMarketTokenDetail {
  return {
    ...tokenDetail,
    price: realtimePrice,
    ...buildRealtimePriceDerivedFields({
      tokenDetail,
      realtimePrice,
    }),
    lastUpdated,
    realtimePriceSource,
  };
}

export function buildMatchedRealtimeTokenDetail({
  tokenDetail,
  tokenAddress,
  networkId,
  realtimePrice,
  realtimePriceSource,
  lastUpdated,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress?: string;
  networkId?: string;
  realtimePrice: string;
  realtimePriceSource: IMarketTokenDetailRealtimePriceSource;
  lastUpdated?: number;
}): IMarketTokenDetail | undefined {
  if (
    !tokenDetail ||
    !isValidRealtimePrice(realtimePrice) ||
    (tokenDetail.price === realtimePrice &&
      tokenDetail.realtimePriceSource === realtimePriceSource) ||
    !isMarketTokenDetailMatched({
      tokenDetail,
      tokenAddress,
      networkId,
    })
  ) {
    return undefined;
  }

  return buildRealtimeTokenDetail({
    tokenDetail,
    realtimePrice,
    realtimePriceSource,
    lastUpdated,
  });
}

export function isValidRealtimePrice(price: string) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) && numericPrice > 0;
}

export function isMarketTokenDetailMatched({
  tokenDetail,
  tokenAddress,
  networkId,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress?: string;
  networkId?: string;
}) {
  if (!tokenDetail) {
    return false;
  }

  if (!networkId) {
    return true;
  }

  if (tokenDetail.networkId && tokenDetail.networkId !== networkId) {
    return false;
  }

  if (!tokenAddress && tokenDetail.isNative) {
    return true;
  }

  return equalTokenNoCaseSensitive({
    token1: {
      networkId,
      contractAddress: tokenAddress || '',
    },
    token2: {
      networkId: tokenDetail.networkId || networkId,
      contractAddress: tokenDetail.address || '',
    },
  });
}
