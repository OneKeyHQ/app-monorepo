// What the Pools list holds and how it ranks, decided from a pool's own
// figures. No hand-kept list of pools decides either.

// The list's floors, as Revert's Discover applies them: a day's volume of at
// least $100 and fees of at least 0.001% of TVL.
export const POOL_LIST_MIN_VOLUME_24H_USD = 100;
export const POOL_LIST_MIN_FEES_TO_TVL = 0.000_01;

/** Too little trading for the list; the pool's address still finds it */
export function isBelowPoolListFloors({
  tvlUsd,
  volume24hUsd,
  fees24hUsd,
}: {
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
}) {
  return (
    volume24hUsd < POOL_LIST_MIN_VOLUME_24H_USD ||
    !(tvlUsd > 0) ||
    fees24hUsd / tvlUsd < POOL_LIST_MIN_FEES_TO_TVL
  );
}

/**
 * A pool's TVL as the list shows and ranks it. A token priced only by its
 * own pools can be given any value, so a side counts only at a trusted
 * price: both sides when both tokens have one; twice the trusted side when
 * one has (at its own price a pool's two sides are worth about the same);
 * nothing when neither has. A new token paired with a little ETH then ranks
 * by that ETH, however many billions its own side claims.
 */
export function getTrackedTvlUsd({
  value0Usd,
  value1Usd,
  trusted0,
  trusted1,
}: {
  value0Usd: number;
  value1Usd: number;
  trusted0: boolean;
  trusted1: boolean;
}) {
  if (trusted0 && trusted1) {
    return value0Usd + value1Usd;
  }
  if (trusted0) {
    return value0Usd * 2;
  }
  if (trusted1) {
    return value1Usd * 2;
  }
  return 0;
}
