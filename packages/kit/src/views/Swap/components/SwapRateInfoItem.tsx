import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, XStack } from '@onekeyhq/components';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const formatter: INumberFormatProps = {
  formatter: 'balance',
};
interface ISwapRateInfoItemProps {
  rate: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}
const SwapRateInfoItem = ({
  rate,
  fromToken,
  toToken,
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
      formatter,
    );
    if (rateSwitch) {
      return `1 ${toToken?.symbol?.toUpperCase() ?? ''} = ${formatRate} ${
        fromToken?.symbol?.toUpperCase() ?? ''
      }`;
    }
    return `1 ${fromToken?.symbol?.toUpperCase() ?? ''} = ${formatRate} ${
      toToken?.symbol?.toUpperCase() ?? ''
    }`;
  }, [fromToken, rate, rateSwitch, toToken]);

  return (
    <XStack
      alignItems="center"
      gap="$2"
      cursor="pointer"
      onPress={handleExchangeRate}
    >
      <SizableText color="$textSubdued" size="$bodyMd">
        {rateContent}
      </SizableText>
    </XStack>
  );
};
export default SwapRateInfoItem;
