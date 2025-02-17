import { useMemo } from 'react';

import { Input, SizableText, useMedia } from '@onekeyhq/components';
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
  const media = useMedia();
  const currency = useMemo(
    () =>
      !reverse
        ? `${fromTokenInfo?.symbol ?? '-'}/${toTokenInfo?.symbol ?? '-'}`
        : `${toTokenInfo?.symbol ?? '-'}/${fromTokenInfo?.symbol ?? '-'}`,
    [fromTokenInfo, toTokenInfo, reverse],
  );
  return (
    <>
      <Input
        w="310px"
        onChangeText={onChangeText}
        value={limitPriceRateValue ?? ''}
        placeholder="0.0"
      />
      <SizableText
        position="absolute"
        right="$3"
        bottom={media.gtMd ? '$2' : '$3'}
        cursor="pointer"
        onPress={() => onReverseChange(!reverse)}
      >
        {currency}
      </SizableText>
    </>
  );
};

export default LimitRateInput;
