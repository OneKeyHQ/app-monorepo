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
  rate?: string;
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

  const rateBN = useMemo(() => new BigNumber(rate ?? ''), [rate]);
  const isValidRate = rateBN.isFinite() && rateBN.gt(0);
  const rateContent = useMemo(() => {
    if (!isValidRate) {
      return '--';
    }
    const exchangeRate = new BigNumber(1).div(rateBN);
    const formatRate = numberFormat(
      rateSwitch ? exchangeRate.toFixed() : rateBN.toFixed(),
      formatter,
    );
    if (rateSwitch) {
      return `1 ${toToken?.symbol ?? ''} = ${formatRate} ${
        fromToken?.symbol ?? ''
      }`;
    }
    return `1 ${fromToken?.symbol ?? ''} = ${formatRate} ${
      toToken?.symbol ?? ''
    }`;
  }, [fromToken, isValidRate, rateBN, rateSwitch, toToken]);

  return (
    <XStack
      alignItems="center"
      gap="$2"
      cursor={isValidRate ? 'pointer' : 'default'}
      onPress={isValidRate ? handleExchangeRate : undefined}
    >
      <SizableText color="$textSubdued" size="$bodyMd">
        {rateContent}
      </SizableText>
    </XStack>
  );
};
export default SwapRateInfoItem;
