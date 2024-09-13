import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import { AssetItem } from '../../../AssetDetails/pages/HistoryDetails';
import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import { getSwapHistoryStatusTextProps } from '../../utils/utils';

import type { RouteProp } from '@react-navigation/core';

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const intl = useIntl();
  const { txHistory } = route.params ?? {};
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { formatDate } = useFormatDate();

  const onViewInBrowser = useCallback((url: string) => {
    openUrlExternal(url);
  }, []);

  const { md } = useMedia();
  const renderSwapAssetsChange = useCallback(() => {
    const fromAsset = {
      name: txHistory.baseInfo.fromToken.name ?? '',
      symbol: txHistory.baseInfo.fromToken.symbol,
      icon: txHistory.baseInfo.fromToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory.baseInfo.fromToken.isNative,
      price: txHistory.baseInfo.fromToken?.price ?? '0',
    };

    const toAsset = {
      name: txHistory.baseInfo.toToken.name ?? '',
      symbol: txHistory.baseInfo.toToken.symbol,
      icon: txHistory.baseInfo.toToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory.baseInfo.toToken.isNative,
      price: txHistory.baseInfo.toToken?.price ?? '0',
    };

    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          isAllNetworks
          amount={txHistory.baseInfo.toAmount}
          networkIcon={txHistory.baseInfo.toNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={txHistory.baseInfo.fromAmount}
          networkIcon={txHistory.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
      </>
    );
  }, [settingsPersistAtom.currencyInfo.symbol, txHistory]);

  const renderSwapOrderStatus = useCallback(() => {
    const { status } = txHistory;
    const { key, color } = getSwapHistoryStatusTextProps(status);
    return (
      <Stack
        flexDirection={md ? 'row' : 'column'}
        {...(md
          ? {
              alignItems: 'center',
              justifyContent: 'space-between',
            }
          : { alignItems: 'flex-start', gap: '$2' })}
      >
        <SizableText size={16} color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        <SwapTxHistoryViewInBrowser
          item={txHistory}
          onViewInBrowser={onViewInBrowser}
        />
      </Stack>
    );
  }, [intl, md, onViewInBrowser, txHistory]);

  const renderSwapDate = useCallback(() => {
    const { created } = txHistory.date;
    const dateObj = new Date(created);
    const dateStr = formatDate(dateObj);
    return (
      <SizableText size={14} color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, txHistory.date]);

  const renderSwapProvider = useCallback(
    () => (
      <XStack alignItems="center" gap="$1">
        <Image
          source={{ uri: txHistory.swapInfo.provider.providerLogo }}
          width={20}
          height={20}
          borderRadius="$full"
        />
        <SizableText size={14} color="$textSubdued">
          {txHistory.swapInfo.provider.providerName}
        </SizableText>
      </XStack>
    ),
    [
      txHistory.swapInfo.provider.providerName,
      txHistory.swapInfo.provider.providerLogo,
    ],
  );

  const renderNetworkFee = useCallback(() => {
    const { gasFeeFiatValue, gasFeeInNative } = txHistory.txInfo;
    const gasFeeInNativeBN = new BigNumber(gasFeeInNative ?? 0);
    const gasFeeDisplay = gasFeeInNativeBN.toFixed();
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="balance"
        >
          {gasFeeDisplay}
        </NumberSizeableText>
        {` ${txHistory.baseInfo.fromNetwork?.symbol ?? ''}`}(
        <NumberSizeableText
          color="$textSubdued"
          size="$bodyMd"
          formatter="value"
          formatterOptions={{
            currency:
              txHistory.currency ?? settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {gasFeeFiatValue ?? 0}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    settingsPersistAtom.currencyInfo.symbol,
    txHistory.baseInfo.fromNetwork?.symbol,
    txHistory.currency,
    txHistory.txInfo,
  ]);

  const renderRate = useCallback(
    () => (
      <SwapRateInfoItem
        rate={txHistory.swapInfo.instantRate}
        fromToken={txHistory.baseInfo.fromToken}
        toToken={txHistory.baseInfo.toToken}
      />
    ),
    [
      txHistory.baseInfo.fromToken,
      txHistory.baseInfo.toToken,
      txHistory.swapInfo.instantRate,
    ],
  );
  const renderSwapHistoryDetails = useCallback(() => {
    if (!txHistory) {
      return null;
    }

    return (
      <>
        <Stack>{renderSwapAssetsChange()}</Stack>
        <Stack>
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_order_status,
              })}
              renderContent={renderSwapOrderStatus()}
              compact
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_date,
              })}
              renderContent={renderSwapDate()}
              compact
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_pay_address,
              })}
              renderContent={txHistory.txInfo.sender}
              showCopy
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_received_address,
              })}
              renderContent={txHistory.txInfo.receiver}
              showCopy
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_transaction_hash,
              })}
              renderContent={txHistory.txInfo.txId}
              showCopy
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_network_fee,
              })}
              renderContent={renderNetworkFee()}
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              disabledCopy
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_provider,
              })}
              renderContent={renderSwapProvider()}
            />
            {txHistory.txInfo.orderId ? (
              <InfoItem
                label="Order ID"
                renderContent={txHistory.txInfo.orderId}
                showCopy
              />
            ) : null}
            <InfoItem
              disabledCopy
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_rate,
              })}
              renderContent={renderRate()}
            />
            {!isNil(txHistory.swapInfo.protocolFee) ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_protocol_fee,
                })}
                renderContent={
                  <NumberSizeableText
                    size="$bodyMd"
                    color="$textSubdued"
                    formatter="value"
                    formatterOptions={{
                      currency:
                        txHistory.currency ??
                        settingsPersistAtom.currencyInfo.symbol,
                    }}
                  >
                    {txHistory.swapInfo.protocolFee.toString()}
                  </NumberSizeableText>
                }
              />
            ) : null}
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    intl,
    renderNetworkFee,
    renderRate,
    renderSwapAssetsChange,
    renderSwapDate,
    renderSwapOrderStatus,
    renderSwapProvider,
    settingsPersistAtom.currencyInfo.symbol,
    txHistory,
  ]);

  const onDeleteOneHistory = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_clear_title,
      }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceSwap.cleanOneSwapHistory(
          txHistory.txInfo.txId,
        );
        navigation.pop();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, navigation, txHistory.txInfo.txId]);

  const headerRight = useCallback(
    () => (
      <Button variant="tertiary" onPress={onDeleteOneHistory}>
        {intl.formatMessage({ id: ETranslations.global_clear })}
      </Button>
    ),
    [intl, onDeleteOneHistory],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.swap_history_detail_title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>{renderSwapHistoryDetails()}</Page.Body>
      {txHistory.swapInfo.supportUrl ? (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_support,
          })}
          confirmButtonProps={{
            icon: 'BubbleAnnotationOutline',
            variant: 'secondary',
          }}
          onConfirm={() => {
            onViewInBrowser(txHistory.swapInfo.supportUrl ?? '');
          }}
        />
      ) : null}
    </Page>
  );
};

export default SwapHistoryDetailModal;
