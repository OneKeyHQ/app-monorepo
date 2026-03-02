import { useCallback, useMemo, useState } from 'react';

import type { IDateRange } from '@onekeyhq/components';
import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

import type { IFilterState } from '../components/FilterButton';

// Helper to get IDateRange from filterState for DatePicker display
export const getDatePickerValue = (filterState: IFilterState): IDateRange => {
  if (filterState.startTime && filterState.endTime) {
    return {
      start: new Date(filterState.startTime),
      end: new Date(filterState.endTime),
    };
  }
  return { start: null, end: null };
};

export const useRewardFilter: (initialDateRange?: {
  startTime: number;
  endTime: number;
}) => {
  filterState: IFilterState;
  updateFilter: (updates: Partial<IFilterState>) => void;
  resetFilter: () => void;
  isFiltered: boolean;
  setCustomDateRange: (startTime: number, endTime: number) => void;
  clearCustomDateRange: () => void;
  datePickerValue: IDateRange;
} = (initialDateRange) => {
  const [filterState, setFilterState] = useState<IFilterState>({
    timeRange: initialDateRange
      ? EExportTimeRange.Custom
      : EExportTimeRange.All,
    inviteCode: undefined,
    startTime: initialDateRange?.startTime,
    endTime: initialDateRange?.endTime,
  });

  const updateFilter = useCallback((updates: Partial<IFilterState>) => {
    setFilterState((prev) => {
      // If selecting a preset time range, clear custom date range
      if (updates.timeRange && updates.timeRange !== EExportTimeRange.Custom) {
        return {
          ...prev,
          ...updates,
          startTime: undefined,
          endTime: undefined,
        };
      }
      return {
        ...prev,
        ...updates,
      };
    });
  }, []);

  const setCustomDateRange = useCallback(
    (startTime: number, endTime: number) => {
      setFilterState((prev) => ({
        ...prev,
        timeRange: EExportTimeRange.Custom,
        startTime,
        endTime,
      }));
    },
    [],
  );

  const clearCustomDateRange = useCallback(() => {
    setFilterState((prev) => ({
      ...prev,
      timeRange: EExportTimeRange.All,
      startTime: undefined,
      endTime: undefined,
    }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState({
      timeRange: EExportTimeRange.All,
      inviteCode: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  }, []);

  const isFiltered = useMemo(() => {
    return (
      filterState.timeRange !== EExportTimeRange.All ||
      filterState.inviteCode !== undefined ||
      filterState.startTime !== undefined ||
      filterState.endTime !== undefined
    );
  }, [filterState]);

  const datePickerValue = useMemo(
    () => getDatePickerValue(filterState),
    [filterState],
  );

  return {
    filterState,
    updateFilter,
    resetFilter,
    isFiltered,
    setCustomDateRange,
    clearCustomDateRange,
    datePickerValue,
  };
};
