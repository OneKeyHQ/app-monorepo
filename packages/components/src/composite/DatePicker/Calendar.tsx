import { useDatePickerContext } from '@rehookify/datepicker';
import { memo } from 'react';

import { useMedia } from '../../hooks';
import { Stack, YStack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { CalendarPanel } from './CalendarPanel';
import { MonthGrid } from './MonthGrid';
import { YearGrid, YearRangeHeader } from './YearGrid';
import { callOnClick } from './utils';

import type { DatePickerMode } from './type';

interface ICalendarProps {
  mode?: DatePickerMode;
  onYearSelect?: (year: number) => void;
  onMonthSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const Calendar = memo(
  ({
    mode = 'date',
    onYearSelect,
    onMonthSelect,
    minDate,
    maxDate,
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
      return (
        <Stack flexDirection="row" gap="$6">
          <CalendarPanel
            calendarIndex={0}
            showNav="prev"
            isDualPanel
            {...panelProps}
          />
          <Stack width={1} bg="$neutral3" alignSelf="stretch" />
          <CalendarPanel
            calendarIndex={1}
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
