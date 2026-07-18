import { useEffect, useMemo, useState } from 'react';

import type { IMarketTokenListResult } from '../MarketTokenListBase';

// Client sort must never touch the underlying data hook's sort setters:
// useMarketTokenList keys its query on sortBy/sortType, so calling them
// would refetch. Sorting is a pure view concern over the full in-hand pool.
export function useClientSortResult(
  result: IMarketTokenListResult,
  options?: { resetKey?: unknown },
): IMarketTokenListResult {
  const resetKey = options?.resetKey;
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    undefined,
  );

  useEffect(() => {
    setSortBy(undefined);
    setSortType(undefined);
  }, [resetKey]);

  return useMemo(
    () => ({
      ...result,
      setSortBy,
      setSortType,
      currentSortBy: sortBy,
      currentSortType: sortType,
      initialSortBy: undefined,
      initialSortType: undefined,
    }),
    [result, sortBy, sortType],
  );
}
