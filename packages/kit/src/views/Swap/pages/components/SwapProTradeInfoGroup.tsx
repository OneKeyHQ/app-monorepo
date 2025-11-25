import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import { useSwapProInputToken } from '../../hooks/useSwapPro';

const SwapProTradeInfoGroup = () => {
  const inputToken = useSwapProInputToken();
  const balanceValue = useMemo(() => {
    const balanceBN = new BigNumber(inputToken?.balanceParsed ?? '0');
    if (balanceBN.isZero() || balanceBN.isNaN()) {
      return `0 ${inputToken?.symbol ?? '-'}`;
    }
    const formattedBalance = numberFormat(balanceBN.toFixed(), {
      formatter: 'balance',
      formatterOptions: {
        tokenSymbol: inputToken?.symbol ?? '-',
      },
    });
    return formattedBalance;
  }, [inputToken]);
  return (
    <YStack gap="$3">
      <SwapCommonInfoItem title="Balance" value={balanceValue} />
      <SwapCommonInfoItem title="Est. Receive" value={balanceValue} />
      <SwapCommonInfoItem title="TradingFee" value={balanceValue} />
    </YStack>
  );
};

export default SwapProTradeInfoGroup;
