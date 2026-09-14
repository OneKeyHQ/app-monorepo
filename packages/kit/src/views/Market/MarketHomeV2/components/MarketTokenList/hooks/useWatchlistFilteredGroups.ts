import { useMemo } from 'react';

import type { IMarketToken } from '../MarketTokenData';
import type { IWatchlistFilterType } from '../MarketWatchlistCategorySelector';

export type IWatchlistFilteredGroups = Record<
  IWatchlistFilterType,
  IMarketToken[]
>;

/**
 * Stock listings (starred on the Stocks tab) and tokenized stocks (chain
 * tokens the API tags with `stock` info) both belong under Stocks. Legacy chain
 * favorites keep their stored `stockId` next to the address, so either
 * signal counts.
 */
export function isWatchlistStockToken(
  token: Pick<IMarketToken, 'stockId' | 'stock'>,
) {
  return Boolean(token.stockId) || Boolean(token.stock);
}

export function useWatchlistFilteredGroups(
  data: IMarketToken[],
  options?: {
    hideNativeToken?: boolean;
    hidePerps?: boolean;
    hideListings?: boolean;
  },
): IWatchlistFilteredGroups {
  const hideNativeToken = options?.hideNativeToken;
  const hidePerps = options?.hidePerps;
  const hideListings = options?.hideListings;

  return useMemo(() => {
    let base = data;
    if (hideNativeToken) {
      base = base.filter((t) => !t.isNative);
    }
    if (hidePerps) {
      base = base.filter((t) => !t.perpsCoin);
    }
    if (hideListings) {
      base = base.filter(
        (t) => Boolean(t.networkId) && Boolean(t.address || t.isNative),
      );
    }
    const spot = base.filter((t) => !t.perpsCoin);
    return {
      all: base,
      spot,
      // Stocks is a lens over spot, not a partition of it: stock listings and
      // tokenized stocks stay visible under Spot as well.
      stocks: spot.filter((t) => isWatchlistStockToken(t)),
      perps: base.filter((t) => !!t.perpsCoin),
    };
  }, [data, hideNativeToken, hidePerps, hideListings]);
}
