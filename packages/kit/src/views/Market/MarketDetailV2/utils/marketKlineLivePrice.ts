import BigNumber from 'bignumber.js';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

// The finest bucket the token K-line endpoint serves. Its open bucket carries
// the latest trade, which is the price the detail snapshot is missing.
export const MARKET_KLINE_LIVE_PRICE_INTERVAL = '1m';

// Only the newest bucket is needed, but a thin market can leave several of them
// without a trade, so ask for a window rather than a single bucket.
export const MARKET_KLINE_LIVE_PRICE_WINDOW_SECONDS = 600;

// Refresh the simple chart's latest close independently of the initial details.
export const MARKET_KLINE_LIVE_PRICE_POLLING_MS = 6000;

/**
 * The K-line feed prices a token's own trades, so it can only stand in for a
 * token-mode quote: a share quote comes from the stock feed. Top coins use the
 * aggregate asset K-line feed in Simple mode. The detail's primary `price` and
 * both K-line feeds are always USD; a selected currency uses `priceConverted`.
 */
export function resolveMarketKlineLivePriceEnabled({
  isNative,
  networkId,
  priceMode,
  tokenAddress,
}: {
  isNative?: boolean;
  networkId: string;
  priceMode: IMarketPriceSource;
  tokenAddress: string;
}): boolean {
  // A native coin has no contract address, and the K-line endpoint accepts that
  // identity — the historical series on this same chart already requests it that
  // way. Requiring an address would leave native coins on the stale snapshot.
  const hasTokenIdentity = Boolean(networkId && (tokenAddress || isNative));
  return priceMode === 'token' && hasTokenIdentity;
}

/**
 * Decides whether a resolved poll may still write the quote. Two polls overlap
 * whenever a reconnect or focus revalidation starts one while a paced tick is in
 * flight, and the older one can answer last. Start order has to hold as well as
 * scope: this write goes to a shared atom and stamps itself as the newest price,
 * so an out-of-order one would pin a stale close until the next tick.
 */
export function shouldApplyMarketKlineLivePrice<T>({
  appliedSeq,
  currentRequestScope,
  requestScope,
  requestSeq,
}: {
  appliedSeq: number | undefined;
  currentRequestScope: T | null;
  requestScope: T;
  requestSeq: number;
}): boolean {
  return currentRequestScope === requestScope && requestSeq > (appliedSeq ?? 0);
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
