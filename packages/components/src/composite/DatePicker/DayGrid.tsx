import { memo, useCallback, useMemo } from 'react';

import { type DPDay, useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack, YStack } from '../../primitives';

import { DayCell } from './DayCell';
import { callOnClick } from './utils';

const DayCellWrapper = memo(
  ({
    dpDay,
    disabled,
    hideOutOfMonth,
    fullWidth,
    onPress,
  }: {
    dpDay: DPDay;
    disabled: boolean;
    hideOutOfMonth?: boolean;
    fullWidth?: boolean;
    onPress: (date: string) => void;
  }) => {
    const dateStr = dpDay.$date.toString();
    const day = useMemo(
      () => ({
        day: dpDay.$date.getDate().toString(),
        date: dateStr,
        active: dpDay.now,
        inCurrentMonth: dpDay.inCurrentMonth,
        selected: dpDay.selected,
        disabled,
        range: dpDay.range || undefined,
      }),
      [
        dateStr,
        dpDay.$date,
        dpDay.now,
        dpDay.inCurrentMonth,
        dpDay.selected,
        dpDay.range,
        disabled,
      ],
    );

    return (
      <DayCell
        key={dateStr}
        hideOutOfMonth={hideOutOfMonth}
        fullWidth={fullWidth}
        day={day}
        onPress={onPress}
      />
    );
  },
);

DayCellWrapper.displayName = 'DayCellWrapper';

export function DayGrid({
  calendarIndex,
  hideOutOfMonth,
  fullWidth,
}: {
  calendarIndex: number;
  hideOutOfMonth?: boolean;
  fullWidth?: boolean;
}) {
  const { data, propGetters } = useDatePickerContext();
  const { calendars, weekDays } = data;
  const { dayButton } = propGetters;
  const cal = calendars[calendarIndex];

  const handleDayPress = useCallback(
    (dateStr: string) => {
      const matchedDay = cal?.days.find((d) => d.$date.toString() === dateStr);
      if (matchedDay) {
        callOnClick(dayButton(matchedDay));
      }
    },
    [cal, dayButton],
  );

  if (!cal) return null;

  return (
    <YStack>
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
      <Stack flexWrap="wrap" flexDirection="row" rowGap="$1">
        {cal.days.map((day) => (
          <DayCellWrapper
            key={day.$date.toString()}
            dpDay={day}
            disabled={dayButton(day).disabled || false}
            hideOutOfMonth={hideOutOfMonth}
            fullWidth={fullWidth}
            onPress={handleDayPress}
          />
        ))}
      </Stack>
    </YStack>
  );
}
