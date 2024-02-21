import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  IconButton,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapRateInfoItemProps {
  rate?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  isLoading?: boolean;
}
const SwapRateInfoItem = ({
  rate,
  fromToken,
  toToken,
  isLoading,
}: ISwapRateInfoItemProps) => {
  const [rateSwitch, setRateSwitch] = useState(false);
  const handleExchangeRate = useCallback(() => {
    setRateSwitch((prev) => !prev);
  }, []);

  const rateIsExit = useMemo(() => {
    const rateBN = new BigNumber(rate ?? 0);
    return !rateBN.isZero();
  }, [rate]);

  const rateContent = useMemo(() => {
    if (!rateIsExit || !fromToken || !toToken) return '-';
    const rateBN = new BigNumber(rate ?? 0);
    if (rateSwitch) {
      const exchangeRate = new BigNumber(1).div(rateBN);
      return `1 ${toToken.symbol.toUpperCase()} = ${exchangeRate.toFixed()} ${fromToken.symbol.toUpperCase()}`;
    }
    return `1 ${fromToken.symbol.toUpperCase()} = ${rateBN.toFixed()} ${toToken.symbol.toUpperCase()}`;
  }, [fromToken, rate, rateIsExit, rateSwitch, toToken]);

  return isLoading ? (
    <Skeleton w="$20" />
  ) : (
    <XStack justifyContent="space-between">
      <SizableText>Rate</SizableText>
      <XStack>
        <SizableText>{rateContent}</SizableText>
        {rateIsExit ? (
          <IconButton
            size="small"
            onPress={handleExchangeRate}
            icon="SwitchHorOutline"
          />
        ) : null}
      </XStack>
    </XStack>
  );
};
export default SwapRateInfoItem;
