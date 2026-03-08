import { memo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { useMedia } from '../../hooks';
import { Stack, YStack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { CalendarPanel } from './CalendarPanel';
import { MonthGrid } from './MonthGrid';
import { callOnClick } from './utils';
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
    const { addOffset, subtractOffset } = propGetters;
    const media = useMedia();
    const { month, year } = calendars[0];

    if (mode === 'month') {
      return (
        <YStack>
          <CalendarHeader
            month={month}
            year={year}
            onPrevMonth={() => callOnClick(subtractOffset({ years: 1 }))}
            onNextMonth={() => callOnClick(addOffset({ years: 1 }))}
            mode={mode}
          />
          <MonthGrid onMonthSelect={onMonthSelect} />
        </YStack>
      );
    }

    if (mode === 'year') {
      return (
        <YStack>
          <YearRangeHeader />
          <YearGrid onYearSelect={onYearSelect} />
        </YStack>
      );
    }

    const isDualPanelRange =
      mode === 'range' && calendars.length > 1 && media.gtMd;
    const panelProps = { mode, onYearSelect, onMonthSelect, minDate, maxDate };

    if (isDualPanelRange) {
      // When showPreviousMonth is true, offsets=[-1] generates:
      //   calendars[0]=current month, calendars[1]=previous month
      // Swap panel order so left=previous month, right=current month
      const leftIndex = showPreviousMonth ? 1 : 0;
      const rightIndex = showPreviousMonth ? 0 : 1;

      return (
        <Stack flexDirection="row" gap="$6">
          <CalendarPanel
            calendarIndex={leftIndex}
            showNav="prev"
            isDualPanel
            {...panelProps}
          />
          <Stack width={1} bg="$neutral3" alignSelf="stretch" />
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
