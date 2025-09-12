/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';

import { validatePriceInput } from '../../utils/tokenUtils';

interface IPriceInputProps {
  value: string;
  onChange: (value: string) => void;
  marketPrice?: string;
  error?: string;
  disabled?: boolean;
  onUseMarketPrice?: () => void;
  szDecimals?: number;
}

export const PriceInput = memo<IPriceInputProps>(
  ({
    value,
    onChange,
    error,
    disabled = false,
    onUseMarketPrice,
    szDecimals,
  }) => {
    const handleInputChange = useCallback(
      (text: string) => {
        const processedText = text.replace(/。/g, '.');
        const isValid = validatePriceInput(processedText, szDecimals);
        if (!isValid) {
          return;
        }
        onChange(processedText);
      },
      [onChange, szDecimals],
    );

    return (
      <YStack flex={1}>
        <Input
          flex={1}
          size="medium"
          value={value}
          onChangeText={handleInputChange}
          placeholder="0.0"
          keyboardType="decimal-pad"
          disabled={disabled}
          borderColor="transparent"
          backgroundColor="transparent"
          borderWidth="$0"
          containerProps={{
            flex: 1,
            borderWidth: 0,
            bg: 'transparent',
            p: 0,
          }}
          InputComponentStyle={{
            p: 0,
            bg: 'transparent',
          }}
          addOns={[
            {
              renderContent: (
                <XStack
                  alignItems="center"
                  gap="$1"
                  flex={1}
                  cursor="pointer"
                  onPress={onUseMarketPrice}
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    Mid
                  </SizableText>
                </XStack>
              ),
            },
          ]}
        />
        {error ? (
          <SizableText size="$bodySm" color="$red10" mt="$1">
            {error}
          </SizableText>
        ) : null}
      </YStack>
    );
  },
);

PriceInput.displayName = 'PriceInput';
