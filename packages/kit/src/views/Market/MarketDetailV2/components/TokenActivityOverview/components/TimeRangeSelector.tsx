import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';

import type { ITimeRangeSelectorProps } from '../types';

export function TimeRangeSelector({
  options,
  value,
  onChange,
}: ITimeRangeSelectorProps) {
  return (
    <Stack
      flexDirection="row"
      justifyContent="space-between"
      gap="$1"
      bg="$neutral5"
      p="$1"
      borderRadius="$2.5"
    >
      {options.map((opt) => (
        <Button
          key={opt.value}
          flex={1}
          variant={value === opt.value ? 'primary' : 'secondary'}
          onPress={() => onChange(opt.value)}
          size="medium"
          borderRadius="$2"
          p="$3"
        >
          <YStack alignItems="center" gap="$1">
            <SizableText
              size="$bodyMd"
              color={value === opt.value ? '$textOnPrimary' : '$textSubdued'}
              fontWeight="500"
            >
              {opt.label}
            </SizableText>
            <SizableText
              size="$bodySm"
              color={opt.isPositive ? '$textSuccess' : '$textCritical'}
            >
              {opt.percentageChange}
            </SizableText>
          </YStack>
        </Button>
      ))}
    </Stack>
  );
}
