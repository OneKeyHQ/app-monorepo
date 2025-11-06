import { useCallback, useMemo, useState } from 'react';

import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';
import type { IHardwareSalesRecord } from '@onekeyhq/shared/src/referralCode/type';

export interface IFilterState {
  timeRange: EExportTimeRange;
  inviteCode?: string;
}

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

export const useHardwareSalesFilter = (data: IHardwareSalesRecord['items']) => {
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
        const itemDate = new Date(item.createdAt);
        return itemDate >= cutoffDate;
      });
    }

    // Apply invite code filter if needed
    // Note: Currently the IHardwareSalesRecordItem doesn't have inviteCode field
    // This logic needs to be implemented when the field is available
    if (filterState.inviteCode) {
      // TODO: Filter by invite code when the field is available in the data structure
      // result = result.filter(item => item.inviteCode === filterState.inviteCode);
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
