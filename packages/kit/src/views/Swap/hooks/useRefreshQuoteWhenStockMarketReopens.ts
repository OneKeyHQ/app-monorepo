import { useLayoutEffect, useRef } from 'react';

/**
 * Refreshes the active quote when the polled Stock detail becomes tradable.
 *
 * Market detail is polled independently from quote events. A closed quote can
 * lag behind a newly opened market, so callers may request one reconciliation
 * per successful detail poll while that current closed quote is still present.
 * The quote result remains the execution authority.
 */
export function useRefreshQuoteWhenStockMarketReopens({
  enabled,
  marketIsOpen,
  marketIsPaused,
  marketDetailFetchedAt,
  onRefresh,
  refreshOnInitialOpen = false,
  refreshOnMarketStatusUpdate = false,
  scopeKey,
}: {
  enabled: boolean;
  marketIsOpen?: boolean;
  marketIsPaused?: boolean;
  marketDetailFetchedAt?: number;
  onRefresh: () => void;
  refreshOnInitialOpen?: boolean;
  refreshOnMarketStatusUpdate?: boolean;
  scopeKey: string;
}) {
  const refreshCycleRef = useRef({
    consumed: !refreshOnInitialOpen,
    marketDetailFetchedAt: undefined as number | undefined,
    scopeKey,
  });

  if (refreshCycleRef.current.scopeKey !== scopeKey) {
    refreshCycleRef.current = {
      consumed: !refreshOnInitialOpen,
      marketDetailFetchedAt: undefined,
      scopeKey,
    };
  }

  useLayoutEffect(() => {
    const refreshCycle = refreshCycleRef.current;
    const hasNewMarketDetail =
      marketDetailFetchedAt !== undefined &&
      marketDetailFetchedAt !== refreshCycle.marketDetailFetchedAt;
    if (hasNewMarketDetail) {
      refreshCycle.marketDetailFetchedAt = marketDetailFetchedAt;
    }

    if (marketIsPaused === true || marketIsOpen === false) {
      refreshCycle.consumed = false;
      return;
    }
    const hasResolvedMarketState =
      marketDetailFetchedAt !== undefined ||
      marketIsOpen !== undefined ||
      marketIsPaused !== undefined;
    if (
      !scopeKey ||
      !hasResolvedMarketState ||
      (refreshCycle.consumed &&
        !(refreshOnMarketStatusUpdate && hasNewMarketDetail))
    ) {
      return;
    }

    // Consume the transition or poll tick even when there is no actionable
    // amount. A later amount edit has its own quote effect.
    refreshCycle.consumed = true;
    if (enabled) {
      onRefresh();
    }
  }, [
    enabled,
    marketDetailFetchedAt,
    marketIsOpen,
    marketIsPaused,
    onRefresh,
    refreshOnMarketStatusUpdate,
    scopeKey,
  ]);
}
