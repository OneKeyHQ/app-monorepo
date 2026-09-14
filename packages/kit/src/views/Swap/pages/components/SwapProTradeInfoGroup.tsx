import { useCallback, useMemo } from 'react';

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
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import SwapProviderInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import {
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { pushSwapReceiveSelector } from '../../utils/swapDepositEntryUtils';

import { ITEM_TITLE_PROPS, ITEM_VALUE_PROPS } from './SwapProTokenDetailGroup';

interface ISwapProTradeInfoGroupProps {
  balanceLoading: boolean;
  onBalanceMax: () => void;
  storeName: EJotaiContextStoreNames;
}

const SwapProTradeInfoGroup = ({
  balanceLoading,
  onBalanceMax,
  storeName,
}: ISwapProTradeInfoGroupProps) => {
  const intl = useIntl();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [swapProQuoteFetching] = useSwapQuoteFetchingAtom();
  const [swapCurrentQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapQuoteList] = useSwapQuoteListAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const navigation = useAppNavigation();

  const handleOpenProviderList = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName,
      },
    });
  }, [navigation, storeName]);

  const handleDepositPress = useCallback(() => {
    if (!inputToken || !activeAccount) {
      return;
    }
    pushSwapReceiveSelector({
      navigation,
      token: inputToken,
      accountInfo: activeAccount,
    });
  }, [navigation, inputToken, activeAccount]);

  const inputTokenNetworkId = inputToken?.networkId;
  const { result: enableAddressTypeSelector } = usePromiseResult(
    async () => {
      if (!inputTokenNetworkId) {
        return false;
      }
      const result = await backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: inputTokenNetworkId,
      });
      return result?.mergeDeriveAssetsEnabled;
    },
    [inputTokenNetworkId],
    { initResult: false },
  );

  const balanceValue = useMemo(() => {
    const balanceBN = new BigNumber(inputToken?.balanceParsed ?? '0');
    if (balanceBN.isZero() || balanceBN.isNaN()) {
      return '0';
    }
    return balanceBN.toFixed();
  }, [inputToken]);

  const swapProQuoteResult = swapCurrentQuoteResult;

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
            <XStack
              onPress={handleDepositPress}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              hoverStyle={{ opacity: 0.7 }}
              pressStyle={{ opacity: 0.5 }}
            >
              <Icon name="PlusCircleOutline" size="$4" color="$iconSubdued" />
            </XStack>
          </XStack>
        }
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        isLoading={balanceLoading}
        containerProps={{
          py: '$1',
        }}
      />
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
      {swapProTradeType === ESwapProTradeType.MARKET ? (
        <SwapProviderInfoItem
          providerIcon={swapProQuoteResult?.info.providerLogo ?? ''}
          providerName={swapProQuoteResult?.info.providerName ?? ''}
          titleProps={ITEM_TITLE_PROPS}
          valueProps={ITEM_VALUE_PROPS}
          compact
          showEmptyPlaceholder
          fromToken={inputToken}
          toToken={toToken}
          percentageFee={swapProQuoteResult?.fee?.percentageFee}
          percentOriginFee={swapProQuoteResult?.fee?.percentOriginFee}
          onPress={
            swapQuoteList.length > 1 ? handleOpenProviderList : undefined
          }
        />
      ) : null}
    </YStack>
  );
};

export default SwapProTradeInfoGroup;
