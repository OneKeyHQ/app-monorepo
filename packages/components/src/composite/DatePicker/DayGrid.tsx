import { useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack, YStack } from '../../primitives';

import { DayCell } from './DayCell';
import { callOnClick } from './utils';

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
        {cal.days.map((day) => {
          const dateStr = day.$date.toString();
          return (
            <DayCell
              key={dateStr}
              hideOutOfMonth={hideOutOfMonth}
              fullWidth={fullWidth}
              day={{
                day: day.$date.getDate().toString(),
                date: dateStr,
                active: day.now,
                inCurrentMonth: day.inCurrentMonth,
                selected: day.selected,
                disabled: dayButton(day).disabled || false,
                range: day.range || undefined,
              }}
              onPress={() => callOnClick(dayButton(day))}
            />
          );
        })}
      </Stack>
    </YStack>
  );
}
