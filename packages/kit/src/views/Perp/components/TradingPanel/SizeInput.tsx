/* eslint-disable react/prop-types */
import { memo, useCallback, useMemo } from 'react';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';

import { validateSizeInput } from '../../utils/tokenUtils';

import type { ISide } from './TradeSideToggle';
import type { ICurrentTokenData } from '../../hooks/usePerpMarketData';

interface ISizeInputProps {
  value: string;
  side: ISide;
  onChange: (value: string) => void;
  tokenInfo?: ICurrentTokenData | null;
  error?: string;
  disabled?: boolean;
}

export const SizeInput = memo<ISizeInputProps>(
  ({ value, onChange, tokenInfo, error, disabled = false, side }) => {
    const szDecimals = tokenInfo?.szDecimals || 4;
    const isDisabled = disabled || !tokenInfo;
    const maxSzs = tokenInfo?.maxTradeSzs || [0, 0];
    const maxSize = maxSzs[side === 'long' ? 0 : 1];

    const handleInputChange = useCallback(
      (text: string) => {
        if (!validateSizeInput(text, szDecimals)) return;
        onChange(text);
      },
      [szDecimals, onChange],
    );

    const handleBlur = useCallback(() => {
      if (value) {
        const maxSizeNum = parseFloat(maxSize.toString());
        const currentValue = parseFloat(value);

        if (currentValue > maxSizeNum) {
          onChange(maxSize.toString());
        }
      }
    }, [value, maxSize, onChange]);

    const formatLabel = useMemo(() => {
      return side === 'long' ? 'Buy amount' : 'Sell amount';
    }, [side]);

    return (
      <YStack bg="$bgSubdued" borderRadius="$3" borderWidth="$0" p="$3">
        <SizableText size="$bodyMd" color="$textSubdued" mb="$2">
          {formatLabel}
        </SizableText>
        <YStack>
          <Input
            flex={1}
            size="medium"
            value={value}
            onChangeText={handleInputChange}
            onBlur={handleBlur}
            placeholder="0.0"
            keyboardType="decimal-pad"
            disabled={isDisabled}
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
                  <XStack alignItems="center" gap="$1">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {tokenInfo?.name || ''}
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
          {Number(maxSize) > 0 ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              mt="$1"
              alignSelf="flex-end"
            >
              Max: {Number(maxSize).toFixed(szDecimals)}
            </SizableText>
          ) : null}
        </YStack>
      </YStack>
    );
  },
);

SizeInput.displayName = 'SizeInput';
