import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IExplorersInfo } from '@onekeyhq/shared/types/swap/types';
import {
  EExplorerType,
  ESwapCleanHistorySource,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import { AssetItem } from '../../../AssetDetails/pages/HistoryDetails';
import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import {
  getSwapCrossChainStatusTextProps,
  getSwapHistoryStatusTextProps,
} from '../../utils/utils';

import type { RouteProp } from '@react-navigation/core';

type ISwapHistoryDetailAssetItem = {
  name: string;
  symbol: string;
  icon: string;
  isNFT: boolean;
  isNative: boolean;
  price: string;
  amount?: string;
};

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const intl = useIntl();
  const { txHistoryOrderId, txHistoryList } = route.params ?? {};
  const [txHistoryListState, setTxHistoryListState] = useState(txHistoryList);
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { result: swapTxHistoryList } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapHistoryPendingList],
  );
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { formatDate } = useFormatDate();
  useEffect(() => {
    if (
      JSON.stringify(swapTxHistoryList) !== JSON.stringify(txHistoryListState)
    ) {
      setTxHistoryListState(swapTxHistoryList);
    }
  }, [swapTxHistoryList, txHistoryListState]);
  const txHistory = useMemo(
    () =>
      txHistoryListState?.find(
        (item) => item.swapInfo.orderId === txHistoryOrderId,
      ),
    [txHistoryListState, txHistoryOrderId],
  );

  const onViewInBrowser = useCallback((url: string) => {
    openUrlExternal(url);
  }, []);

  const renderSwapAssetsChange = useCallback(() => {
    const fromAsset = {
      name: txHistory?.baseInfo.fromToken.name ?? '',
      symbol: txHistory?.baseInfo.fromToken.symbol ?? '',
      icon: txHistory?.baseInfo.fromToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory?.baseInfo.fromToken.isNative,
      price: txHistory?.baseInfo.fromToken?.price ?? '0',
    };

    const toAsset = {
      name: txHistory?.baseInfo.toToken.name ?? '',
      symbol: txHistory?.baseInfo.toToken.symbol ?? '',
      icon: txHistory?.baseInfo.toToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory?.baseInfo.toToken.isNative,
      price: txHistory?.baseInfo.toToken?.price ?? '0',
    };
    let fromTokenAmount = txHistory?.baseInfo.fromAmount;
    let otherAsset: ISwapHistoryDetailAssetItem[] = [];
    if (txHistory?.swapInfo.otherFeeInfos?.length) {
      txHistory?.swapInfo.otherFeeInfos.forEach((item) => {
        const otherFeeTokenSameFromToken = equalTokenNoCaseSensitive({
          token1: item.token,
          token2: txHistory?.baseInfo.fromToken,
        });
        if (otherFeeTokenSameFromToken) {
          fromTokenAmount = new BigNumber(fromTokenAmount ?? 0)
            .plus(item.amount ?? 0)
            .toFixed();
        } else {
          otherAsset = [
            ...otherAsset,
            {
              name: item.token?.name ?? '',
              symbol: item.token?.symbol ?? '',
              icon: item.token?.logoURI ?? '',
              isNFT: false,
              isNative: !!item.token?.isNative,
              price: item.token?.price ?? '0',
              amount: item.amount,
            },
          ];
        }
      });
    }
    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          isAllNetworks
          amount={txHistory?.baseInfo.toAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.toNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        {otherAsset.map((item, index) => (
          <AssetItem
            key={index}
            index={index + 2}
            direction={EDecodedTxDirection.OUT}
            asset={item}
            isAllNetworks
            amount={item.amount ?? '0'}
            networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
            currencySymbol={
              txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
            }
          />
        ))}
      </>
    );
  }, [settingsPersistAtom.currencyInfo.symbol, txHistory]);

  const fromTxExplorer = useCallback(
    async (txId?: string) => {
      const logo = txHistory?.baseInfo.fromNetwork?.logoURI;
      const realTxId = txId ?? txHistory?.txInfo.txId;
      let url = '';
      if (txHistory?.baseInfo.fromNetwork?.networkId && realTxId) {
        url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: txHistory.baseInfo.fromNetwork?.networkId,
          type: 'transaction',
          param: realTxId,
        });
      }
      return {
        name: txHistory?.baseInfo.fromNetwork?.name ?? '-',
        url,
        logo,
        status: txHistory?.status ?? ESwapTxHistoryStatus.PENDING,
        type: EExplorerType.FROM,
      } as IExplorersInfo;
    },
    [
      txHistory?.baseInfo.fromNetwork?.logoURI,
      txHistory?.baseInfo.fromNetwork?.name,
      txHistory?.baseInfo.fromNetwork?.networkId,
      txHistory?.status,
      txHistory?.txInfo.txId,
    ],
  );
  const toTxExplorer = useCallback(
    async (txId?: string) => {
      const logo = txHistory?.baseInfo.toNetwork?.logoURI;
      const realTxId = txId ?? txHistory?.txInfo.receiverTransactionId;
      let url = '';
      if (
        realTxId &&
        txHistory?.baseInfo.toNetwork?.networkId &&
        txHistory?.status === ESwapTxHistoryStatus.SUCCESS
      ) {
        url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: txHistory?.baseInfo.toNetwork?.networkId,
          type: 'transaction',
          param: realTxId,
        });
      }
      return {
        name: txHistory?.baseInfo.toNetwork?.name ?? '-',
        url,
        logo,
        status: txHistory?.status ?? ESwapTxHistoryStatus.PENDING,
        type: EExplorerType.TO,
      } as IExplorersInfo;
    },
    [
      txHistory?.baseInfo.toNetwork?.logoURI,
      txHistory?.baseInfo.toNetwork?.name,
      txHistory?.baseInfo.toNetwork?.networkId,
      txHistory?.status,
      txHistory?.txInfo.receiverTransactionId,
    ],
  );

  const renderSwapOrderStatus = useCallback(() => {
    const { status } = txHistory ?? {};
    const { key, color } = getSwapHistoryStatusTextProps(
      status ?? ESwapTxHistoryStatus.PENDING,
      txHistory?.extraStatus,
    );
    return (
      <XStack gap="$2" alignItems="center">
        <SizableText size={16} color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {txHistory?.txInfo.txId ? (
          <SwapTxHistoryViewInBrowser
            item={txHistory}
            onViewInBrowser={onViewInBrowser}
            fromTxExplorer={fromTxExplorer}
            toTxExplorer={toTxExplorer}
          />
        ) : null}
      </XStack>
    );
  }, [fromTxExplorer, intl, onViewInBrowser, toTxExplorer, txHistory]);

  const renderSwapCrossChainStatus = useCallback(() => {
    const { crossChainStatus } = txHistory ?? {};
    const { key, color } = getSwapCrossChainStatusTextProps(
      crossChainStatus ?? ESwapCrossChainStatus.FROM_PENDING,
    );
    return (
      <XStack gap="$2" alignItems="center">
        <SizableText size={16} color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {txHistory?.swapOrderHash?.refundHash ? (
          <XStack
            onPress={async () => {
              const explorerInfo = await fromTxExplorer(
                txHistory?.swapOrderHash?.refundHash,
              );
              if (explorerInfo.url) {
                onViewInBrowser(explorerInfo.url);
              }
            }}
            cursor="pointer"
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              name="OpenOutline"
              size="$4.5"
              flex={1}
              alignSelf="center"
              color="$iconSubdued"
            />
          </XStack>
        ) : null}
      </XStack>
    );
  }, [fromTxExplorer, intl, onViewInBrowser, txHistory]);

  const renderSwapDate = useCallback(() => {
    const { created } = txHistory?.date ?? {};
    const dateObj = new Date(created ?? 0);
    const dateStr = formatDate(dateObj);
    return (
      <SizableText size={14} color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, txHistory?.date]);

  const renderSwapProvider = useCallback(
    () => (
      <XStack alignItems="center" gap="$1">
        <Image
          source={{ uri: txHistory?.swapInfo.provider.providerLogo ?? '' }}
          w="$5"
          h="$5"
          borderRadius="$1"
        />
        <SizableText size="$bodyLg" color="$textSubdued">
          {txHistory?.swapInfo.provider.providerName ?? ''}
        </SizableText>
      </XStack>
    ),
    [
      txHistory?.swapInfo.provider.providerLogo,
      txHistory?.swapInfo.provider.providerName,
    ],
  );

  const renderNetworkFee = useCallback(() => {
    const { gasFeeFiatValue, gasFeeInNative } = txHistory?.txInfo ?? {};
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
        {` ${txHistory?.baseInfo.fromNetwork?.symbol ?? ''}`}(
        <NumberSizeableText
          color="$textSubdued"
          size="$bodyMd"
          formatter="value"
          formatterOptions={{
            currency:
              txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {gasFeeFiatValue ?? 0}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    settingsPersistAtom.currencyInfo.symbol,
    txHistory?.baseInfo.fromNetwork?.symbol,
    txHistory?.currency,
    txHistory?.txInfo,
  ]);

  const renderRate = useCallback(
    () => (
      <SwapRateInfoItem
        rate={txHistory?.swapInfo.instantRate ?? '0'}
        fromToken={txHistory?.baseInfo.fromToken}
        toToken={txHistory?.baseInfo.toToken}
      />
    ),
    [
      txHistory?.baseInfo.fromToken,
      txHistory?.baseInfo.toToken,
      txHistory?.swapInfo.instantRate,
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
              compactAll
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_date,
              })}
              renderContent={renderSwapDate()}
              compactAll
            />
            {txHistory?.crossChainStatus ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_order_detail,
                })}
                renderContent={renderSwapCrossChainStatus()}
                compactAll
              />
            ) : null}
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_pay_address,
              })}
              renderContent={txHistory.txInfo.sender}
              showCopy
              description={
                <AddressInfo
                  address={txHistory.txInfo.sender}
                  networkId={txHistory.accountInfo?.sender.networkId}
                  accountId={txHistory.accountInfo?.sender.accountId}
                />
              }
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_received_address,
              })}
              renderContent={txHistory.txInfo.receiver}
              description={
                <AddressInfo
                  address={txHistory.txInfo.receiver}
                  networkId={txHistory.accountInfo?.receiver.networkId}
                  accountId={txHistory.accountInfo?.receiver.accountId}
                />
              }
              showCopy
            />
            {txHistory.txInfo.txId ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_transaction_hash,
                })}
                renderContent={txHistory.txInfo.txId}
                showCopy
              />
            ) : null}
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
                {...(txHistory.swapInfo.orderSupportUrl
                  ? {
                      openWithUrl: () =>
                        onViewInBrowser(
                          `${txHistory.swapInfo.orderSupportUrl ?? ''}${
                            txHistory.txInfo.orderId ?? ''
                          }`,
                        ),
                    }
                  : {})}
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
            {txHistory?.swapInfo?.oneKeyFeeExtraInfo?.oneKeyFeeUsd ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.provider_ios_popover_onekey_fee,
                })}
                renderContent={
                  <NumberSizeableText
                    size="$bodyMd"
                    color="$textSubdued"
                    formatter="value"
                    formatterOptions={{
                      currency: '$',
                    }}
                  >
                    {txHistory?.swapInfo?.oneKeyFeeExtraInfo?.oneKeyFeeUsd}
                  </NumberSizeableText>
                }
              />
            ) : null}
            {txHistory?.swapInfo?.surplus ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_surplus,
                })}
                renderContent={`${txHistory.swapInfo.surplus} ${txHistory.baseInfo.toToken.symbol}`}
              />
            ) : null}
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    intl,
    onViewInBrowser,
    renderNetworkFee,
    renderRate,
    renderSwapAssetsChange,
    renderSwapCrossChainStatus,
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
          txHistory?.txInfo ?? {},
        );
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.settings_clear_successful,
          }),
        });
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.DETAIL,
        });
        navigation.pop();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, navigation, txHistory?.txInfo]);

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
      {txHistory?.swapInfo.supportUrl ? (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_support,
          })}
          confirmButtonProps={{
            icon: 'BubbleAnnotationOutline',
            variant: 'secondary',
          }}
          onConfirm={() => {
            if (txHistory?.swapInfo.supportUrl?.includes(SUPPORT_URL)) {
              void showIntercom();
            } else {
              onViewInBrowser(txHistory?.swapInfo.supportUrl ?? '');
            }
          }}
        />
      ) : null}
    </Page>
  );
};

export default SwapHistoryDetailModal;
