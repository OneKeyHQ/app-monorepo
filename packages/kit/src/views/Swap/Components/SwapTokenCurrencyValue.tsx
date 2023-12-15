import { memo } from 'react';

import { Text, XStack } from '@onekeyhq/components';

interface ISwapTokenCurrencyValueProps {
  value: string;
  currency: string; // todo currency type
}
const SwapTokenCurrencyValue = ({
  value,
  currency,
}: ISwapTokenCurrencyValueProps) => {
  console.log('SwapTokenCurrencyValue');
  return (
    <XStack>
      <Text>{currency}</Text>
      <Text>{value}</Text>
    </XStack>
  );
};

export default memo(SwapTokenCurrencyValue);
