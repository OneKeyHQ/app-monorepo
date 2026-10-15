import { memo, useCallback } from 'react';

import { SizableText, Stack } from '../../primitives';

import { TodayDot } from './TodayDot';
import { getCellStateStyles } from './utils';

/**
 * Month / year cell shared by MonthGrid and YearGrid. Same height, radius,
 * interaction states and "today" marker as DayCell so every drill-down level
 * reads as one component.
 */
export const PeriodCell = memo(
  ({
    value,
    label,
    selected,
    isNow,
    disabled,
    onPress,
  }: {
    value: number;
    label: string | number;
    selected: boolean;
    isNow: boolean;
    disabled: boolean;
    onPress: (value: number) => void;
  }) => {
    const handlePress = useCallback(() => {
      if (!disabled) onPress(value);
    }, [disabled, onPress, value]);

    const { color, ...stateStyles } = getCellStateStyles({
      disabled,
      selected,
    });

    return (
      <Stack
        flexBasis="31%"
        flexGrow={1}
        height="$10"
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        {...stateStyles}
        onPress={handlePress}
        aria-disabled={disabled}
        aria-selected={selected}
      >
        <SizableText
          size="$bodyMd"
          fontWeight={selected || isNow ? '600' : '400'}
          color={color}
          userSelect="none"
        >
          {label}
        </SizableText>
        {isNow && !selected ? <TodayDot disabled={disabled} /> : null}
      </Stack>
    );
  },
);

PeriodCell.displayName = 'PeriodCell';
