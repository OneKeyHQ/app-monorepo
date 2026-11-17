import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

// Foreground hooks revalidate after one minute; avoid cycling every market's
// background requests at that rate while the user is on the page.
export const BORROW_MARKET_PRELOAD_SUCCESS_TTL = 5 * 60 * 1000;
const BORROW_MARKET_PRELOAD_RETRY_BASE_DELAY = 5 * 1000;
const BORROW_MARKET_PRELOAD_RETRY_MAX_DELAY = 5 * 60 * 1000;

export type IBorrowMarketPreloadAttempt = {
  nextEligibleAt: number;
  failedAttempts: number;
};

export type IBorrowMarketPreloadPhase = 'reserves';

export type IBorrowMarketPreloadWork = {
  market: IBorrowMarketItem;
  phase: IBorrowMarketPreloadPhase;
};

export function getBorrowMarketPreloadRetryDelay(failedAttempts: number) {
  return Math.min(
    BORROW_MARKET_PRELOAD_RETRY_BASE_DELAY *
      2 ** Math.max(0, failedAttempts - 1),
    BORROW_MARKET_PRELOAD_RETRY_MAX_DELAY,
  );
}

export function getBorrowMarketPreloadCompletionKey({
  sessionScopeKey,
  market,
  phase = 'reserves',
}: {
  sessionScopeKey: string;
  market: IBorrowMarketItem;
  phase?: IBorrowMarketPreloadPhase;
}) {
  return JSON.stringify([sessionScopeKey, buildBorrowMarketKey(market), phase]);
}

function getAttempt({
  attempts,
  sessionScopeKey,
  market,
  phase,
}: {
  attempts: ReadonlyMap<string, IBorrowMarketPreloadAttempt>;
  sessionScopeKey: string;
  market: IBorrowMarketItem;
  phase: IBorrowMarketPreloadPhase;
}) {
  return attempts.get(
    getBorrowMarketPreloadCompletionKey({ sessionScopeKey, market, phase }),
  );
}

export function getNextBorrowMarketToPreload({
  markets,
  visibleMarketKey,
  attempts,
  sessionScopeKey,
  now,
}: {
  markets: IBorrowMarketItem[];
  visibleMarketKey?: string;
  attempts: ReadonlyMap<string, IBorrowMarketPreloadAttempt>;
  sessionScopeKey: string;
  now: number;
}): IBorrowMarketPreloadWork | undefined {
  const availableMarkets = markets
    .toSorted((left, right) => {
      if (left.networkId === right.networkId) {
        return 0;
      }
      return left.networkId < right.networkId ? -1 : 1;
    })
    .filter((market) => buildBorrowMarketKey(market) !== visibleMarketKey);
  const unvisitedReserves = availableMarkets.find(
    (market) =>
      !getAttempt({ attempts, sessionScopeKey, market, phase: 'reserves' }),
  );
  if (unvisitedReserves) {
    return { market: unvisitedReserves, phase: 'reserves' };
  }

  // Retry or refresh reserves in the background without starting any
  // account-scoped work for markets the user has not selected.
  const retryableReserves = availableMarkets.find((market) => {
    const attempt = getAttempt({
      attempts,
      sessionScopeKey,
      market,
      phase: 'reserves',
    });
    return (
      attempt && attempt.failedAttempts > 0 && attempt.nextEligibleAt <= now
    );
  });
  if (retryableReserves) {
    return { market: retryableReserves, phase: 'reserves' };
  }

  const reservesDueForRefresh = availableMarkets.find((market) => {
    const attempt = getAttempt({
      attempts,
      sessionScopeKey,
      market,
      phase: 'reserves',
    });
    return attempt?.failedAttempts === 0 && attempt.nextEligibleAt <= now;
  });
  if (reservesDueForRefresh) {
    return { market: reservesDueForRefresh, phase: 'reserves' };
  }

  const reservesPending = availableMarkets.some((market) => {
    const attempt = getAttempt({
      attempts,
      sessionScopeKey,
      market,
      phase: 'reserves',
    });
    return (
      !attempt || attempt.failedAttempts > 0 || attempt.nextEligibleAt <= now
    );
  });
  if (reservesPending) {
    return undefined;
  }

  return undefined;
}

export function getBorrowMarketPreloadNextWakeAt({
  markets,
  visibleMarketKey,
  attempts,
  sessionScopeKey,
  now,
}: {
  markets: IBorrowMarketItem[];
  visibleMarketKey?: string;
  attempts: ReadonlyMap<string, IBorrowMarketPreloadAttempt>;
  sessionScopeKey: string;
  now: number;
}): number | undefined {
  const pendingTimes = markets
    .filter((market) => buildBorrowMarketKey(market) !== visibleMarketKey)
    .flatMap((market) =>
      getAttempt({ attempts, sessionScopeKey, market, phase: 'reserves' }),
    )
    .filter(
      (attempt): attempt is IBorrowMarketPreloadAttempt =>
        attempt !== undefined && attempt.nextEligibleAt > now,
    )
    .map((attempt) => attempt.nextEligibleAt);
  return pendingTimes.length > 0 ? Math.min(...pendingTimes) : undefined;
}
