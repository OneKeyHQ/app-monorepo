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

export type IBorrowMarketPreloadPhase = 'reserves' | 'metrics';

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
  hasAccountContext,
  now,
}: {
  markets: IBorrowMarketItem[];
  visibleMarketKey?: string;
  attempts: ReadonlyMap<string, IBorrowMarketPreloadAttempt>;
  sessionScopeKey: string;
  hasAccountContext: boolean;
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

  // Reserves are the barrier for every account metric. Retry or refresh all
  // reserves first; a failed reserve request that is still in backoff must
  // keep metrics paused rather than letting a partial preload look complete.
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

  if (hasAccountContext) {
    const unvisitedMetrics = availableMarkets.find(
      (market) =>
        !getAttempt({ attempts, sessionScopeKey, market, phase: 'metrics' }),
    );
    if (unvisitedMetrics) {
      return { market: unvisitedMetrics, phase: 'metrics' };
    }

    const retryableMetrics = availableMarkets.find((market) => {
      const attempt = getAttempt({
        attempts,
        sessionScopeKey,
        market,
        phase: 'metrics',
      });
      return (
        attempt && attempt.failedAttempts > 0 && attempt.nextEligibleAt <= now
      );
    });
    if (retryableMetrics) {
      return { market: retryableMetrics, phase: 'metrics' };
    }

    const metricsDueForRefresh = availableMarkets.find((market) => {
      const attempt = getAttempt({
        attempts,
        sessionScopeKey,
        market,
        phase: 'metrics',
      });
      return attempt?.failedAttempts === 0 && attempt.nextEligibleAt <= now;
    });
    if (metricsDueForRefresh) {
      return { market: metricsDueForRefresh, phase: 'metrics' };
    }
  }
  return undefined;
}

export function getBorrowMarketPreloadNextWakeAt({
  markets,
  visibleMarketKey,
  attempts,
  sessionScopeKey,
  hasAccountContext,
  now,
}: {
  markets: IBorrowMarketItem[];
  visibleMarketKey?: string;
  attempts: ReadonlyMap<string, IBorrowMarketPreloadAttempt>;
  sessionScopeKey: string;
  hasAccountContext: boolean;
  now: number;
}): number | undefined {
  const pendingTimes = markets
    .filter((market) => buildBorrowMarketKey(market) !== visibleMarketKey)
    .flatMap((market) =>
      (hasAccountContext
        ? (['reserves', 'metrics'] as const)
        : (['reserves'] as const)
      ).map((phase) =>
        getAttempt({ attempts, sessionScopeKey, market, phase }),
      ),
    )
    .filter(
      (attempt): attempt is IBorrowMarketPreloadAttempt =>
        attempt !== undefined && attempt.nextEligibleAt > now,
    )
    .map((attempt) => attempt.nextEligibleAt);
  return pendingTimes.length > 0 ? Math.min(...pendingTimes) : undefined;
}
