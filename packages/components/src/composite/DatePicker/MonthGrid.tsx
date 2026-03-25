import { memo, useCallback } from 'react';

import { type DPMonth, useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack } from '../../primitives';

import { callOnClick } from './utils';

const activeHoverStyle = { bg: '$bgPrimary' } as const;
const inactiveHoverStyle = { bg: '$bgHover' } as const;

const MonthCell = memo(
  ({
    month: m,
    onPress,
  }: {
    month: DPMonth;
    onPress: (m: DPMonth) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(m);
    }, [onPress, m]);

    return (
      <Stack
        flexBasis="31%"
        flexGrow={1}
        height="$11"
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        bg={m.active ? '$bgPrimary' : 'transparent'}
        hoverStyle={m.active ? activeHoverStyle : inactiveHoverStyle}
        onPress={handlePress}
      >
        <SizableText
          size="$bodyMd"
          color={m.active ? '$textInverse' : '$text'}
          userSelect="none"
        >
          {m.month}
        </SizableText>
      </Stack>
    );
  },
);

MonthCell.displayName = 'MonthCell';

export function MonthGrid({
  onSelect,
  onMonthSelect,
}: {
  onSelect?: () => void;
  onMonthSelect?: (date: Date) => void;
}) {
  const { data, propGetters } = useDatePickerContext();
  const { months } = data;
  const { monthButton } = propGetters;

  const handleMonthPress = useCallback(
    (m: (typeof months)[number]) => {
      callOnClick(monthButton(m));
      onMonthSelect?.(m.$date);
      onSelect?.();
    },
    [monthButton, onMonthSelect, onSelect],
  );

  return (
    <Stack flexWrap="wrap" flexDirection="row" gap="$2" padding="$2">
      {months.map((m) => (
        <MonthCell
          key={m.$date.toString()}
          month={m}
          onPress={handleMonthPress}
        />
      ))}
    </Stack>
  );
}
