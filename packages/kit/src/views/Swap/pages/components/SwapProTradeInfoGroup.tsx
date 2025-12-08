import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import {
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

interface ISwapProTradeInfoGroupProps {
  balanceLoading: boolean;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
}: ISwapProTradeInfoGroupProps) => {
  const intl = useIntl();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const [swapProQuoteResultPro] = useSwapSpeedQuoteResultAtom();
  const [swapProQuoteFetchingPro] = useSwapSpeedQuoteFetchingAtom();
  const [swapCurrentQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
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

  const swapProQuoteResult = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return swapCurrentQuoteResult;
    }
    return swapProQuoteResultPro;
  }, [swapProQuoteResultPro, swapCurrentQuoteResult, swapProTradeType]);
  const swapProQuoteFetching = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return swapQuoteLoading;
    }
    return swapProQuoteFetchingPro;
  }, [swapProQuoteFetchingPro, swapQuoteLoading, swapProTradeType]);

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
        title={intl.formatMessage({ id: ETranslations.global_balance })}
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
        title={intl.formatMessage({ id: ETranslations.earn_est_receive })}
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
        title="Trading Fee"
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
