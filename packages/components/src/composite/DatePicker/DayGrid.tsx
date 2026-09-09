import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack, YStack } from '../../primitives';

import { DayCell } from './DayCell';
import { callOnClick } from './utils';

import type { IDayCellProps } from './type';

const DayCellWrapper = memo(
  ({
    dateStr,
    dayLabel,
    active,
    inCurrentMonth,
    selected,
    disabled,
    range,
    hideOutOfMonth,
    fullWidth,
    onPress,
  }: {
    dateStr: string;
    dayLabel: string;
    active: boolean;
    inCurrentMonth: boolean;
    selected: boolean;
    disabled: boolean;
    range?: IDayCellProps['day']['range'];
    hideOutOfMonth?: boolean;
    fullWidth?: boolean;
    onPress: (date: string) => void;
  }) => {
    const day = useMemo(
      () => ({
        day: dayLabel,
        date: dateStr,
        active,
        inCurrentMonth,
        selected,
        disabled,
        range,
      }),
      [dayLabel, dateStr, active, inCurrentMonth, selected, disabled, range],
    );

    return (
      <DayCell
        hideOutOfMonth={hideOutOfMonth}
        fullWidth={fullWidth}
        day={day}
        onPress={onPress}
      />
    );
  },
);

DayCellWrapper.displayName = 'DayCellWrapper';

export function WeekdayRow() {
  const { data } = useDatePickerContext();
  const { weekDays } = data;

  return (
    <Stack flexDirection="row" flexWrap="wrap" marginBottom="$1">
      {weekDays.map((day) => (
        <Stack
          key={day}
          flexBasis="14.28%"
          flexGrow={0}
          flexShrink={0}
          height="$8"
          alignItems="center"
          justifyContent="center"
        >
          <SizableText size="$bodySm" color="$textSubdued" userSelect="none">
            {day}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}

export function MonthDaysGrid({
  calendarIndex,
  hideOutOfMonth,
  fullWidth,
}: {
  calendarIndex: number;
  hideOutOfMonth?: boolean;
  fullWidth?: boolean;
}) {
  const { data, propGetters } = useDatePickerContext();
  const { calendars } = data;
  const { dayButton } = propGetters;
  const cal = calendars[calendarIndex];

  // Latest-value refs keep handleDayPress identity stable across rehookify
  // context updates (rehookify recreates cal/dayButton every render), so the
  // memoized day cells can bail out on unchanged primitive props.
  const calRef = useRef(cal);
  const dayButtonRef = useRef(dayButton);
  // Commit-time-only updates: render-time writes could leak values from an
  // abandoned concurrent render into a press that lands on the old committed UI.
  useLayoutEffect(() => {
    calRef.current = cal;
    dayButtonRef.current = dayButton;
  });

  const handleDayPress = useCallback((dateStr: string) => {
    const matchedDay = calRef.current?.days.find(
      (d) => d.$date.toString() === dateStr,
    );
    if (matchedDay) {
      callOnClick(dayButtonRef.current(matchedDay));
    }
  }, []);

  if (!cal) return null;

  return (
    <Stack flexWrap="wrap" flexDirection="row" rowGap="$1">
      {cal.days.map((day) => {
        const dateStr = day.$date.toString();
        return (
          <DayCellWrapper
            key={dateStr}
            dateStr={dateStr}
            dayLabel={day.$date.getDate().toString()}
            active={day.now}
            inCurrentMonth={day.inCurrentMonth}
            selected={day.selected}
            disabled={day.disabled}
            range={day.range || undefined}
            hideOutOfMonth={hideOutOfMonth}
            fullWidth={fullWidth}
            onPress={handleDayPress}
          />
        );
      })}
    </Stack>
  );
}

export function DayGrid({
  calendarIndex,
  hideOutOfMonth,
  fullWidth,
}: {
  calendarIndex: number;
  hideOutOfMonth?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <YStack>
      <WeekdayRow />
      <MonthDaysGrid
        calendarIndex={calendarIndex}
        hideOutOfMonth={hideOutOfMonth}
        fullWidth={fullWidth}
      />
    </YStack>
  );
}
