import { memo, useCallback, useMemo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText, Stack, YStack } from '../../primitives';

import { DayCell } from './DayCell';
import { callOnClick, useLatestRef } from './utils';

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
    capLeft,
    capRight,
    onPress,
    onHoverIn,
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
    capLeft: boolean;
    capRight: boolean;
    onPress: (date: string) => void;
    onHoverIn?: (date: string) => void;
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
        capLeft={capLeft}
        capRight={capRight}
        day={day}
        onPress={onPress}
        onHoverIn={onHoverIn}
      />
    );
  },
);

DayCellWrapper.displayName = 'DayCellWrapper';

const HOVER_PREVIEW_ENABLED = !platformEnv.isNative;

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

  // Latest-value ref keeps the handlers' identity stable across rehookify
  // context updates (rehookify recreates cal/dayButton every render), so the
  // memoized day cells can bail out on unchanged primitive props.
  const latest = useLatestRef({ cal, dayButton });

  const getDayButton = useCallback(
    (dateStr: string) => {
      const { cal: current, dayButton: getButton } = latest.current;
      const matchedDay = current?.days.find(
        (d) => d.$date.toString() === dateStr,
      );
      return matchedDay ? getButton(matchedDay) : undefined;
    },
    [latest],
  );

  const handleDayPress = useCallback(
    (dateStr: string) => {
      const getter = getDayButton(dateStr);
      if (getter) callOnClick(getter);
    },
    [getDayButton],
  );

  // Rehookify only exposes onMouseEnter while a range is half picked; it sets
  // the pending range end so cells render the will-be-in-range preview.
  const handleDayHoverIn = useCallback(
    (dateStr: string) => {
      const getter = getDayButton(dateStr) as
        | { onMouseEnter?: () => void }
        | undefined;
      getter?.onMouseEnter?.();
    },
    [getDayButton],
  );

  // Hovering back onto the range anchor sets rehookify's pending end to the
  // anchor itself: its strict isBetween then labels only the anchor, as
  // `will-be-range-start`, with no end anywhere. Scan every calendar (the end
  // may sit in the other panel) and render that case as a one-day range.
  const isOneDayPreview =
    calendars.some((c) =>
      c.days.some((d) => d.range === 'will-be-range-start'),
    ) &&
    !calendars.some((c) => c.days.some((d) => d.range === 'will-be-range-end'));

  if (!cal) return null;

  return (
    <Stack flexWrap="wrap" flexDirection="row" rowGap="$1">
      {cal.days.map((day, index) => {
        const dateStr = day.$date.toString();
        // The band breaks at week-row edges, and at month edges only when the
        // outside days it would continue onto are hidden.
        const capLeft =
          index % 7 === 0 ||
          (!!hideOutOfMonth && !cal.days[index - 1]?.inCurrentMonth);
        const capRight =
          index % 7 === 6 ||
          (!!hideOutOfMonth && !cal.days[index + 1]?.inCurrentMonth);
        return (
          <DayCellWrapper
            key={dateStr}
            dateStr={dateStr}
            dayLabel={day.$date.getDate().toString()}
            active={day.now}
            inCurrentMonth={day.inCurrentMonth}
            selected={day.selected}
            disabled={day.disabled}
            range={
              isOneDayPreview && day.range === 'will-be-range-start'
                ? 'range-start range-end'
                : day.range || undefined
            }
            hideOutOfMonth={hideOutOfMonth}
            fullWidth={fullWidth}
            capLeft={capLeft}
            capRight={capRight}
            onPress={handleDayPress}
            onHoverIn={HOVER_PREVIEW_ENABLED ? handleDayHoverIn : undefined}
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
