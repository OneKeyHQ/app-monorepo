import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapProviderInfoItemProps {
  providerName: string;
  rate?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  providerIcon: string;
  showLock?: boolean;
  showBest?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
}
const SwapProviderInfoItem = ({
  showBest,
  rate,
  fromToken,
  toToken,
  providerIcon,
  providerName,
  showLock,
  onPress,
  isLoading,
}: ISwapProviderInfoItemProps) => {
  const rateIsExit = useMemo(() => {
    const rateBN = new BigNumber(rate ?? 0);
    return !rateBN.isZero();
  }, [rate]);
  const rateContent = useMemo(() => {
    if (!rateIsExit || !fromToken || !toToken) return '-';
    const rateBN = new BigNumber(rate ?? 0);
    return `1 ${fromToken.symbol.toUpperCase()} = ${rateBN.toFixed()} ${toToken.symbol.toUpperCase()}`;
  }, [fromToken, rate, rateIsExit, toToken]);
  return (
    <XStack
      justifyContent="space-between"
      onPress={onPress}
      alignItems="center"
    >
      <SizableText>Provider</SizableText>
      <XStack space="$2">
        {isLoading ? (
          <Skeleton w="$20" />
        ) : (
          <>
            {showBest && <SizableText>Best</SizableText>}
            <Image source={{ uri: providerIcon }} w="$5" h="$5" />
            <SizableText>{rate ? rateContent : providerName}</SizableText>
            {showLock && <Icon name="LockOutline" />}
            {onPress && <Icon name="ChevronRightSmallOutline" />}
          </>
        )}
      </XStack>
    </XStack>
  );
};
export default SwapProviderInfoItem;
