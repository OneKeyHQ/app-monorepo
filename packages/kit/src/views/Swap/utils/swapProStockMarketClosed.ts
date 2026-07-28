import { isStockMarketClosed } from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert/resolveStockMarketStatusCase';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export const SWAP_PRO_STOCK_MARKET_DETAIL_LAST_GOOD_TTL_MS = 60_000;

export function isSelectedProStockMarketDetailResolved(
  detail: IMarketTokenDetail | undefined,
  selectToken: ISwapToken | undefined,
): boolean {
  if (!detail?.stock || !selectToken) {
    return false;
  }
  return equalTokenNoCaseSensitive({
    token1: { networkId: detail.networkId, contractAddress: detail.address },
    token2: selectToken,
  });
}

export function isSelectedProStockMarketDetailActivationSettled(
  activationState:
    | {
        contractAddress: string;
        networkId: string;
        settled: boolean;
      }
    | undefined,
  selectToken: ISwapToken | undefined,
): boolean {
  return Boolean(
    activationState?.settled &&
    selectToken &&
    equalTokenNoCaseSensitive({
      token1: activationState,
      token2: selectToken,
    }),
  );
}

export function isSelectedProStockMarketDetailAuthoritative(
  detail: IMarketTokenDetail | undefined,
  activationState:
    | {
        contractAddress: string;
        lastSuccessfulFetchAt?: number;
        latestFetchSucceeded: boolean;
        networkId: string;
        settled: boolean;
      }
    | undefined,
  selectToken: ISwapToken | undefined,
  now = Date.now(),
): boolean {
  if (
    !isSelectedProStockMarketDetailResolved(detail, selectToken) ||
    !isSelectedProStockMarketDetailActivationSettled(
      activationState,
      selectToken,
    )
  ) {
    return false;
  }
  if (activationState?.latestFetchSucceeded) {
    return true;
  }
  const isRestrictiveLastGood =
    isStockMarketClosed(detail?.stock) || detail?.stock?.isPaused === true;
  return Boolean(
    isRestrictiveLastGood &&
    activationState?.lastSuccessfulFetchAt &&
    now - activationState.lastSuccessfulFetchAt <=
      SWAP_PRO_STOCK_MARKET_DETAIL_LAST_GOOD_TTL_MS,
  );
}

/**
 * Swap Pro keeps its own `swapProTokenMarketDetailInfoAtom`, and it is NOT
 * cleared when `swapProSelectToken` changes. A stale detail (right after a
 * token switch) or a late-arriving request can therefore describe a different
 * token than the one currently selected. Reading the market-closed state
 * straight off that detail would either (a) keep a previous stock's "closed"
 * state and wrongly disable the newly selected token, or (b) briefly allow
 * ordering a just-selected closed stock before its own detail returns.
 *
 * So only treat the market as closed when the detail still matches the current
 * `swapProSelectToken` (networkId + address). Both the alert (SwapProContainer)
 * and the action button (SwapProActionButton) go through this helper, so they
 * always agree.
 */
export function isSelectedProStockMarketClosed(
  detail: IMarketTokenDetail | undefined,
  selectToken: ISwapToken | undefined,
): boolean {
  return (
    isSelectedProStockMarketDetailResolved(detail, selectToken) &&
    isStockMarketClosed(detail?.stock)
  );
}

export function isSelectedProStockTradingPaused(
  detail: IMarketTokenDetail | undefined,
  selectToken: ISwapToken | undefined,
): boolean {
  return (
    isSelectedProStockMarketDetailResolved(detail, selectToken) &&
    detail?.stock?.isPaused === true
  );
}

export function shouldDeferSelectedProStockQuoteErrorAlert({
  hasAuthoritativeMarketRestriction,
  isStockTrade,
  marketDetailReconciled,
  quoteErrorMessage,
  visibleAlertTitle,
}: {
  hasAuthoritativeMarketRestriction: boolean;
  isStockTrade: boolean;
  marketDetailReconciled: boolean;
  quoteErrorMessage?: string;
  visibleAlertTitle?: string;
}): boolean {
  return Boolean(
    isStockTrade &&
    !hasAuthoritativeMarketRestriction &&
    !marketDetailReconciled &&
    quoteErrorMessage?.trim() &&
    visibleAlertTitle?.trim() === quoteErrorMessage.trim(),
  );
}
