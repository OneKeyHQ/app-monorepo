import { ButtonFrame, SizableText, Stack, YStack } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EIntervalSelect } from '@onekeyhq/shared/src/logger/scopes/dex/types';

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
  const handleIntervalChange = (intervalValue: string) => {
    // Map interval values to EIntervalSelect enum values
    let intervalSelect: EIntervalSelect = EIntervalSelect.OneHour; // default

    switch (intervalValue) {
      case '1h':
        intervalSelect = EIntervalSelect.OneHour;
        break;
      case '4h':
        intervalSelect = EIntervalSelect.FourHour;
        break;
      case '8h':
        intervalSelect = EIntervalSelect.EightHour;
        break;
      case '24h':
        intervalSelect = EIntervalSelect.TwentyFourHour;
        break;
      default:
        intervalSelect = EIntervalSelect.OneHour;
    }

    // Add DEX interval tracking
    defaultLogger.dex.chart.dexInterval({ intervalSelect });

    // Call original onChange
    onChange(intervalValue);
  };

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
          onPress={() => handleIntervalChange(opt.value)}
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
