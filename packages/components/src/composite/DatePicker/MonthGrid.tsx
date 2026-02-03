import { useDatePickerContext } from '@rehookify/datepicker';

import { SizableText, Stack } from '../../primitives';

import { callOnClick } from './utils';

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

  return (
    <Stack flexWrap="wrap" flexDirection="row" gap="$2" padding="$2">
      {months.map((m) => (
        <Stack
          key={m.$date.toString()}
          flexBasis="31%"
          flexGrow={1}
          height="$11"
          alignItems="center"
          justifyContent="center"
          borderRadius="$2"
          bg={m.active ? '$bgPrimary' : 'transparent'}
          hoverStyle={{
            bg: m.active ? '$bgPrimary' : '$bgHover',
          }}
          onPress={() => {
            callOnClick(monthButton(m));
            onMonthSelect?.(m.$date);
            onSelect?.();
          }}
        >
          <SizableText
            size="$bodyMd"
            color={m.active ? '$textInverse' : '$text'}
            userSelect="none"
          >
            {m.month}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}
