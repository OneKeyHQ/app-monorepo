import { useCallback, useMemo, useState } from 'react';

import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

import type { IFilterState } from '../components/FilterButton';

// Extend with reward type specific data
export type IRewardFilterData<T> = T & {
  createdAt?: string;
  inviteCode?: string;
};

const getTimeRangeDays = (timeRange: EExportTimeRange): number | null => {
  switch (timeRange) {
    case EExportTimeRange.OneMonth:
      return 30;
    case EExportTimeRange.ThreeMonths:
      return 90;
    case EExportTimeRange.All:
    default:
      return null;
  }
};

export const useRewardFilter = <T extends Record<string, any>>(
  data: Array<IRewardFilterData<T>>,
) => {
  const [filterState, setFilterState] = useState<IFilterState>({
    timeRange: EExportTimeRange.All,
    inviteCode: undefined,
  });

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply time range filter
    const days = getTimeRangeDays(filterState.timeRange);
    if (days !== null) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      result = result.filter((item) => {
        if (item.createdAt) {
          const itemDate = new Date(item.createdAt);
          return itemDate >= cutoffDate;
        }
        return true; // Keep items without createdAt field
      });
    }

    // Apply invite code filter
    if (filterState.inviteCode !== undefined) {
      result = result.filter((item) => {
        if ('inviteCode' in item) {
          return item.inviteCode === filterState.inviteCode;
        }
        return true; // Keep items without inviteCode field
      });
    }

    return result;
  }, [data, filterState]);

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

  // Export parameters for the ExportButton
  const exportParams = useMemo(() => {
    return {
      timeRange: filterState.timeRange,
      inviteCode: filterState.inviteCode,
    };
  }, [filterState]);

  return {
    filterState,
    filteredData,
    updateFilter,
    resetFilter,
    isFiltered,
    exportParams,
  };
};
