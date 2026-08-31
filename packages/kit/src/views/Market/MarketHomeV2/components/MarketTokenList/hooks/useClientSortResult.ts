import { useCallback, useMemo, useState } from 'react';

import type { IMarketTokenListResult } from '../MarketTokenListBase';

type ISortValue = { sortBy?: string; sortType?: 'asc' | 'desc' };

type IExternalSort = ISortValue & {
  // Updater form is required: MarketTokenListBase sets sortBy and sortType in
  // two consecutive calls, so the second must merge onto the first's result
  // rather than the pre-render snapshot.
  onChange: (updater: (prev: ISortValue) => ISortValue) => void;
};

// Client sort must never touch the underlying data hook's sort setters:
// useMarketTokenList keys its query on sortBy/sortType, so calling them
// would refetch. Sorting is a pure view concern over the full in-hand pool.
//
// Pass `externalSort` to hand ownership of that view state to a shared store,
// so an outside control (the sort chip) and the table header drive the exact
// same sort instead of each keeping a private copy.
export function useClientSortResult(
  result: IMarketTokenListResult,
  options?: { externalSort?: IExternalSort },
): IMarketTokenListResult {
  const externalSort = options?.externalSort;
  const [localSortBy, setLocalSortBy] = useState<string | undefined>(undefined);
  const [localSortType, setLocalSortType] = useState<
    'asc' | 'desc' | undefined
  >(undefined);

  const sortBy = externalSort ? externalSort.sortBy : localSortBy;
  const sortType = externalSort ? externalSort.sortType : localSortType;
  const externalOnChange = externalSort?.onChange;

  const setSortBy = useCallback(
    (next: string | undefined) => {
      if (externalOnChange) {
        externalOnChange((prev) => ({ ...prev, sortBy: next }));
      } else {
        setLocalSortBy(next);
      }
    },
    [externalOnChange],
  );

  const setSortType = useCallback(
    (next: 'asc' | 'desc' | undefined) => {
      if (externalOnChange) {
        externalOnChange((prev) => ({ ...prev, sortType: next }));
      } else {
        setLocalSortType(next);
      }
    },
    [externalOnChange],
  );

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
    [result, sortBy, sortType, setSortBy, setSortType],
  );
}
