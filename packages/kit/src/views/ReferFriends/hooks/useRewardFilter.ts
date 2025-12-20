import { useCallback, useMemo, useState } from 'react';

import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

import type { IFilterState } from '../components/FilterButton';

export const useRewardFilter: () => {
  filterState: IFilterState;
  updateFilter: (updates: Partial<IFilterState>) => void;
  resetFilter: () => void;
  isFiltered: boolean;
} = () => {
  const [filterState, setFilterState] = useState<IFilterState>({
    timeRange: EExportTimeRange.All,
    inviteCode: undefined,
  });

  const updateFilter = useCallback((updates: Partial<IFilterState>) => {
    setFilterState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState({
      timeRange: EExportTimeRange.All,
      inviteCode: undefined,
    });
  }, []);

  const isFiltered = useMemo(() => {
    return (
      filterState.timeRange !== EExportTimeRange.All ||
      filterState.inviteCode !== undefined
    );
  }, [filterState]);

  return {
    filterState,
    updateFilter,
    resetFilter,
    isFiltered,
  };
};
