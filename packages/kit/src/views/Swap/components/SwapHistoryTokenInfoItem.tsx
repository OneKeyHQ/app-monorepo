import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

interface ISwapHistoryTokenInfoItemProps {
  token: ISwapToken;
  amount: string;
  network?: ISwapNetwork;
  currencySymbol: string;
}
const SwapHistoryTokenInfoItem = ({
  token,
  amount,
  network,
  currencySymbol,
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
          <SizableText>{token.name}</SizableText>
          <SizableText>{network?.name ?? ''}</SizableText>
        </YStack>
      </XStack>
      <YStack>
        <SizableText>{amount}</SizableText>
        <SizableText>{`${currencySymbol}${amountFiatValue}`}</SizableText>
      </YStack>
    </XStack>
  );
};
export default SwapHistoryTokenInfoItem;
