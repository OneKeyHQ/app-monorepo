import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { TextInput } from 'react-native';

interface ISwapProLimitPriceInputProps {
  title: string;
  value: string;
  fromSymbol: string;
  toSymbol: string;
  onChangeText: (text: string) => void;
  onReverseChange: () => void;
  onSetMarketPrice: (price: number) => void;
}

const SwapProLimitPriceInput = ({
  title,
  value,
  fromSymbol,
  toSymbol,
  onChangeText,
  onReverseChange,
  onSetMarketPrice,
}: ISwapProLimitPriceInputProps) => {
  const inputRef = useRef<IInputRef & TextInput>(null);
  const intl = useIntl();
  const handleBlur = useCallback(() => {
    // Reset scroll position to show text from the beginning when unfocused
    inputRef.current?.setSelection?.(0, 0);
  }, []);

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
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textDisabled" ml="$2">
            {title}
          </SizableText>
          <Badge
            bg="$bgApp"
            borderRadius="$2.5"
            borderWidth={1}
            borderCurve="continuous"
            borderColor="$borderSubdued"
            onPress={() => onSetMarketPrice(0)}
            hoverStyle={{
              bg: '$bgStrongHover',
            }}
            pressStyle={{
              bg: '$bgStrongActive',
            }}
          >
            {intl.formatMessage({ id: ETranslations.Limit_market })}
          </Badge>
        </XStack>
        {reverseChangeComponent}
      </XStack>
      <Input
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
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
