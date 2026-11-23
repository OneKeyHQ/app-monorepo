import { memo } from 'react';

import { Icon, SizableText, Stack } from '@onekeyhq/components';

export type IPerpsAmountKeypadKeyProps = {
  value: string;
  label: string;
  compact: boolean;
  disabled: boolean;
  onPress: (value: string) => void;
  onClear: () => void;
};

export const PerpsAmountKeypadKey = memo(function PerpsAmountKeypadKey({
  value,
  label,
  compact,
  disabled,
  onPress,
  onClear,
}: IPerpsAmountKeypadKeyProps) {
  return (
    <Stack
      testID={`perps-amount-key-${value === '.' ? 'decimal' : value}`}
      flex={1}
      height={compact ? 48 : 64}
      p="$1"
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={() => onPress(value)}
      onLongPress={value === 'backspace' ? onClear : undefined}
    >
      <Stack
        flex={1}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2.5"
        pointerEvents="none"
      >
        {value === 'backspace' ? (
          <Icon name="XBackspaceOutline" size="$5" color="$iconSubdued" />
        ) : (
          <SizableText
            size={compact ? '$headingXl' : '$heading2xl'}
            fontWeight="400"
          >
            {value}
          </SizableText>
        )}
      </Stack>
    </Stack>
  );
});
