import { useCallback, useMemo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { CalendarHeader } from './CalendarHeader';
import { PeriodGrid } from './PeriodGrid';
import { callOnClick, getCalendarYear, useLatestRef } from './utils';

import type { IPeriodGridItem } from './PeriodGrid';

export function YearGrid({
  onSelect,
  onYearSelect,
  highlight = 'active',
}: {
  onSelect?: () => void;
  onYearSelect?: (year: number) => void;
  /**
   * `active`: the year the calendar is showing (drill-down navigation).
   * `selected`: the year holding the picked value (standalone year picker).
   */
  highlight?: 'active' | 'selected';
}) {
  const { data, propGetters } = useDatePickerContext();
  const { years, calendars } = data;
  const shownYear = getCalendarYear(calendars[0]);
  const latest = useLatestRef({ years, yearButton: propGetters.yearButton });

  const handlePress = useCallback(
    (value: number) => {
      const { years: list, yearButton } = latest.current;
      const y = list.find((item) => item.$date.getTime() === value);
      const getter = y ? yearButton(y) : undefined;
      if (!y || !getter?.onClick) return;
      callOnClick(getter);
      onYearSelect?.(y.year);
      onSelect?.();
    },
    [latest, onYearSelect, onSelect],
  );

  const items = useMemo<IPeriodGridItem[]>(
    () =>
      years.map((y) => ({
        value: y.$date.getTime(),
        label: y.year,
        selected: highlight === 'selected' ? y.selected : y.year === shownYear,
        isNow: y.now,
        disabled: y.disabled,
      })),
    [years, highlight, shownYear],
  );

  return (
    <PeriodGrid
      items={items}
      slidePosition={years[0]?.year ?? 0}
      onPress={handlePress}
    />
  );
}

export function YearRangeHeader() {
  const { data, propGetters } = useDatePickerContext();
  const { years } = data;
  const prevGetter = propGetters.previousYearsButton();
  const nextGetter = propGetters.nextYearsButton();
  const latest = useLatestRef({ prevGetter, nextGetter });

  // Stable handlers keep the memoized header from re-rendering on every
  // rehookify update; the decade getters' `disabled` is exact, unlike the
  // month/year offset getters (see getNavBounds).
  const handlePrevYears = useCallback(
    () => callOnClick(latest.current.prevGetter),
    [latest],
  );
  const handleNextYears = useCallback(
    () => callOnClick(latest.current.nextGetter),
    [latest],
  );

  return (
    <CalendarHeader
      month=""
      year={`${years[0].year} - ${years[years.length - 1].year}`}
      onPrevMonth={handlePrevYears}
      onNextMonth={handleNextYears}
      isPrevDisabled={!!prevGetter.disabled}
      isNextDisabled={!!nextGetter.disabled}
      mode="year"
    />
  );
}
