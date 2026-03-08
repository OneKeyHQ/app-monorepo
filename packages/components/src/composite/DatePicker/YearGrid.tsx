import { useMemo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { callOnClick } from './utils';

export function YearGrid({
  onSelect,
  onYearSelect,
}: {
  onSelect?: () => void;
  onYearSelect?: (year: number) => void;
}) {
  const { data, propGetters } = useDatePickerContext();
  const { years, calendars } = data;
  const { yearButton } = propGetters;
  const selectedYear = calendars[0].year;

  return (
    <Stack flexWrap="wrap" flexDirection="row" gap="$2" padding="$2">
      {years.map((y) => {
        const isActive = y.year === Number(selectedYear);
        return (
          <Stack
            key={y.$date.toString()}
            flexBasis="31%"
            flexGrow={1}
            height="$11"
            alignItems="center"
            justifyContent="center"
            borderRadius="$2"
            bg={isActive ? '$bgPrimary' : 'transparent'}
            hoverStyle={{
              bg: isActive ? '$bgPrimary' : '$bgHover',
            }}
            onPress={() => {
              callOnClick(yearButton(y));
              onYearSelect?.(y.year);
              onSelect?.();
            }}
          >
            <SizableText
              size="$bodyMd"
              color={isActive ? '$textInverse' : '$text'}
              userSelect="none"
            >
              {y.year}
            </SizableText>
          </Stack>
        );
      })}
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

  return (
    <CalendarHeader
      month=""
      year={yearRange}
      onPrevMonth={() => callOnClick(previousYearsButton())}
      onNextMonth={() => callOnClick(nextYearsButton())}
      mode="year"
    />
  );
}
