import { useCallback, useMemo } from 'react';

import {
  Icon,
  Popover,
  Radio,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

export interface ISizeInputModeSelectorProps {
  value: 'token' | 'usd' | 'margin';
  onChange: (value: 'token' | 'usd' | 'margin') => void;
  tokenSymbol: string;
}

export function SizeInputModeSelector({
  value,
  onChange,
  tokenSymbol,
}: ISizeInputModeSelectorProps) {
  const radioValue = value === 'margin' ? 'cost' : 'amount';

  const handleRadioChange = useCallback(
    (nextValue: string) => {
      if (nextValue === 'amount') {
        // Default to token when switching back from margin mode, unless it was already token/usd
        if (value === 'margin') {
          onChange('token');
        }
      } else if (nextValue === 'cost') {
        onChange('margin');
      }
    },
    [onChange, value],
  );

  const handleUnitChange = useCallback(
    (unit: 'token' | 'usd') => {
      if (value !== unit) {
        onChange(unit);
      }
    },
    [onChange, value],
  );

  const unitButtons = useMemo(
    () => (
      <XStack
        bg="$bgSubdued"
        p="$0.5"
        borderRadius="$2"
        gap="$1"
        alignSelf="flex-start"
      >
        <XStack
          px="$2"
          py="$1"
          borderRadius="$2"
          bg={value === 'usd' ? '$bgActive' : 'transparent'}
          cursor="pointer"
          onPress={() => handleUnitChange('usd')}
          hoverStyle={{
            bg: value === 'usd' ? '$bgActive' : '$bgHover',
          }}
        >
          <SizableText
            size="$bodySmMedium"
            color={value === 'usd' ? '$text' : '$textSubdued'}
          >
            USDC
          </SizableText>
        </XStack>
        <XStack
          px="$2"
          py="$1"
          borderRadius="$2"
          bg={value === 'token' ? '$bgActive' : 'transparent'}
          cursor="pointer"
          onPress={() => handleUnitChange('token')}
          hoverStyle={{
            bg: value === 'token' ? '$bgActive' : '$bgHover',
          }}
        >
          <SizableText
            size="$bodySmMedium"
            color={value === 'token' ? '$text' : '$textSubdued'}
          >
            {tokenSymbol || 'Token'}
          </SizableText>
        </XStack>
      </XStack>
    ),
    [handleUnitChange, tokenSymbol, value],
  );

  const radioOptions = useMemo(
    () => [
      {
        label: 'By amount',
        value: 'amount',
        description:
          'Place an order by amount. Cost will change accordingly when you adjust the leverage.',
        children: unitButtons,
      },
      {
        label: 'By cost (USD)',
        value: 'cost',
        description:
          "Place an order by cost. Cost won't change when you adjust the leverage.",
      },
    ],
    [unitButtons],
  );

  const trigger = (
    <XStack alignItems="center" gap="$1" cursor="pointer" userSelect="none">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {value === 'token' ? tokenSymbol || 'Token' : 'USDC'}
      </SizableText>
      <Icon
        name="ChevronTriangleDownSmallOutline"
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );

  return (
    <Popover
      title="Select Input Mode"
      placement="bottom-end"
      renderTrigger={trigger}
      renderContent={
        <YStack width={320} p="$4">
          <Radio
            value={radioValue}
            onChange={handleRadioChange}
            options={radioOptions}
          />
        </YStack>
      }
    />
  );
}
