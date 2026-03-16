import { useMemo } from 'react';

import type { IMarketToken } from '../MarketTokenData';
import type { IWatchlistFilterType } from '../MarketWatchlistCategorySelector';

export function useWatchlistFilteredGroups(
  data: IMarketToken[],
  options?: { hideNativeToken?: boolean; hidePerps?: boolean },
) {
  const hideNativeToken = options?.hideNativeToken;
  const hidePerps = options?.hidePerps;

  return useMemo(() => {
    let base = data;
    if (hideNativeToken) {
      base = base.filter((t) => !t.isNative);
    }
    if (hidePerps) {
      base = base.filter((t) => !t.perpsCoin);
    }
    return {
      all: base,
      spot: base.filter((t) => !t.perpsCoin),
      perps: base.filter((t) => !!t.perpsCoin),
    } satisfies Record<IWatchlistFilterType, IMarketToken[]>;
  }, [data, hideNativeToken, hidePerps]);
}
