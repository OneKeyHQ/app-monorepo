import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

interface ISwapTokenBalanceProps {
  balance: number;
  symbol: string;
}
const SwapTokenBalance = ({ balance, symbol }: ISwapTokenBalanceProps) => (
  <XStack flex={1}>
    <SizableText>Balance</SizableText>
    <SizableText>{balance}</SizableText>
    <SizableText>{symbol}</SizableText>
  </XStack>
);

export default memo(SwapTokenBalance);
