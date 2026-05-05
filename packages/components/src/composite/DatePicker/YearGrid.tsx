import { memo, useCallback, useMemo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack } from '../../primitives';

import { CalendarHeader } from './CalendarHeader';
import { callOnClick } from './utils';

const activeHoverStyle = { bg: '$bgPrimary' } as const;
const inactiveHoverStyle = { bg: '$bgHover' } as const;

const YearCell = memo(
  ({
    year,
    isActive,
    onPress,
  }: {
    year: { $date: Date; year: number };
    isActive: boolean;
    onPress: (y: { $date: Date; year: number }) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(year);
    }, [onPress, year]);

    return (
      <Stack
        flexBasis="31%"
        flexGrow={1}
        height="$11"
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        bg={isActive ? '$bgPrimary' : 'transparent'}
        hoverStyle={isActive ? activeHoverStyle : inactiveHoverStyle}
        onPress={handlePress}
      >
        <SizableText
          size="$bodyMd"
          color={isActive ? '$textInverse' : '$text'}
          userSelect="none"
        >
          {year.year}
        </SizableText>
      </Stack>
    );
  },
);

YearCell.displayName = 'YearCell';

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

  const handleYearPress = useCallback(
    (y: { $date: Date; year: number }) => {
      callOnClick(yearButton(y as any));
      onYearSelect?.(y.year);
      onSelect?.();
    },
    [yearButton, onYearSelect, onSelect],
  );

  return (
    <Stack flexWrap="wrap" flexDirection="row" gap="$2" padding="$2">
      {years.map((y) => {
        const isActive = y.year === Number(selectedYear);
        return (
          <YearCell
            key={y.$date.toString()}
            year={y}
            isActive={isActive}
            onPress={handleYearPress}
          />
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

  const handlePrevYears = useCallback(
    () => callOnClick(previousYearsButton()),
    [previousYearsButton],
  );

  const handleNextYears = useCallback(
    () => callOnClick(nextYearsButton()),
    [nextYearsButton],
  );

  return (
    <CalendarHeader
      month=""
      year={yearRange}
      onPrevMonth={handlePrevYears}
      onNextMonth={handleNextYears}
      mode="year"
    />
  );
}
