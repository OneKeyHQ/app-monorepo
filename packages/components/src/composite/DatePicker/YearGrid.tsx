import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { Stack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { CalendarHeader } from './CalendarHeader';
import { PeriodCell } from './PeriodCell';
import { getSlideEnterStyle, useSlideDirection } from './useSlideDirection';
import { callOnClick, getCalendarYear } from './utils';

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
  const { yearButton } = propGetters;
  const shownYear = getCalendarYear(calendars[0]);

  const yearsRef = useRef(years);
  const yearButtonRef = useRef(yearButton);
  useLayoutEffect(() => {
    yearsRef.current = years;
    yearButtonRef.current = yearButton;
  });

  const handleYearPress = useCallback(
    (date: Date) => {
      const y = yearsRef.current.find(
        (item) => item.$date.getTime() === date.getTime(),
      );
      const getter = y ? yearButtonRef.current(y) : undefined;
      if (!y || !getter?.onClick) return;
      callOnClick(getter);
      onYearSelect?.(y.year);
      onSelect?.();
    },
    [onYearSelect, onSelect],
  );

  const firstYear = years[0]?.year ?? 0;
  const direction = useSlideDirection(firstYear);

  return (
    <Stack
      key={firstYear}
      flexWrap="wrap"
      flexDirection="row"
      gap="$2"
      padding="$2"
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      enterStyle={getSlideEnterStyle(direction)}
    >
      {years.map((y) => (
        <PeriodCell
          key={y.$date.toString()}
          value={y.$date}
          label={y.year}
          selected={
            highlight === 'selected' ? y.selected : y.year === shownYear
          }
          isNow={y.now}
          disabled={y.disabled}
          onPress={handleYearPress}
        />
      ))}
    </Stack>
  );
}

export function YearRangeHeader() {
  const { data, propGetters } = useDatePickerContext();
  const { years } = data;
  const { previousYearsButton, nextYearsButton } = propGetters;

  const yearRange = useMemo(
    () => `${years[0].year} - ${years[years.length - 1].year}`,
    [years],
  );

  const prevGetter = previousYearsButton();
  const nextGetter = nextYearsButton();

  const handlePrevYears = useCallback(
    () => callOnClick(previousYearsButton()),
    [previousYearsButton],
  );

  const handleNextYears = useCallback(
    () => callOnClick(nextYearsButton()),
    [nextYearsButton],
  );

  return (
    <CalendarHeader
      month=""
      year={yearRange}
      onPrevMonth={handlePrevYears}
      onNextMonth={handleNextYears}
      isPrevDisabled={!!prevGetter.disabled}
      isNextDisabled={!!nextGetter.disabled}
      mode="year"
    />
  );
}
