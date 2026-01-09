import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapLimitPriceUseRateAtom,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SellForSelector from '../../../Market/MarketDetailV2/components/SwapPanel/components/SellForSelector';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import {
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

import { ITEM_TITLE_PROPS, ITEM_VALUE_PROPS } from './SwapProTokenDetailGroup';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProTradeInfoGroupProps {
  balanceLoading: boolean;
  defaultTokens: ISwapTokenBase[];
  defaultLimitTokens: ISwapTokenBase[];
  onBalanceMax: () => void;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
  onBalanceMax,
  defaultTokens,
  defaultLimitTokens,
}: ISwapProTradeInfoGroupProps) => {
  const intl = useIntl();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProQuoteResultPro] = useSwapSpeedQuoteResultAtom();
  const [swapProQuoteFetchingPro] = useSwapSpeedQuoteFetchingAtom();
  const [swapCurrentQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);
  const limitPriceValue = useMemo(() => {
    const swapLimitPriceUseRateBN = new BigNumber(
      swapLimitPriceUseRate.rate || 0,
    );
    if (swapLimitPriceUseRateBN.isZero() || swapLimitPriceUseRateBN.isNaN()) {
      return {
        fromValue: '-',
        toValue: '-',
        toSymbol: '-',
      };
    }
    const displayLimitRate =
      swapProDirection === ESwapDirection.BUY
        ? new BigNumber(1).dividedBy(swapLimitPriceUseRateBN)
        : swapLimitPriceUseRateBN;
    const fromSymbol =
      swapProDirection === ESwapDirection.BUY
        ? toToken?.symbol
        : inputToken?.symbol;
    const toSymbol =
      swapProDirection === ESwapDirection.BUY
        ? inputToken?.symbol
        : toToken?.symbol;
    if (displayLimitRate.isZero() || displayLimitRate.isNaN()) {
      return {
        fromValue: '-',
        toValue: '-',
      };
    }
    return {
      fromValue: `1 ${fromSymbol ?? '-'} = `,
      toValue: displayLimitRate.toFixed(),
      toSymbol: toSymbol ?? '-',
    };
  }, [
    swapLimitPriceUseRate.rate,
    swapProDirection,
    toToken?.symbol,
    inputToken?.symbol,
  ]);
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
    const tradingFeeBN = new BigNumber(tradingFee || '0');
    const isFreeOneKeyFee =
      (tradingFeeBN.isZero() || tradingFeeBN.isNaN()) &&
      swapProQuoteResult?.toAmount;
    if (isFreeOneKeyFee) {
      return {
        valueComponent: (
          <Badge badgeSize="sm" badgeType="info">
            {intl.formatMessage({
              id: ETranslations.swap_stablecoin_0_fee,
            })}
          </Badge>
        ),
      };
    }
    if (!swapProQuoteResult?.toAmount) {
      return {
        value: '-',
      };
    }

    return {
      value: `${tradingFee ?? '0'}%`,
    };
  }, [
    intl,
    swapProQuoteResult?.fee?.percentageFee,
    swapProQuoteResult?.toAmount,
  ]);

  const handleTokenSelect = useCallback(
    (token: IToken) => {
      setSwapProSellToToken(token);
    },
    [setSwapProSellToToken],
  );

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
                formatterOptions={{
                  tokenSymbol: limitPriceValue.toSymbol,
                }}
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
      {swapProDirection === ESwapDirection.SELL ? (
        <SellForSelector
          defaultTokens={defaultTokensFromType}
          currentSelectToken={swapProSelectToken as ISwapTokenBase}
          onTokenSelect={(token) => handleTokenSelect(token as IToken)}
          symbol={swapProSellToToken?.symbol ?? '-'}
          isLoading={swapProQuoteFetching}
          itemTitleProps={ITEM_TITLE_PROPS}
          itemValueProps={ITEM_VALUE_PROPS}
        />
      ) : null}
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.provider_ios_popover_wallet_fee,
        })}
        value={tradingFeeValue.value}
        valueComponent={tradingFeeValue.valueComponent}
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
