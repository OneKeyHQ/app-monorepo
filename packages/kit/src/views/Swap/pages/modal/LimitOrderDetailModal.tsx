import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Page,
  Progress,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';
import { ESwapLimitOrderStatus } from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import { AssetItem } from '../../../AssetDetails/pages/HistoryDetails';
import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import LimitOrderCancelDialog from '../components/LimitOrderCancelDialog';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

const LimitOrderDetailModal = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.LimitOrderDetail>
    >();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { orderId, orderItem } = route.params ?? {};
  const [cancelLoading, setCancelLoading] = useState(false);
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const [orderItemState, setOrderItemState] = useState(orderItem);
  const limitOrderUpdate = useMemo(
    () => swapLimitOrders?.find((item) => item.orderId === orderId),
    [swapLimitOrders, orderId],
  );
  const { gtMd } = useMedia();
  const intl = useIntl();
  useEffect(() => {
    if (
      limitOrderUpdate &&
      JSON.stringify(limitOrderUpdate) !== JSON.stringify(orderItemState)
    ) {
      setOrderItemState(limitOrderUpdate);
    }
  }, [limitOrderUpdate, orderItem, orderItemState]);

  const decimalsAmount = useMemo(
    () => ({
      fromAmount: new BigNumber(orderItemState?.fromAmount ?? '0').shiftedBy(
        -(orderItemState?.fromTokenInfo?.decimals ?? 0),
      ),
      toAmount: new BigNumber(orderItemState?.toAmount ?? '0').shiftedBy(
        -(orderItemState?.toTokenInfo?.decimals ?? 0),
      ),
    }),
    [
      orderItemState?.fromAmount,
      orderItemState?.fromTokenInfo?.decimals,
      orderItemState?.toAmount,
      orderItemState?.toTokenInfo?.decimals,
    ],
  );

  const limitPrice = useMemo(() => {
    const fromAmountNum = decimalsAmount.fromAmount;
    const toAmountNum = decimalsAmount.toAmount;
    const calculateLimitPrice = toAmountNum.div(fromAmountNum).toFixed();
    const formatLimitPrice = formatBalance(calculateLimitPrice);
    return formatLimitPrice.formattedValue;
  }, [decimalsAmount]);

  const renderLimitOrderAssets = useCallback(() => {
    const fromAsset = {
      name: orderItemState?.fromTokenInfo.name ?? '',
      symbol: orderItemState?.fromTokenInfo.symbol ?? '',
      icon: orderItemState?.fromTokenInfo.logoURI ?? '',
      isNFT: false,
      isNative: !!orderItemState?.fromTokenInfo.isNative,
      price: orderItemState?.fromTokenInfo?.price ?? '0',
    };

    const toAsset = {
      name: orderItemState?.toTokenInfo.name ?? '',
      symbol: orderItemState?.toTokenInfo.symbol ?? '',
      icon: orderItemState?.toTokenInfo.logoURI ?? '',
      isNFT: false,
      isNative: !!orderItemState?.toTokenInfo.isNative,
      price: orderItemState?.toTokenInfo?.price ?? '0',
    };
    const fromAmount = decimalsAmount.fromAmount.toFixed();
    const toAmount = decimalsAmount.toAmount.toFixed();
    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          isAllNetworks
          amount={toAmount}
          networkIcon={
            getPresetNetworks().find(
              (item) => item.id === orderItemState?.toTokenInfo?.networkId,
            )?.logoURI ?? ''
          }
          currencySymbol={settingsPersistAtom.currencyInfo.symbol}
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromAmount}
          networkIcon={
            getPresetNetworks().find(
              (item) => item.id === orderItemState?.fromTokenInfo?.networkId,
            )?.logoURI ?? ''
          }
          currencySymbol={settingsPersistAtom.currencyInfo.symbol}
        />
      </>
    );
  }, [
    decimalsAmount.fromAmount,
    decimalsAmount.toAmount,
    orderItemState?.fromTokenInfo.isNative,
    orderItemState?.fromTokenInfo.logoURI,
    orderItemState?.fromTokenInfo.name,
    orderItemState?.fromTokenInfo?.networkId,
    orderItemState?.fromTokenInfo?.price,
    orderItemState?.fromTokenInfo.symbol,
    orderItemState?.toTokenInfo.isNative,
    orderItemState?.toTokenInfo.logoURI,
    orderItemState?.toTokenInfo.name,
    orderItemState?.toTokenInfo?.networkId,
    orderItemState?.toTokenInfo?.price,
    orderItemState?.toTokenInfo.symbol,
    settingsPersistAtom.currencyInfo.symbol,
  ]);
  const { cancelLimitOrder } = useSwapBuildTx();
  const runCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      try {
        setCancelLoading(true);
        await cancelLimitOrder(item);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.global_success,
          }),
        });
      } catch (error) {
        console.error(error);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      } finally {
        setCancelLoading(false);
      }
    },
    [cancelLimitOrder, intl],
  );
  const onCancel = useCallback(
    async (item?: IFetchLimitOrderRes) => {
      if (!item) {
        return;
      }
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.limit_cancel_order_title,
        }),
        renderContent: <LimitOrderCancelDialog item={item} />,
        onConfirm: () => runCancel(item),
        showCancelButton: true,
        showConfirmButton: true,
      });
    },
    [intl, runCancel],
  );

  const renderLimitOrderStatus = useCallback(() => {
    const { status } = orderItemState ?? {};
    let label = intl.formatMessage({
      id: ETranslations.swap_history_detail_badge_to_pending,
    });
    let color = '@textCaution';
    if (status) {
      switch (status) {
        case ESwapLimitOrderStatus.CANCELLED:
          label = intl.formatMessage({
            id: ETranslations.swap_history_detail_badge_expired,
          });
          color = '@textCritical';
          break;
        case ESwapLimitOrderStatus.FULFILLED:
          label = intl.formatMessage({
            id: ETranslations.swap_history_detail_badge_to_success,
          });
          color = '$textSuccess';
          break;
        case ESwapLimitOrderStatus.EXPIRED:
          label = intl.formatMessage({
            id: ETranslations.swap_history_detail_badge_expired,
          });
          break;
        case ESwapLimitOrderStatus.PRESIGNATURE_PENDING:
          label = intl.formatMessage({
            id: ETranslations.swap_history_detail_badge_to_pending,
          });
          break;
        default:
          break;
      }
      return (
        <Stack
          flexDirection={gtMd ? 'row' : 'column'}
          gap="$2"
          alignItems={gtMd ? 'center' : 'flex-start'}
        >
          <SizableText size="$bodyMdMedium" color={color}>
            {label}
          </SizableText>
          {status === ESwapLimitOrderStatus.OPEN ? (
            <Button
              variant="secondary"
              size="small"
              icon="DeleteOutline"
              onPress={() => {
                void onCancel(orderItemState);
              }}
              loading={cancelLoading}
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel'}
            </Button>
          ) : null}
        </Stack>
      );
    }
    return null;
  }, [gtMd, intl, orderItemState, cancelLoading, onCancel]);

  const renderLimitOrderExpiry = useCallback(() => {
    const { createdAt, expiredAt } = orderItemState ?? {};
    const createdAtBN = new BigNumber(createdAt ?? '0');
    const expiryBN = new BigNumber(expiredAt ?? '0');
    const createdAtDate = new Date(createdAtBN.toNumber());
    const expiryDate = new Date(expiryBN.shiftedBy(3).toNumber());
    const createdAtTimeFormat = formatDate(createdAtDate);
    const expiryTimeFormat = formatDate(expiryDate);
    return (
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {createdAtTimeFormat}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {expiryTimeFormat}
        </SizableText>
      </YStack>
    );
  }, [orderItemState]);

  const renderLimitOrderPrice = useCallback(
    () => (
      <SizableText size="$bodySm" color="$textSubdued">
        {`1 ${orderItemState?.fromTokenInfo?.symbol ?? '-'} = ${
          limitPrice ?? '-'
        } ${orderItemState?.toTokenInfo?.symbol ?? '-'}`}
      </SizableText>
    ),
    [orderItemState, limitPrice],
  );

  const renderLimitOrderFilledStatus = useCallback(() => {
    const {
      fromAmount,
      executedBuyAmount,
      executedSellAmount,
      fromTokenInfo,
      toTokenInfo,
    } = orderItemState ?? {};
    const fromAmountBN = new BigNumber(fromAmount ?? '0').shiftedBy(
      -(fromTokenInfo?.decimals ?? 0),
    );
    const executedBuyAmountBN = new BigNumber(
      executedBuyAmount ?? '0',
    ).shiftedBy(-(toTokenInfo?.decimals ?? 0));
    const executedSellAmountBN = new BigNumber(
      executedSellAmount ?? '0',
    ).shiftedBy(-(fromTokenInfo?.decimals ?? 0));
    const executeBuyFormat = formatBalance(executedBuyAmountBN.toFixed());
    const executeSellFormat = formatBalance(executedSellAmountBN.toFixed());
    const sellPercentage = executedSellAmountBN
      .div(fromAmountBN)
      .multipliedBy(100)
      .toFixed(2);
    return (
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            {`${sellPercentage}%`}
          </SizableText>
          <XStack w="$20">
            <Progress
              colors={['$neutral5', '$textSuccess']}
              value={Number(sellPercentage)}
            />
          </XStack>
        </XStack>

        <SizableText size="$bodySm" color="$textSubdued">
          {`${executeSellFormat.formattedValue} ${
            fromTokenInfo?.symbol ?? '-'
          } sold for total of ${executeBuyFormat.formattedValue} ${
            toTokenInfo?.symbol ?? '-'
          }`}
        </SizableText>
      </YStack>
    );
  }, [orderItemState]);

  const renderLimitOrderDetails = useCallback(() => {
    if (!orderItemState) {
      return null;
    }
    return (
      <>
        <Stack>{renderLimitOrderAssets()}</Stack>
        <Stack>
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_order_status,
              })}
              renderContent={renderLimitOrderStatus()}
              compactAll
            />
            <InfoItem
              label="Created | Expiry"
              renderContent={renderLimitOrderExpiry()}
              compactAll
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.Limit_limit_price,
              })}
              renderContent={renderLimitOrderPrice()}
              compactAll
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label="Filled"
              renderContent={renderLimitOrderFilledStatus()}
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label="Order ID"
              renderContent={orderItemState.orderId}
              {...(orderItemState.orderSupportUrl
                ? {
                    openWithUrl: () =>
                      openUrlExternal(orderItemState.orderSupportUrl ?? ''),
                  }
                : {})}
              showCopy
            />
            <InfoItem
              label="Pay"
              renderContent={orderItemState.payAddress}
              showCopy
            />
            <InfoItem
              label="Receive"
              renderContent={orderItemState.receiveAddress}
              showCopy
            />
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    intl,
    orderItemState,
    renderLimitOrderAssets,
    renderLimitOrderExpiry,
    renderLimitOrderFilledStatus,
    renderLimitOrderPrice,
    renderLimitOrderStatus,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Order detail" />
      <Page.Body>{renderLimitOrderDetails()}</Page.Body>
    </Page>
  );
};

const LimitOrderDetailModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.LimitOrderDetail>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <LimitOrderDetailModal />
    </SwapProviderMirror>
  );
};

export default function LimitOrderDetailModalWithAllProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <LimitOrderDetailModalWithProvider />
    </AccountSelectorProviderMirror>
  );
}
