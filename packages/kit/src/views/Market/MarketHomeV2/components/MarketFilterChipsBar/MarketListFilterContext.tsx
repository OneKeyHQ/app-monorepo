import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  IMarketListFilterContextValue,
  IMarketListFilterState,
} from './marketListFilterTypes';

const EMPTY_STATE: IMarketListFilterState = { conditions: {} };

const EMPTY_CONTEXT: IMarketListFilterContextValue = {
  filterState: EMPTY_STATE,
  setFilterState: () => undefined,
  filterRevision: 0,
  activeConditionCount: 0,
};

const MarketListFilterContext =
  createContext<IMarketListFilterContextValue>(EMPTY_CONTEXT);

export function MarketListFilterProvider({ children }: PropsWithChildren) {
  const [filterState, setFilterStateRaw] =
    useState<IMarketListFilterState>(EMPTY_STATE);
  const revisionRef = useRef(0);
  const [filterRevision, setFilterRevision] = useState(0);

  const value = useMemo<IMarketListFilterContextValue>(
    () => ({
      filterState,
      setFilterState: (next) => {
        revisionRef.current += 1;
        setFilterRevision(revisionRef.current);
        setFilterStateRaw(next);
      },
      filterRevision,
      activeConditionCount: Object.keys(filterState.conditions).length,
    }),
    [filterState, filterRevision],
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
