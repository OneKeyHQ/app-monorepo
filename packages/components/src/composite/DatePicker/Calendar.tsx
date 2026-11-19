import { memo, useCallback } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { useMedia } from '../../hooks';
import { Stack, YStack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { CalendarPanel } from './CalendarPanel';
import { MonthGrid } from './MonthGrid';
import {
  callOnClick,
  getCalendarMonthPosition,
  getNavBounds,
  useLatestRef,
} from './utils';
import { YearGrid, YearRangeHeader } from './YearGrid';

import type { DatePickerMode } from './type';

interface ICalendarProps {
  mode?: DatePickerMode;
  onYearSelect?: (year: number) => void;
  onMonthSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  showPreviousMonth?: boolean;
}

export const Calendar = memo(
  ({
    mode = 'date',
    onYearSelect,
    onMonthSelect,
    minDate,
    maxDate,
    showPreviousMonth,
  }: ICalendarProps) => {
    const { data, propGetters } = useDatePickerContext();
    const { calendars } = data;
    const latest = useLatestRef(propGetters);
    const media = useMedia();
    const { year } = calendars[0];

    const handlePrevYear = useCallback(
      () => callOnClick(latest.current.subtractOffset({ years: 1 })),
      [latest],
    );

    const handleNextYear = useCallback(
      () => callOnClick(latest.current.addOffset({ years: 1 })),
      [latest],
    );

    if (mode === 'month') {
      const { isPrevYearDisabled, isNextYearDisabled } = getNavBounds(
        getCalendarMonthPosition(calendars[0]),
        minDate,
        maxDate,
      );
      return (
        <YStack>
          <CalendarHeader
            month=""
            year={year}
            onPrevMonth={handlePrevYear}
            onNextMonth={handleNextYear}
            isPrevDisabled={isPrevYearDisabled}
            isNextDisabled={isNextYearDisabled}
            mode={mode}
          />
          <MonthGrid onMonthSelect={onMonthSelect} highlight="selected" />
        </YStack>
      );
    }

    if (mode === 'year') {
      return (
        <YStack>
          <YearRangeHeader />
          <YearGrid onYearSelect={onYearSelect} highlight="selected" />
        </YStack>
      );
    }

    const isDualPanelRange =
      mode === 'range' && calendars.length === 2 && media.gtMd;
    const panelProps = { mode, onYearSelect, onMonthSelect, minDate, maxDate };

    if (isDualPanelRange) {
      // When showPreviousMonth is true, offsets=[-1] generates:
      //   calendars[0]=current month, calendars[1]=previous month
      // Swap panel order so left=previous month, right=current month
      const leftIndex = showPreviousMonth ? 1 : 0;
      const rightIndex = showPreviousMonth ? 0 : 1;

      return (
        <Stack flexDirection="row" gap="$4">
          <CalendarPanel
            calendarIndex={leftIndex}
            showNav="prev"
            isDualPanel
            {...panelProps}
          />
          <Stack width={1} bg="$borderSubdued" alignSelf="stretch" />
          <CalendarPanel
            calendarIndex={rightIndex}
            showNav="next"
            isDualPanel
            {...panelProps}
          />
        </Stack>
      );
    }

    return <CalendarPanel calendarIndex={0} showNav="both" {...panelProps} />;
  },
);

Calendar.displayName = 'Calendar';
