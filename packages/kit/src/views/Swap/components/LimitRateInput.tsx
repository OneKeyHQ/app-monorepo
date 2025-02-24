import { useMemo } from 'react';

import {
  Icon,
  Input,
  SizableText,
  XStack,
  getFontSize,
} from '@onekeyhq/components';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

interface ILimitRateInputProps {
  fromTokenInfo?: ISwapTokenBase;
  toTokenInfo?: ISwapTokenBase;
  onChangeText: (text: string) => void;
  onReverseChange: (reverse: boolean) => void;
  reverse: boolean;
  limitPriceRateValue?: string;
}

const LimitRateInput = ({
  fromTokenInfo,
  toTokenInfo,
  onChangeText,
  limitPriceRateValue,
  onReverseChange,
  reverse,
}: ILimitRateInputProps) => {
  const currency = useMemo(
    () => ({
      from: !reverse
        ? fromTokenInfo?.symbol ?? '-'
        : toTokenInfo?.symbol ?? '-',
      to: !reverse ? toTokenInfo?.symbol ?? '-' : fromTokenInfo?.symbol ?? '-',
    }),
    [fromTokenInfo, toTokenInfo, reverse],
  );
  return (
    <XStack gap="$1" alignItems="center">
      <SizableText size="$bodyMd" numberOfLines={1} flexShrink={0}>
        {fromTokenInfo ? `1 ${currency.from} = ` : '-'}
      </SizableText>
      <Input
        keyboardType="decimal-pad"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        size="large"
        focusVisibleStyle={undefined}
        containerProps={{
          flex: 1,
          borderWidth: 0,
        }}
        onChangeText={onChangeText}
        textAlign="right"
        value={limitPriceRateValue ?? ''}
        placeholder="0.0"
      />
      {toTokenInfo ? (
        <XStack
          cursor="pointer"
          gap="$1"
          onPress={() => onReverseChange(!reverse)}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText size="$bodyMd">{currency.to}</SizableText>
          <Icon name="RepeatOutline" size="$2.5" />
        </XStack>
      ) : null}
    </XStack>
  );
};

export default LimitRateInput;
