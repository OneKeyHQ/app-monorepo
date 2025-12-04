import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import {
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import {
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';

interface ISwapProTradeInfoGroupProps {
  balanceLoading: boolean;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
}: ISwapProTradeInfoGroupProps) => {
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const [swapProQuoteFetching] = useSwapSpeedQuoteFetchingAtom();
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

  const receiveValue = useMemo(() => {
    if (swapProQuoteResult?.toAmount) {
      const toAmountBN = new BigNumber(swapProQuoteResult.toAmount);
      const formattedToTokenValue = numberFormat(toAmountBN.toFixed(), {
        formatter: 'balance',
        formatterOptions: {
          tokenSymbol: toToken?.symbol ?? '-',
        },
      });
      return formattedToTokenValue;
    }
    return `-- ${toToken?.symbol ?? '-'}`;
  }, [swapProQuoteResult?.toAmount, toToken?.symbol]);
  const tradingFeeValue = useMemo(() => {
    const tradingFee = swapProQuoteResult?.fee?.percentageFee ?? 0;
    return `${tradingFee}%`;
  }, [swapProQuoteResult?.fee?.percentageFee]);

  return (
    <YStack gap="$3">
      <SwapCommonInfoItem
        title="Balance"
        value={balanceValue}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={balanceLoading}
      />
      <SwapCommonInfoItem
        title="Est. Receive"
        value={receiveValue}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={swapProQuoteFetching}
      />
      <SwapCommonInfoItem
        title="TradingFee"
        value={tradingFeeValue}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={swapProQuoteFetching}
      />
    </YStack>
  );
};

export default SwapProTradeInfoGroup;
