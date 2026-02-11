import { useDatePickerContext } from '@rehookify/datepicker';
import { useCallback, useMemo, useState } from 'react';

import { YStack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { DayGrid } from './DayGrid';
import { MonthGrid } from './MonthGrid';
import { YearGrid, YearRangeHeader } from './YearGrid';
import { callOnClick } from './utils';

import type { DatePickerMode } from './type';

type ViewMode = 'day' | 'month' | 'year';

function useNavDisabled(calendarIndex: number, minDate?: Date, maxDate?: Date) {
  const { data } = useDatePickerContext();
  const { calendars } = data;
  const cal = calendars[calendarIndex];

  return useMemo(() => {
    if (!cal) return { isPrevDisabled: false, isNextDisabled: false };

    const currentMonthDay = cal.days.find((d) => d.inCurrentMonth);
    const calYear = currentMonthDay
      ? currentMonthDay.$date.getFullYear()
      : Number(cal.year);
    const calMonth = currentMonthDay ? currentMonthDay.$date.getMonth() : 0;

    const isPrevDisabled = minDate
      ? calYear < minDate.getFullYear() ||
        (calYear === minDate.getFullYear() && calMonth <= minDate.getMonth())
      : false;

    const isNextDisabled = maxDate
      ? calYear > maxDate.getFullYear() ||
        (calYear === maxDate.getFullYear() && calMonth >= maxDate.getMonth())
      : false;

    return { isPrevDisabled, isNextDisabled };
  }, [cal, minDate, maxDate]);
}

export function CalendarPanel({
  calendarIndex,
  showNav,
  mode,
  onYearSelect,
  onMonthSelect,
  minDate,
  maxDate,
  isDualPanel,
}: {
  calendarIndex: number;
  showNav: 'both' | 'prev' | 'next' | 'none';
  mode: DatePickerMode;
  onYearSelect?: (year: number) => void;
  onMonthSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  isDualPanel?: boolean;
}) {
  const { data, propGetters } = useDatePickerContext();
  const { calendars } = data;
  const { addOffset, subtractOffset } = propGetters;
  const cal = calendars[calendarIndex];

  const isRangeDualPanel = mode === 'range' && isDualPanel;

  const [viewMode, setViewMode] = useState<ViewMode>('day');

  const { isPrevDisabled, isNextDisabled } = useNavDisabled(
    calendarIndex,
    minDate,
    maxDate,
  );

  const getOffset = useCallback(
    () => (viewMode === 'day' ? { months: 1 } : { years: 1 }),
    [viewMode],
  );

  const handlePrevMonth = useCallback(() => {
    callOnClick(subtractOffset(getOffset()));
  }, [getOffset, subtractOffset]);

  const handleNextMonth = useCallback(() => {
    callOnClick(addOffset(getOffset()));
  }, [getOffset, addOffset]);

  if (!cal) return null;

  const showPrevNav = showNav === 'both' || showNav === 'prev';
  const showNextNav = showNav === 'both' || showNav === 'next';

  return (
    <YStack {...(isDualPanel ? { flex: 1, flexBasis: 0 } : {})}>
      {viewMode === 'year' ? (
        <YearRangeHeader />
      ) : (
        <CalendarHeader
          month={viewMode === 'day' ? cal.month : ''}
          year={cal.year}
          onPrevMonth={showPrevNav ? handlePrevMonth : undefined}
          onNextMonth={showNextNav ? handleNextMonth : undefined}
          isPrevDisabled={showPrevNav && isPrevDisabled}
          isNextDisabled={showNextNav && isNextDisabled}
          onMonthClick={
            viewMode === 'day' && !isRangeDualPanel
              ? () => setViewMode('month')
              : undefined
          }
          onYearClick={
            !isRangeDualPanel ? () => setViewMode('year') : undefined
          }
          mode={mode}
        />
      )}

      {viewMode === 'day' && (
        <DayGrid
          calendarIndex={calendarIndex}
          hideOutOfMonth={false}
          fullWidth={mode === 'range'}
        />
      )}
      {viewMode === 'month' && (
        <MonthGrid
          onSelect={() => setViewMode('day')}
          onMonthSelect={onMonthSelect}
        />
      )}
      {viewMode === 'year' && (
        <YearGrid
          onSelect={() => setViewMode('month')}
          onYearSelect={onYearSelect}
        />
      )}
    </YStack>
  );
}
