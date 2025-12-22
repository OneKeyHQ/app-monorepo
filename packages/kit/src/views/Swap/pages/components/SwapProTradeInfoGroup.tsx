import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';
import {
  useSwapLimitPriceUseRateAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import {
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

import { ITEM_TITLE_PROPS, ITEM_VALUE_PROPS } from './SwapProTokenDetailGroup';

interface ISwapProTradeInfoGroupProps {
  balanceLoading: boolean;
  onBalanceMax: () => void;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
  onBalanceMax,
}: ISwapProTradeInfoGroupProps) => {
  const intl = useIntl();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const [swapProQuoteResultPro] = useSwapSpeedQuoteResultAtom();
  const [swapProQuoteFetchingPro] = useSwapSpeedQuoteFetchingAtom();
  const [swapCurrentQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const limitPriceValue = useMemo(() => {
    const displayLimitRate = new BigNumber(swapLimitPriceUseRate.rate || 0);
    if (displayLimitRate.isZero() || displayLimitRate.isNaN()) {
      return {
        fromValue: '-',
        toValue: '-',
      };
    }
    return {
      fromValue: `1 ${inputToken?.symbol ?? '-'} = `,
      toValue: displayLimitRate.toFixed(),
    };
  }, [swapLimitPriceUseRate.rate, inputToken?.symbol]);
  const balanceValue = useMemo(() => {
    const balanceBN = new BigNumber(inputToken?.balanceParsed ?? '0');
    if (balanceBN.isZero() || balanceBN.isNaN()) {
      return '0';
    }
    return balanceBN.toFixed();
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
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      const toAmountBN = new BigNumber(
        toTokenAmount?.value ? toTokenAmount.value : '0',
      );
      return toAmountBN.toFixed();
    }
    if (swapProQuoteResult?.toAmount) {
      const toAmountBN = new BigNumber(swapProQuoteResult.toAmount);
      return toAmountBN.toFixed();
    }
    return '';
  }, [toTokenAmount?.value, swapProQuoteResult?.toAmount, swapProTradeType]);
  const tradingFeeValue = useMemo(() => {
    const tradingFee = swapProQuoteResult?.fee?.percentageFee;
    if (!tradingFee) {
      return '--';
    }
    return `${tradingFee}%`;
  }, [swapProQuoteResult?.fee?.percentageFee]);

  return (
    <YStack>
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.global_balance })}
        valueComponent={
          <NumberSizeableText
            size="$bodySmMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: inputToken?.symbol ?? '-' }}
            onPress={onBalanceMax}
            numberOfLines={1}
            maxWidth="$36"
          >
            {balanceValue}
          </NumberSizeableText>
        }
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        isLoading={balanceLoading}
        containerProps={{
          py: '$1',
        }}
      />
      {swapProTradeType === ESwapProTradeType.LIMIT ? (
        <SwapCommonInfoItem
          title={intl.formatMessage({
            id: ETranslations.dexmarket_pro_trigger_price,
          })}
          valueComponent={
            <YStack>
              <SizableText
                size="$bodySmMedium"
                numberOfLines={1}
                textAlign="right"
                maxWidth="$36"
              >
                {limitPriceValue.fromValue}
              </SizableText>
              <NumberSizeableText
                size="$bodySmMedium"
                numberOfLines={1}
                textAlign="right"
                formatter="balance"
                formatterOptions={{ tokenSymbol: toToken?.symbol ?? '-' }}
                maxWidth="$36"
              >
                {limitPriceValue.toValue}
              </NumberSizeableText>
            </YStack>
          }
          titleProps={ITEM_TITLE_PROPS}
          valueProps={ITEM_VALUE_PROPS}
          isLoading={false}
          containerProps={{
            py: '$1',
            alignItems: 'flex-start',
            minHeight: '$10',
          }}
        />
      ) : null}
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.earn_est_receive })}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        value={receiveValue ? undefined : `-- ${toToken?.symbol ?? '-'}`}
        valueComponent={
          receiveValue ? (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol: toToken?.symbol ?? '-' }}
              numberOfLines={1}
              maxWidth="$36"
            >
              {receiveValue}
            </NumberSizeableText>
          ) : undefined
        }
        isLoading={
          swapProTradeType === ESwapProTradeType.LIMIT
            ? false
            : swapProQuoteFetching
        }
        containerProps={{
          py: '$1',
        }}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.provider_ios_popover_wallet_fee,
        })}
        value={tradingFeeValue}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        isLoading={swapProQuoteFetching}
        containerProps={{
          py: '$1',
        }}
      />
    </YStack>
  );
};

export default SwapProTradeInfoGroup;
