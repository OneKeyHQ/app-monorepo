import BigNumber from 'bignumber.js';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

// The K-line feed is quoted in USD (`fetchMarketTokenKline` pins `currency`),
// while `/market/token/detail` converts its price when the user picked another
// display currency. Overlaying a USD close on a converted quote would swap a
// stale number for a wrong one, so the overlay is limited to USD.
export const MARKET_KLINE_LIVE_PRICE_CURRENCY = 'usd';

// The finest bucket the token K-line endpoint serves. Its open bucket carries
// the latest trade, which is the price the detail snapshot is missing.
export const MARKET_KLINE_LIVE_PRICE_INTERVAL = '1m';

// Only the newest bucket is needed, but a thin market can leave several of them
// without a trade, so ask for a window rather than a single bucket.
export const MARKET_KLINE_LIVE_PRICE_WINDOW_SECONDS = 600;

// Must stay under CHART_PRICE_FRESHNESS_MS (10s), the window during which
// `fetchTokenDetail` keeps this price instead of the snapshot it polls. Polling
// slower than that would let the stale snapshot back in between ticks.
export const MARKET_KLINE_LIVE_PRICE_POLLING_MS = 6000;

/**
 * The K-line feed prices a token's own trades, so it can only stand in for a
 * token-mode quote: a share quote comes from the stock feed. Top coins are
 * excluded because their quote comes from the market asset feed, not from a
 * single pool.
 */
export function resolveMarketKlineLivePriceEnabled({
  currencyId,
  isNative,
  marketAssetId,
  networkId,
  priceMode,
  tokenAddress,
}: {
  currencyId?: string;
  isNative?: boolean;
  marketAssetId?: string;
  networkId: string;
  priceMode: IMarketPriceSource;
  tokenAddress: string;
}): boolean {
  // A native coin has no contract address, and the K-line endpoint accepts that
  // identity — the historical series on this same chart already requests it that
  // way. Requiring an address would leave native coins on the stale snapshot.
  const hasTokenIdentity = Boolean(networkId && (tokenAddress || isNative));
  return Boolean(
    priceMode === 'token' &&
      !marketAssetId &&
      hasTokenIdentity &&
      currencyId?.toLowerCase() === MARKET_KLINE_LIVE_PRICE_CURRENCY,
  );
}

/**
 * Reads the latest traded price out of a K-line window: the newest bucket's
 * close. Buckets are returned oldest-first but a feed is not trusted to sort,
 * so the newest timestamp is picked explicitly.
 */
export function extractMarketKlineLivePrice(
  points: IMarketTokenKLineDataPoint[] | undefined,
): number | undefined {
  if (!points?.length) {
    return undefined;
  }

  const latest = points.reduce<IMarketTokenKLineDataPoint | undefined>(
    (newest, point) => {
      const timestamp = Number(point?.t);
      if (!Number.isFinite(timestamp)) {
        return newest;
      }
      return !newest || timestamp > Number(newest.t) ? point : newest;
    },
    undefined,
  );

  const close = Number(latest?.c);
  if (!Number.isFinite(close) || close <= 0) {
    return undefined;
  }
  return close;
}

/**
 * The quote is stored as a string and the feed hands prices over as numbers.
 * Cheap tokens would turn into exponent notation, which the polled quote never
 * uses, so the string is built through BigNumber to stay plain decimal.
 */
export function formatMarketKlineLivePrice(price: number): string {
  return new BigNumber(price).toFixed();
}
