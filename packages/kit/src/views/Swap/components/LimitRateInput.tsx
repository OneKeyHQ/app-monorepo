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
  inputRate?: string;
}

const LimitRateInput = ({
  fromTokenInfo,
  toTokenInfo,
  onChangeText,
  onReverseChange,
  reverse,
  inputRate,
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
      <SizableText
        size="$bodyMd"
        numberOfLines={1}
        flexShrink={0}
        borderRightWidth={1}
        borderRightColor="$borderSubdued"
        paddingRight="$3"
      >
        {fromTokenInfo ? `1 ${currency.from} = ` : '-'}
      </SizableText>
      <Input
        key={`${currency.from}-${currency.to}`}
        autoScrollTopDelayMs={2500}
        keyboardType="decimal-pad"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        height="$14"
        size="large"
        focusVisibleStyle={undefined}
        containerProps={{
          flex: 1,
          borderWidth: 0,
        }}
        onChangeText={onChangeText}
        textAlign="right"
        value={inputRate ?? ''}
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
