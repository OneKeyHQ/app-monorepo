import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Image, Text, XStack, YStack } from '@onekeyhq/components';

import type { ISwapNetwork, ISwapToken } from '../types';

interface ISwapHistoryTokenInfoItemProps {
  token: ISwapToken;
  amount: string;
  network?: ISwapNetwork;
}
const SwapHistoryTokenInfoItem = ({
  token,
  amount,
  network,
}: ISwapHistoryTokenInfoItemProps) => {
  const amountFiatValue = useMemo(() => {
    const amountBN = new BigNumber(amount);
    const fiatValue = amountBN.multipliedBy(token.price);
    return fiatValue.toFixed(2);
  }, [amount, token]);
  return (
    <XStack w="100%" h="$25" justifyContent="space-between">
      <XStack>
        <Image w="$10" h="$10" source={{ uri: token.logoURI }} />
        <YStack>
          <Text>{token.name}</Text>
          <Text>{network?.name ?? ''}</Text>
        </YStack>
      </XStack>
      <YStack>
        <Text>{amount}</Text>
        <Text>{`$${amountFiatValue}`}</Text>
      </YStack>
    </XStack>
  );
};
export default SwapHistoryTokenInfoItem;
