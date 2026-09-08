import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

// The Market pages are the only reader of the persisted trading universe that
// never refreshes it on mount, so they bound its age themselves. A market
// being added or removed is rare enough that an hour is invisible, and the
// refresh is deduped anyway.
export const MARKET_PERPS_UNIVERSE_MAX_AGE_MS = timerUtils.getTimeDurationMs({
  hour: 1,
});

/**
 * Whether Market has to pull the perps trading meta before answering from the
 * persisted universe.
 *
 * Empty means a cold start that never visited Perps. Old means the last visit
 * was long enough ago that the answer can no longer be trusted in either
 * direction: a market listed since is missing from it, and one removed since
 * is still in it without the delisted flag.
 */
export function shouldRefreshMarketPerpsUniverse({
  universesByDex,
  updatedAt,
  now = Date.now(),
}: {
  universesByDex: IPerpsUniverse[][];
  updatedAt?: number;
  now?: number;
}) {
  if (!universesByDex[0]?.length) {
    return true;
  }
  if (!updatedAt) {
    return true;
  }
  return now - updatedAt > MARKET_PERPS_UNIVERSE_MAX_AGE_MS;
}
