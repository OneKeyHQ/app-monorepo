import { memo } from 'react';

import { Text, XStack } from '@onekeyhq/components';

interface ISwapTokenBalanceProps {
  balance: number;
  symbol: string;
}
const SwapTokenBalance = ({ balance, symbol }: ISwapTokenBalanceProps) => {
  console.log('swapTokenBalance');
  return (
    <XStack>
      <Text>Balance</Text>
      <Text>{balance}</Text>
      <Text>{symbol}</Text>
    </XStack>
  );
};

export default memo(SwapTokenBalance);
