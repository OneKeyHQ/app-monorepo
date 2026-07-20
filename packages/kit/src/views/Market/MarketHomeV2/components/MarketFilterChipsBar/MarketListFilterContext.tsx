import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  IMarketListFilterConditions,
  IMarketListFilterContextValue,
  IMarketListFilterState,
  IMarketListSortState,
} from './marketListFilterTypes';

const EMPTY_STATE: IMarketListFilterState = { conditions: {} };
const EMPTY_SORT: IMarketListSortState = {};

const EMPTY_CONTEXT: IMarketListFilterContextValue = {
  filterState: EMPTY_STATE,
  sortState: EMPTY_SORT,
  applyConditions: () => undefined,
  setSortState: () => undefined,
  activeConditionCount: 0,
};

const MarketListFilterContext =
  createContext<IMarketListFilterContextValue>(EMPTY_CONTEXT);

// The single source of truth for "how you want to see this table". Chip
// selection, the chip row's condition chips, the popover's tier selection and
// the Filters badge are all read off this one state — none of them keeps a
// copy, so they cannot drift apart.
export function MarketListFilterProvider({ children }: PropsWithChildren) {
  const [filterState, setFilterState] =
    useState<IMarketListFilterState>(EMPTY_STATE);
  const [sortState, setSortState] = useState<IMarketListSortState>(EMPTY_SORT);

  const applyConditions = useCallback(
    (
      conditions: IMarketListFilterConditions,
      options?: { sort?: IMarketListSortState },
    ) => {
      setFilterState({ conditions });
      // Changing the filtered slice invalidates the ordering computed over the
      // previous one, so sort resets — unless the caller is applying both at
      // once (a chip that carries its own sort).
      setSortState(options?.sort ?? EMPTY_SORT);
    },
    [],
  );

  const value = useMemo<IMarketListFilterContextValue>(
    () => ({
      filterState,
      sortState,
      applyConditions,
      setSortState,
      activeConditionCount: Object.keys(filterState.conditions).length,
    }),
    [filterState, sortState, applyConditions],
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
