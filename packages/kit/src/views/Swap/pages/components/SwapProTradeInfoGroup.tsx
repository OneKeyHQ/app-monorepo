import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import SellForSelector from '../../../Market/MarketDetailV2/components/SwapPanel/components/SellForSelector';
import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
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
  cleanInputAmount: () => void;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
  onBalanceMax,
  defaultTokens,
  defaultLimitTokens,
  cleanInputAmount,
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
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [isPayTokenPopoverOpen, setIsPayTokenPopoverOpen] = useState(false);
  const navigation = useAppNavigation();
  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);
  // Pay-token switching only applies to BUY (SELL spends the traded token and
  // picks its counterparty via SellForSelector). Hidden on single-token networks.
  const isPayTokenSwitchVisible =
    swapProDirection === ESwapDirection.BUY && defaultTokensFromType.length > 1;
  // Stock tokens must be paid with stable coins; gray out the native coin.
  const disableNativePayToken =
    swapProDirection === ESwapDirection.BUY && !!swapProSelectToken?.isStock;

  const handleDepositPress = useCallback(() => {
    if (!inputToken || !activeAccount) {
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: {
        accountId: activeAccount.account?.id ?? '',
        networkId: inputToken.networkId ?? '',
        walletId: activeAccount.wallet?.id ?? '',
        indexedAccountId: activeAccount.indexedAccount?.id,
        token: {
          networkId: inputToken.networkId ?? '',
          address: inputToken.contractAddress ?? '',
          name: inputToken.name ?? '',
          symbol: inputToken.symbol ?? '',
          decimals: inputToken.decimals,
          logoURI: inputToken.logoURI,
          isNative: inputToken.isNative,
        },
      },
    });
  }, [navigation, inputToken, activeAccount]);

  const handlePayTokenSelect = useCallback(
    (token: IToken) => {
      // Reset amount/slider and drop the in-flight quote before re-quoting
      // against the newly selected pay token.
      cleanInputAmount();
      setSwapProUseSelectBuyToken(token);
      // Sync SELL counterparty so both directions use the same token
      setSwapProSellToToken(token);
      setIsPayTokenPopoverOpen(false);
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
      cleanInputAmount,
      setSwapProUseSelectBuyToken,
      setSwapProSellToToken,
      swapProSelectToken?.networkId,
    ],
  );
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

  const selectorTrigger = useMemo(
    () => (
      <DeriveTypeSelectorTriggerIconRenderer
        autoShowLabel={false}
        onPress={() => {}}
        iconProps={{ size: '$4' }}
        labelProps={{ pl: '$1' }}
      />
    ),
    [],
  );

  return (
    <YStack>
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.global_balance })}
        valueComponent={
          <XStack alignItems="center" gap="$1">
            <XStack
              onPress={handleDepositPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              hoverStyle={{ opacity: 0.7 }}
              pressStyle={{ opacity: 0.5 }}
            >
              <Icon name="PlusCircleOutline" size="$4" color="$iconSubdued" />
            </XStack>
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
                renderSelectorTrigger={selectorTrigger}
              />
            ) : null}
            {isPayTokenSwitchVisible ? (
              <XStack
                onPress={() => setIsPayTokenPopoverOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                hoverStyle={{ opacity: 0.7 }}
                pressStyle={{ opacity: 0.5 }}
              >
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              </XStack>
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
      {isPayTokenSwitchVisible ? (
        <TokenSelectorPopover
          currentSelectToken={swapProSelectToken}
          isOpen={isPayTokenPopoverOpen}
          onOpenChange={setIsPayTokenPopoverOpen}
          tokens={defaultTokensFromType as IToken[]}
          onTokenPress={handlePayTokenSelect}
          onTradePress={() => {
            setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
          }}
          disabledOnSwitchToTrade
          disableNativeToken={disableNativePayToken}
        />
      ) : null}
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
    </YStack>
  );
};

export default SwapProTradeInfoGroup;
