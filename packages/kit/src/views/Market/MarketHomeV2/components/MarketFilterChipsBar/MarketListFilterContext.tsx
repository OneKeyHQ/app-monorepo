import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  IMarketListFilterContextValue,
  IMarketListFilterState,
  IMarketListSortState,
} from './marketListFilterTypes';

const EMPTY_STATE: IMarketListFilterState = { conditions: {} };
const EMPTY_SORT: IMarketListSortState = {};

const EMPTY_CONTEXT: IMarketListFilterContextValue = {
  filterState: EMPTY_STATE,
  setFilterState: () => undefined,
  sortState: EMPTY_SORT,
  setSortState: () => undefined,
  activeConditionCount: 0,
};

const MarketListFilterContext =
  createContext<IMarketListFilterContextValue>(EMPTY_CONTEXT);

// Owns both halves of "how you want to see this table". Sort is deliberately
// NOT reset when conditions change: sort chips and filter chips share one row
// as peers, so filtering must not silently undo the user's sort.
export function MarketListFilterProvider({ children }: PropsWithChildren) {
  const [filterState, setFilterState] =
    useState<IMarketListFilterState>(EMPTY_STATE);
  const [sortState, setSortState] = useState<IMarketListSortState>(EMPTY_SORT);

  const value = useMemo<IMarketListFilterContextValue>(
    () => ({
      filterState,
      setFilterState,
      sortState,
      setSortState,
      activeConditionCount: Object.keys(filterState.conditions).length,
    }),
    [filterState, sortState],
  );

  return (
    <MarketListFilterContext.Provider value={value}>
      {children}
    </MarketListFilterContext.Provider>
  );
}

export function useMarketListFilter() {
  return useContext(MarketListFilterContext);
}
