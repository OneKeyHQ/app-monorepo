import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapLimitPriceUseRateAtom,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
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
  const { activeAccount } = useActiveAccount({ num: 0 });
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
  const [, setSwapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);
  const { result: enableAddressTypeSelector } = usePromiseResult(async () => {
    const result = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: inputToken?.networkId ?? '',
    });
    return result?.mergeDeriveAssetsEnabled;
  }, [inputToken?.networkId]);

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
      // Sync BUY counterparty so both directions use the same token
      setSwapProUseSelectBuyToken(token);
      // Save preference (shared with Instant Mode) via simpledb
      const networkId = swapProSelectToken?.networkId || '';
      if (networkId) {
        void backgroundApiProxy.simpleDb.marketTokenPreference.setPreference({
          networkId,
          preference: {
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            networkId: token.networkId,
          },
        });
      }
    },
    [
      setSwapProSellToToken,
      setSwapProUseSelectBuyToken,
      swapProSelectToken?.networkId,
    ],
  );

  return (
    <YStack>
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.global_balance })}
        valueComponent={
          <XStack alignItems="center" gap="$1">
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="balance"
              onPress={onBalanceMax}
              numberOfLines={1}
              maxWidth="$36"
            >
              {balanceValue}
            </NumberSizeableText>
            <SizableText
              size="$bodySmMedium"
              numberOfLines={1}
              textAlign="right"
              maxWidth="$36"
            >
              {inputToken?.symbol ?? '-'}
            </SizableText>
            {!!inputToken && enableAddressTypeSelector ? (
              <AddressTypeSelector
                refreshOnOpen
                placement="bottom-start"
                networkId={inputToken.networkId ?? ''}
                indexedAccountId={activeAccount?.indexedAccount?.id ?? ''}
                walletId={activeAccount?.wallet?.id ?? ''}
                activeDeriveType={activeAccount?.deriveType}
                activeDeriveInfo={activeAccount?.deriveInfo}
                renderSelectorTrigger={
                  <DeriveTypeSelectorTriggerIconRenderer
                    autoShowLabel={false}
                    onPress={() => {}}
                    iconProps={{
                      size: '$4',
                    }}
                    labelProps={{
                      pl: '$1',
                    }}
                  />
                }
              />
            ) : null}
          </XStack>
        }
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        isLoading={balanceLoading}
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
        />
      ) : null}
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
