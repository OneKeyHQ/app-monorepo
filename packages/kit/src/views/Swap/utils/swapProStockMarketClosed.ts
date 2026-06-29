import { isStockMarketClosed } from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert/resolveStockMarketStatusCase';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

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
  if (!detail || !selectToken) {
    return false;
  }
  const detailMatchesSelectedToken = equalTokenNoCaseSensitive({
    token1: { networkId: detail.networkId, contractAddress: detail.address },
    token2: selectToken,
  });
  return detailMatchesSelectedToken && isStockMarketClosed(detail.stock);
}
