import { useMemo } from 'react';

import { Icon, Input, SizableText, XStack, YStack } from '@onekeyhq/components';

interface ISwapProLimitPriceInputProps {
  title: string;
  value: string;
  fromSymbol: string;
  toSymbol: string;
  onChangeText: (text: string) => void;
  onReverseChange: () => void;
}

const SwapProLimitPriceInput = ({
  title,
  value,
  fromSymbol,
  toSymbol,
  onChangeText,
  onReverseChange,
}: ISwapProLimitPriceInputProps) => {
  const fromSymbolLabel = useMemo(() => {
    return `1 ${fromSymbol}`;
  }, [fromSymbol]);
  const reverseChangeComponent = useMemo(() => {
    return (
      <XStack alignItems="center" gap="$1" onPress={onReverseChange} mr="$2">
        <SizableText size="$bodyMd">{fromSymbolLabel}</SizableText>
        <Icon name="SwapVerSolid" size="$4" />
      </XStack>
    );
  }, [fromSymbolLabel, onReverseChange]);
  return (
    <YStack borderRadius="$2" bg="$bgStrong" py="$2" gap="$1">
      <XStack justifyContent="space-between">
        <SizableText size="$bodySm" color="$textDisabled" ml="$2">
          {title}
        </SizableText>
        {reverseChangeComponent}
      </XStack>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder="0.0"
        textAlign="left"
        keyboardType="decimal-pad"
        size="small"
        containerProps={{
          borderWidth: 0,
          flex: 1,
        }}
        addOns={[{ label: toSymbol }]}
      />
    </YStack>
  );
};

export default SwapProLimitPriceInput;
