import { useEffect, useRef } from 'react';

const STOCK_MARKET_REOPEN_QUOTE_RETRY_DELAYS_MS = [2000, 4000, 8000] as const;

/**
 * Refreshes the active quote when the market reopens and lets the quote service
 * converge after a short market-status propagation delay.
 *
 * A fresh quote event remains the execution authority: Market detail only
 * signals that it is worth asking the quote service again. If a current quote
 * still reports a closed market, retries are bounded to avoid an open-ended
 * request loop. A later market-closed state or quote-identity change rearms the
 * retry budget.
 */
export function useRefreshQuoteWhenStockMarketReopens({
  enabled,
  marketIsOpen,
  onRefresh,
  quoteMarketClosed = false,
  refreshOnInitialOpen = false,
  scopeKey,
}: {
  enabled: boolean;
  marketIsOpen?: boolean;
  onRefresh: () => void;
  quoteMarketClosed?: boolean;
  refreshOnInitialOpen?: boolean;
  scopeKey: string;
}) {
  const refreshCycleRef = useRef({
    consumed: !refreshOnInitialOpen,
    quoteRetryCount: 0,
    scopeKey,
  });

  if (refreshCycleRef.current.scopeKey !== scopeKey) {
    refreshCycleRef.current = {
      consumed: !refreshOnInitialOpen,
      quoteRetryCount: 0,
      scopeKey,
    };
  }

  useEffect(() => {
    if (marketIsOpen === false) {
      refreshCycleRef.current.consumed = false;
      refreshCycleRef.current.quoteRetryCount = 0;
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

  useEffect(() => {
    if (!enabled || !scopeKey || marketIsOpen !== true || !quoteMarketClosed) {
      return;
    }
    const retryDelay =
      STOCK_MARKET_REOPEN_QUOTE_RETRY_DELAYS_MS[
        refreshCycleRef.current.quoteRetryCount
      ];
    if (retryDelay === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      if (refreshCycleRef.current.scopeKey !== scopeKey) {
        return;
      }
      refreshCycleRef.current.quoteRetryCount += 1;
      onRefresh();
    }, retryDelay);
    return () => clearTimeout(timer);
  }, [enabled, marketIsOpen, onRefresh, quoteMarketClosed, scopeKey]);
}
