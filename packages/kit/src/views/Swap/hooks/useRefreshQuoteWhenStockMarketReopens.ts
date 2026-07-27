import { useEffect, useRef } from 'react';

/**
 * Refreshes the active quote once per market-open cycle.
 *
 * A fresh quote event remains the execution authority: Market detail only
 * signals that it is worth asking the quote service again. If the services
 * disagree and the new quote is still closed, the same `isOpen === true`
 * snapshot must not create a refresh loop. A later observed closed state
 * rearms the next open transition.
 */
export function useRefreshQuoteWhenStockMarketReopens({
  enabled,
  marketIsOpen,
  onRefresh,
  refreshOnInitialOpen = false,
  scopeKey,
}: {
  enabled: boolean;
  marketIsOpen?: boolean;
  onRefresh: () => void;
  refreshOnInitialOpen?: boolean;
  scopeKey: string;
}) {
  const refreshCycleRef = useRef({
    consumed: !refreshOnInitialOpen,
    scopeKey,
  });

  if (refreshCycleRef.current.scopeKey !== scopeKey) {
    refreshCycleRef.current = {
      consumed: !refreshOnInitialOpen,
      scopeKey,
    };
  }

  useEffect(() => {
    if (marketIsOpen === false) {
      refreshCycleRef.current.consumed = false;
      return;
    }
    if (
      !scopeKey ||
      marketIsOpen !== true ||
      refreshCycleRef.current.consumed
    ) {
      return;
    }

    // Consume the transition even when there is no actionable amount. A later
    // amount edit has its own quote effect and must not receive a duplicate
    // refresh from an already completed market-open cycle.
    refreshCycleRef.current.consumed = true;
    if (enabled) {
      onRefresh();
    }
  }, [enabled, marketIsOpen, onRefresh, scopeKey]);
}
