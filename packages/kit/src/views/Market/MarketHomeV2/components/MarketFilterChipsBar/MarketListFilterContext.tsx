import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { sameConditions } from './marketListFilterConfig';

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

  // Mirrors filterState so the callback below can compare against the current
  // conditions without taking them as a dependency and churning its identity.
  const conditionsRef = useRef(filterState.conditions);
  conditionsRef.current = filterState.conditions;

  const applyConditions = useCallback(
    (
      conditions: IMarketListFilterConditions,
      options?: { sort?: IMarketListSortState },
    ) => {
      // A caller applying both at once (a chip carrying its own sort) always
      // wins, whether or not the conditions moved.
      if (options?.sort) {
        setFilterState({ conditions });
        setSortState(options.sort);
        return;
      }
      // Every entry point funnels through here — the chip row, the tier
      // popover, clear-all and the Filters modal — and several of them re-apply
      // the value that is already selected. Resetting the sort belongs to an
      // actual change of slice: the ordering is only invalidated when the rows
      // being ordered change. A no-op re-apply must leave the sort alone.
      if (sameConditions(conditionsRef.current, conditions)) {
        return;
      }
      setFilterState({ conditions });
      setSortState(EMPTY_SORT);
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
