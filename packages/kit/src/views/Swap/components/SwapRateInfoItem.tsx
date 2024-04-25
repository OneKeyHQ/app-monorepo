import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, Image, SizableText, XStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapRateInfoItemProps {
  rate: string;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  providerUrl?: string;
}
const SwapRateInfoItem = ({
  rate,
  fromToken,
  toToken,
  providerUrl,
}: ISwapRateInfoItemProps) => {
  const [rateSwitch, setRateSwitch] = useState(false);
  const handleExchangeRate = useCallback(() => {
    setRateSwitch((prev) => !prev);
  }, []);

  const rateContent = useMemo(() => {
    const rateBN = new BigNumber(rate ?? 0);
    const exchangeRate = new BigNumber(1).div(rateBN);
    const formatRate = numberFormat(
      rateSwitch ? exchangeRate.toFixed() : rateBN.toFixed(),
      {
        formatter: 'balance',
      },
    );
    if (rateSwitch) {
      return `1 ${toToken.symbol.toUpperCase()} = ${
        formatRate as string
      } ${fromToken.symbol.toUpperCase()}`;
    }
    return `1 ${fromToken.symbol.toUpperCase()} = ${
      formatRate as string
    } ${toToken.symbol.toUpperCase()}`;
  }, [fromToken, rate, rateSwitch, toToken]);

  return (
    <XStack alignItems="center" space="$2">
      <Image
        source={{ uri: providerUrl }}
        width={20}
        height={20}
        borderRadius="$full"
      />
      <SizableText color="$textSubdued" size={14}>
        {rateContent}
      </SizableText>
      <IconButton
        size="small"
        onPress={handleExchangeRate}
        icon="SwitchHorOutline"
      />
    </XStack>
  );
};
export default SwapRateInfoItem;
