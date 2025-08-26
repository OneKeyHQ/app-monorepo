import { ButtonFrame, SizableText, Stack, YStack } from '@onekeyhq/components';

import type { ITimeRangeOption, ITimeRangeSelectorProps } from '../types';

function getPercentageColor(option: ITimeRangeOption) {
  if (option.isZero) {
    return '$textSubdued';
  }
  return option.isPositive ? '$textSuccess' : '$textCritical';
}

export function TimeRangeSelector({
  options,
  value,
  onChange,
  isLoading,
}: ITimeRangeSelectorProps) {
  return (
    <Stack
      flexDirection="row"
      justifyContent="space-between"
      gap="$1"
      bg="$neutral5"
      p="$0.5"
      borderRadius="$2.5"
    >
      {options.map((opt) => (
        <ButtonFrame
          key={opt.value}
          flex={1}
          borderWidth={0}
          borderRadius="$2"
          py="$1.5"
          onPress={() => onChange(opt.value)}
          bg={value === opt.value ? '$bgApp' : '$transparent'}
          hoverStyle={{
            bg: value === opt.value ? '$bgAppHover' : '$bgHover',
          }}
          pressStyle={{
            bg: value === opt.value ? '$bgAppActive' : '$bgActive',
          }}
        >
          <YStack alignItems="center" gap="$1">
            <SizableText
              size="$bodyMd"
              color={value === opt.value ? '$text' : '$textSubdued'}
              fontWeight="500"
            >
              {opt.label}
            </SizableText>
            <SizableText
              size="$bodySm"
              color={isLoading ? '$textSubdued' : getPercentageColor(opt)}
            >
              {isLoading ? '--' : opt.percentageChange}
            </SizableText>
          </YStack>
        </ButtonFrame>
      ))}
    </Stack>
  );
}
