import { useCallback, useMemo, useState } from 'react';

import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

import type { IDateRange } from '@onekeyhq/components';

import type { IFilterState } from '../components/FilterButton';

// Helper to calculate date range from preset time range
const getDateRangeFromTimeRange = (
  timeRange: EExportTimeRange,
): { startTime?: number; endTime?: number } => {
  const now = new Date();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const endTime = endOfDay.getTime();

  switch (timeRange) {
    case EExportTimeRange.OneMonth: {
      const startDate = new Date(endOfDay);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      return { startTime: startDate.getTime(), endTime };
    }
    case EExportTimeRange.ThreeMonths: {
      const startDate = new Date(endOfDay);
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      return { startTime: startDate.getTime(), endTime };
    }
    case EExportTimeRange.SixMonths: {
      const startDate = new Date(endOfDay);
      startDate.setMonth(startDate.getMonth() - 6);
      startDate.setHours(0, 0, 0, 0);
      return { startTime: startDate.getTime(), endTime };
    }
    default:
      return { startTime: undefined, endTime: undefined };
  }
};

// Helper to get IDateRange from filterState for DatePicker display
export const getDatePickerValue = (filterState: IFilterState): IDateRange => {
  if (filterState.startTime && filterState.endTime) {
    return {
      start: new Date(filterState.startTime),
      end: new Date(filterState.endTime),
    };
  }
  // Calculate from preset time range
  const { startTime, endTime } = getDateRangeFromTimeRange(
    filterState.timeRange,
  );
  if (startTime && endTime) {
    return {
      start: new Date(startTime),
      end: new Date(endTime),
    };
  }
  return { start: null, end: null };
};

export const useRewardFilter: () => {
  filterState: IFilterState;
  updateFilter: (updates: Partial<IFilterState>) => void;
  resetFilter: () => void;
  isFiltered: boolean;
  setCustomDateRange: (startTime: number, endTime: number) => void;
  clearCustomDateRange: () => void;
  datePickerValue: IDateRange;
} = () => {
  const [filterState, setFilterState] = useState<IFilterState>({
    timeRange: EExportTimeRange.All,
    inviteCode: undefined,
    startTime: undefined,
    endTime: undefined,
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
