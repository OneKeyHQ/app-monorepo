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
    const calculateLimitPrice = toAmountNum
      .div(fromAmountNum)
      .decimalPlaces(
        orderItemState?.toTokenInfo.decimals ?? 0,
        BigNumber.ROUND_HALF_UP,
      )
      .toFixed();
    const limitPriceFormat = formatBalance(calculateLimitPrice);
    return limitPriceFormat.formattedValue;
  }, [
    decimalsAmount.fromAmount,
    decimalsAmount.toAmount,
    orderItemState?.toTokenInfo.decimals,
  ]);

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
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.limit_cancel_order_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.limit_cancel_order_content,
          },
          {
            orderID: `${item.orderId.slice(0, 6)}...${item.orderId.slice(-4)}`,
          },
        ),
        renderContent: <LimitOrderCancelDialog item={item} />,
        onConfirm: async () => {
          await dialog.close();
          await runCancel(item);
        },
        showCancelButton: true,
        showConfirmButton: true,
      });
    },
    [intl, runCancel],
  );

  const renderLimitOrderStatus = useCallback(() => {
    const { status } = orderItemState ?? {};
    let label = intl.formatMessage({
      id: ETranslations.Limit_order_status_open,
    });
    let color = '$textSuccess';
    if (status) {
      switch (status) {
        case ESwapLimitOrderStatus.CANCELLED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_cancel,
          });
          color = '$textCritical';
          break;
        case ESwapLimitOrderStatus.FULFILLED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_filled,
          });
          color = '$textSuccess';
          break;
        case ESwapLimitOrderStatus.EXPIRED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_expired,
          });
          color = '$textCaution';
          break;
        case ESwapLimitOrderStatus.PRESIGNATURE_PENDING:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_open,
          });
          break;
        default:
          break;
      }
      return (
        <XStack gap="$4" alignItems="center">
          <SizableText size="$bodyMdMedium" color={color}>
            {label}
          </SizableText>
          {status === ESwapLimitOrderStatus.OPEN ? (
            <Button
              variant="primary"
              size="small"
              onPress={() => {
                void onCancel(orderItemState);
              }}
              loading={cancelLoading}
            >
              {cancelLoading
                ? intl.formatMessage({
                    id: ETranslations.Limit_order_history_status_canceling,
                  })
                : intl.formatMessage({
                    id: ETranslations.Limit_order_history_status_cancel,
                  })}
            </Button>
          ) : null}
        </XStack>
      );
    }
    return null;
  }, [intl, orderItemState, cancelLoading, onCancel]);

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

  const surplus = useMemo(() => {
    const { executedBuyAmount, toAmount, toTokenInfo } = orderItemState ?? {};
    const executedBuyAmountBN = new BigNumber(
      executedBuyAmount ?? '0',
    ).shiftedBy(-(toTokenInfo?.decimals ?? 0));
    const toAmountBN = new BigNumber(toAmount ?? '0').shiftedBy(
      -(toTokenInfo?.decimals ?? 0),
    );
    const surplusBN = executedBuyAmountBN.minus(toAmountBN);
    const surplusFormat = formatBalance(surplusBN.toFixed());
    if (surplusBN.gt(0)) {
      return surplusFormat.formattedValue;
    }
    return null;
  }, [orderItemState]);

  const renderLimitOrderPrice = useCallback(
    () => (
      <SizableText size="$bodyMd" color="$textSubdued">
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
    const formattedExecutedBuyAmount = formatBalance(
      executedBuyAmountBN.toFixed(),
    );
    const executedSellAmountBN = new BigNumber(
      executedSellAmount ?? '0',
    ).shiftedBy(-(fromTokenInfo?.decimals ?? 0));
    const formattedExecutedSellAmount = formatBalance(
      executedSellAmountBN.toFixed(),
    );
    const sellPercentage = executedSellAmountBN
      .div(fromAmountBN)
      .multipliedBy(100)
      .toFixed(2);
    return (
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2" flex={1}>
          <Progress
            h="$1"
            w={gtMd ? 200 : 250}
            colors={['$neutral5', '$textSuccess']}
            value={Number(sellPercentage)}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            {`${sellPercentage}%`}
          </SizableText>
        </XStack>

        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.limit_history_fill_sold,
            },
            {
              num1: formattedExecutedSellAmount.formattedValue,
              token1: fromTokenInfo?.symbol ?? '-',
              num2: formattedExecutedBuyAmount.formattedValue,
              token2: toTokenInfo?.symbol ?? '-',
            },
          )}
        </SizableText>
      </YStack>
    );
  }, [orderItemState, gtMd, intl]);

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
              label={intl.formatMessage({
                id: ETranslations.Limit_order_history_created_expiry,
              })}
              renderContent={renderLimitOrderExpiry()}
              compactAll
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup flexDirection={gtMd ? 'row' : 'column'}>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.Limit_limit_price,
              })}
              renderContent={renderLimitOrderPrice()}
              compactAll
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.Limit_order_history_filled,
              })}
              renderContent={renderLimitOrderFilledStatus()}
              compactAll
            />
            {surplus ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_surplus,
                })}
                renderContent={`${surplus} ${orderItemState.toTokenInfo.symbol}`}
              />
            ) : null}
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.Limit_order_history_order_id,
              })}
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
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_pay_address,
              })}
              renderContent={orderItemState.payAddress}
              showCopy
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_received_address,
              })}
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
    gtMd,
    surplus,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.Limit_order_history_title,
        })}
      />
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
