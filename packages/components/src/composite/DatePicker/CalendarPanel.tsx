import { useCallback, useMemo, useState } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { YStack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { DayGrid } from './DayGrid';
import { MonthGrid } from './MonthGrid';
import { callOnClick } from './utils';
import { YearGrid, YearRangeHeader } from './YearGrid';

import type { DatePickerMode } from './type';

type IViewMode = 'day' | 'month' | 'year';

function useNavDisabled(calendarIndex: number, minDate?: Date, maxDate?: Date) {
  const { data } = useDatePickerContext();
  const { calendars } = data;
  const cal = calendars[calendarIndex];

  return useMemo(() => {
    if (!cal)
      return {
        isPrevDisabled: false,
        isNextDisabled: false,
        isPrevYearDisabled: false,
        isNextYearDisabled: false,
      };

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

    const isPrevYearDisabled = minDate
      ? calYear <= minDate.getFullYear()
      : false;

    const isNextYearDisabled = maxDate
      ? calYear >= maxDate.getFullYear()
      : false;

    return {
      isPrevDisabled,
      isNextDisabled,
      isPrevYearDisabled,
      isNextYearDisabled,
    };
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

  const [viewMode, setViewMode] = useState<IViewMode>('day');

  const {
    isPrevDisabled,
    isNextDisabled,
    isPrevYearDisabled,
    isNextYearDisabled,
  } = useNavDisabled(calendarIndex, minDate, maxDate);

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

  const handlePrevYear = useCallback(() => {
    callOnClick(subtractOffset({ years: 1 }));
  }, [subtractOffset]);

  const handleNextYear = useCallback(() => {
    callOnClick(addOffset({ years: 1 }));
  }, [addOffset]);

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
          onPrevYear={
            showPrevNav && viewMode === 'day' ? handlePrevYear : undefined
          }
          onNextYear={
            showNextNav && viewMode === 'day' ? handleNextYear : undefined
          }
          isPrevDisabled={showPrevNav ? isPrevDisabled : undefined}
          isNextDisabled={showNextNav ? isNextDisabled : undefined}
          isPrevYearDisabled={showPrevNav ? isPrevYearDisabled : undefined}
          isNextYearDisabled={showNextNav ? isNextYearDisabled : undefined}
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

      {viewMode === 'day' ? (
        <DayGrid
          calendarIndex={calendarIndex}
          hideOutOfMonth={false}
          fullWidth={mode === 'range'}
        />
      ) : null}
      {viewMode === 'month' ? (
        <MonthGrid
          onSelect={() => setViewMode('day')}
          onMonthSelect={onMonthSelect}
        />
      ) : null}
      {viewMode === 'year' ? (
        <YearGrid
          onSelect={() => setViewMode('month')}
          onYearSelect={onYearSelect}
        />
      ) : null}
    </YStack>
  );
}
