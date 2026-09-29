import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

// Allow the same inactivity window as Market WS subscription recovery.
export const MARKET_CHART_PRICE_STALE_MS = 60_000;

export function getMarketTokenPriceConversionRate({
  price,
  priceConverted,
}: Pick<IMarketTokenDetail, 'price' | 'priceConverted'>): string | undefined {
  const usd = new BigNumber(price ?? NaN);
  const converted = new BigNumber(priceConverted ?? NaN);
  if (
    !usd.isFinite() ||
    !usd.gt(0) ||
    !converted.isFinite() ||
    !converted.gt(0)
  ) {
    return undefined;
  }
  return converted.dividedBy(usd).toFixed();
}

export function getMarketTokenConvertedPrice(
  price: string | undefined,
  conversionRate: string | undefined,
): string | undefined {
  if (conversionRate === undefined) {
    return undefined;
  }
  const converted = new BigNumber(price ?? NaN).times(conversionRate);
  return converted.isFinite() && converted.gt(0)
    ? converted.toFixed()
    : undefined;
}

function getFiniteTimestamp(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function mergeMarketTokenDetailPrice({
  currentTokenDetail,
  tokenData,
  requestStartedAt,
}: {
  currentTokenDetail: IMarketTokenDetail | undefined;
  tokenData: IMarketTokenDetail;
  requestStartedAt: number;
}): IMarketTokenDetail {
  const current =
    currentTokenDetail &&
    equalTokenNoCaseSensitive({
      token1: {
        networkId: currentTokenDetail.networkId ?? '',
        contractAddress: currentTokenDetail.address ?? '',
      },
      token2: {
        networkId: tokenData.networkId ?? '',
        contractAddress: tokenData.address ?? '',
      },
    })
      ? currentTokenDetail
      : undefined;
  const chartPriceUpdatedAt = getFiniteTimestamp(current?.chartPriceUpdatedAt);
  const initializedAt = getFiniteTimestamp(current?.detailPriceInitializedAt);
  const priceActivityAt = chartPriceUpdatedAt ?? initializedAt;
  const numericPrice = Number(tokenData.price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const currentNumericPrice = Number(current?.price);
  const hasValidCurrentPrice =
    Number.isFinite(currentNumericPrice) && currentNumericPrice > 0;
  const receivedAt = Date.now();
  const detailPriceInitializedAt =
    initializedAt ?? (hasValidPrice ? receivedAt : undefined);
  // The API supplies a paired USD/converted quote. Retain its rate instead of
  // repeatedly deriving one from rounded live prices on every chart tick.
  const priceConversionRate = hasValidPrice
    ? getMarketTokenPriceConversionRate(tokenData)
    : (current?.priceConversionRate ??
      getMarketTokenPriceConversionRate(current ?? {}));

  // Judge freshness when the request started, not when its response arrives.
  // A chart tick during either the API request or a decimals lookup also keeps
  // ownership, even if that tick is already old by the time the work finishes.
  const preservePrice =
    current &&
    ((!hasValidPrice && hasValidCurrentPrice) ||
      (priceActivityAt !== undefined &&
        requestStartedAt - priceActivityAt < MARKET_CHART_PRICE_STALE_MS));
  if (preservePrice) {
    return {
      ...tokenData,
      price: current.price,
      priceConverted: getMarketTokenConvertedPrice(
        current.price,
        priceConversionRate,
      ),
      priceConversionRate,
      lastUpdated: current.lastUpdated,
      chartPriceUpdatedAt,
      detailPriceInitializedAt,
    };
  }

  return {
    ...tokenData,
    // Fallback quotes must advance the header cache without resetting the
    // chart inactivity clock; every later poll may refresh until ticks resume.
    ...(hasValidPrice && priceActivityAt !== undefined
      ? {
          lastUpdated: Math.max(
            receivedAt,
            (getFiniteTimestamp(current?.lastUpdated) ?? 0) + 1,
          ),
        }
      : {}),
    chartPriceUpdatedAt,
    detailPriceInitializedAt,
    priceConversionRate,
  };
}
