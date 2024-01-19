import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

interface ISwapTokenCurrencyValueProps {
  value: string;
  currency: string; // todo currency type
}
const SwapTokenCurrencyValue = ({
  value,
  currency,
}: ISwapTokenCurrencyValueProps) => (
  <XStack>
    <SizableText>{currency}</SizableText>
    <SizableText>{value}</SizableText>
  </XStack>
);

export default memo(SwapTokenCurrencyValue);
