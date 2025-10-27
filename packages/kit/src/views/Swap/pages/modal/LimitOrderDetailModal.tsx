import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Page,
  Popover,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { AssetItem } from '@onekeyhq/kit/src/views/AssetDetails/pages/HistoryDetails';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { limitOrderEstimationFeePercent } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCancelLimitOrderSource,
  ESwapLimitOrderStatus,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

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
        await cancelLimitOrder(item, ESwapCancelLimitOrderSource.DETAIL);
      } catch (error) {
        console.error(error);
      } finally {
        setCancelLoading(false);
      }
    },
    [cancelLimitOrder],
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
            id: ETranslations.Limit_order_status_cancelled,
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
            id: ETranslations.limit_order_expired,
          });
          color = '$textCaution';
          break;
        case ESwapLimitOrderStatus.PARTIALLY_FILLED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_history_status_partially_filled,
          });
          color = '$textSuccess';
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
    const {
      executedBuyAmount,
      toAmount,
      toTokenInfo,
      fromTokenInfo,
      executedSellAmount,
      fromAmount,
      kind,
    } = orderItemState ?? {};
    const fromAmountBN = new BigNumber(fromAmount ?? '0').shiftedBy(
      -(fromTokenInfo?.decimals ?? 0),
    );
    const executeSellAmountBN = new BigNumber(
      executedSellAmount ?? '0',
    ).shiftedBy(-(fromTokenInfo?.decimals ?? 0));
    const executedBuyAmountBN = new BigNumber(
      executedBuyAmount ?? '0',
    ).shiftedBy(-(toTokenInfo?.decimals ?? 0));
    if (executeSellAmountBN.isZero()) {
      return null;
    }
    const toAmountBN = new BigNumber(toAmount ?? '0').shiftedBy(
      -(toTokenInfo?.decimals ?? 0),
    );
    if (kind === ESwapQuoteKind.SELL) {
      const limitRate = toAmountBN.dividedBy(fromAmountBN);
      const limitRateBuyAmountBN = limitRate.multipliedBy(executeSellAmountBN);
      const surplusBN = executedBuyAmountBN.minus(limitRateBuyAmountBN);
      const surplusFormat = formatBalance(surplusBN.toFixed());
      if (surplusBN.gt(0)) {
        return surplusFormat.formattedValue;
      }
    } else if (kind === ESwapQuoteKind.BUY) {
      const limitRate = fromAmountBN.dividedBy(toAmountBN);
      const limitRateSellAmountBN = limitRate.multipliedBy(executedBuyAmountBN);
      const surplusBN = limitRateSellAmountBN.minus(executeSellAmountBN);
      const surplusFormat = formatBalance(surplusBN.toFixed());
      if (surplusBN.gt(0)) {
        return surplusFormat.formattedValue;
      }
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

  const renderFillsAt = useCallback(() => {
    const { totalFee, kind } = orderItemState ?? {};
    const { fullFeeAmount } = totalFee ?? {};
    if (!fullFeeAmount) {
      return null;
    }
    const feeAmountWithPercentBN = new BigNumber(
      fullFeeAmount ?? '0',
    ).multipliedBy(new BigNumber(limitOrderEstimationFeePercent));
    let estimationRunPrice;
    let difValuePercentLabel = '0%';
    const fromAmountNum = decimalsAmount.fromAmount;
    const toAmountNum = decimalsAmount.toAmount;
    const calculateLimitPrice = toAmountNum
      .div(fromAmountNum)
      .decimalPlaces(
        orderItemState?.toTokenInfo.decimals ?? 0,
        BigNumber.ROUND_HALF_UP,
      );
    if (kind === ESwapQuoteKind.SELL) {
      const estimationToAmountBN = new BigNumber(decimalsAmount.toAmount).plus(
        feeAmountWithPercentBN,
      );
      estimationRunPrice = estimationToAmountBN
        .dividedBy(decimalsAmount.fromAmount)
        .decimalPlaces(
          orderItemState?.toTokenInfo.decimals ?? 0,
          BigNumber.ROUND_HALF_UP,
        );
      const difValue = estimationRunPrice.minus(calculateLimitPrice);
      const difValuePercent = difValue
        .dividedBy(calculateLimitPrice)
        .multipliedBy(100)
        .toFixed(2);
      difValuePercentLabel = `${difValuePercent}%`;
    }
    if (kind === ESwapQuoteKind.BUY) {
      const estimationFromAmountBN = new BigNumber(
        decimalsAmount.fromAmount,
      ).minus(feeAmountWithPercentBN);
      estimationRunPrice = decimalsAmount.toAmount
        .dividedBy(estimationFromAmountBN)
        .decimalPlaces(
          orderItemState?.toTokenInfo.decimals ?? 0,
          BigNumber.ROUND_HALF_UP,
        );
      const difValue = estimationRunPrice.minus(calculateLimitPrice);
      const difValuePercent = difValue
        .dividedBy(calculateLimitPrice)
        .multipliedBy(100)
        .toFixed(2);
      difValuePercentLabel = `${difValuePercent}%`;
    }
    if (estimationRunPrice) {
      const estimationRunPriceFormat = formatBalance(
        estimationRunPrice.toFixed(),
      );
      return (
        <InfoItem
          renderContent={
            <>
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.limit_fill_at,
                })}
                renderTrigger={
                  <SizableText
                    size="$bodyMdMedium"
                    textDecorationLine="underline"
                    textDecorationStyle="dotted"
                    textDecorationColor="$textSubdued"
                    cursor="pointer"
                  >
                    {intl.formatMessage({
                      id: ETranslations.limit_fill_at,
                    })}
                  </SizableText>
                }
                renderContent={
                  <Stack p="$3">
                    <SizableText size="$bodyMd">
                      {intl.formatMessage({
                        id: ETranslations.limit_fill_at_popover,
                      })}
                    </SizableText>
                  </Stack>
                }
              />
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                {`${estimationRunPriceFormat.formattedValue} ${
                  orderItemState?.toTokenInfo?.symbol ?? '-'
                } (${difValuePercentLabel})`}
              </SizableText>
            </>
          }
          compactAll
        />
      );
    }
    return null;
  }, [
    orderItemState,
    decimalsAmount.toAmount,
    decimalsAmount.fromAmount,
    intl,
  ]);

  const renderLimitOrderFilledStatus = useCallback(() => {
    const {
      fromAmount,
      toAmount,
      executedBuyAmount,
      executedSellAmount,
      fromTokenInfo,
      toTokenInfo,
      kind,
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
    let sellPercentage = '0';
    if (kind === ESwapQuoteKind.SELL) {
      sellPercentage = executedSellAmountBN
        .div(fromAmountBN)
        .multipliedBy(100)
        .toFixed(2);
    } else if (kind === ESwapQuoteKind.BUY) {
      const toAmountBN = new BigNumber(toAmount ?? '0').shiftedBy(
        -(toTokenInfo?.decimals ?? 0),
      );
      sellPercentage = executedBuyAmountBN
        .div(toAmountBN)
        .multipliedBy(100)
        .toFixed(2);
    }
    return (
      <YStack gap="$1" flex={1}>
        <XStack alignItems="center" gap="$2" flex={1}>
          <Progress
            h="$1"
            w={gtMd ? 200 : 250}
            progressColor="$neutral5"
            indicatorColor="$textSuccess"
            value={Number(sellPercentage)}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            {`${sellPercentage}%`}
          </SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" flex={1}>
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

  const getPayAddressAccountInfos = usePromiseResult(
    async () => {
      if (orderItemState?.networkId && orderItemState?.payAddress) {
        const res =
          await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
            networkId: orderItemState.networkId,
            address: orderItemState.payAddress,
          });
        if (res.length > 0) {
          return res[0];
        }
      }
    },
    [orderItemState?.networkId, orderItemState?.payAddress],
    {},
  );

  const getReceiveAddressAccountInfos = usePromiseResult(
    async () => {
      if (orderItemState?.networkId && orderItemState?.receiveAddress) {
        const res =
          await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
            networkId: orderItemState.networkId,
            address: orderItemState.receiveAddress,
          });
        if (res.length > 0) {
          return res[0];
        }
      }
    },
    [orderItemState?.networkId, orderItemState?.receiveAddress],
    {},
  );

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
          <InfoItemGroup
            flexDirection={gtMd ? 'row' : 'column'}
            flexWrap={gtMd ? 'wrap' : 'unset'}
          >
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.Limit_limit_price,
              })}
              renderContent={renderLimitOrderPrice()}
              compactAll
            />
            {renderFillsAt()}
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
                compactAll
                renderContent={`${surplus} ${
                  orderItemState.kind === ESwapQuoteKind.SELL
                    ? orderItemState.toTokenInfo.symbol
                    : orderItemState.fromTokenInfo.symbol
                }`}
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
              description={
                <AddressInfo
                  address={orderItemState.payAddress}
                  networkId={orderItemState.networkId}
                  accountId={getPayAddressAccountInfos.result?.accountId}
                />
              }
              showCopy
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_received_address,
              })}
              renderContent={orderItemState.receiveAddress}
              description={
                <AddressInfo
                  address={orderItemState.receiveAddress}
                  networkId={orderItemState.networkId}
                  accountId={getReceiveAddressAccountInfos.result?.accountId}
                />
              }
              showCopy
            />
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    orderItemState,
    renderLimitOrderAssets,
    intl,
    renderLimitOrderStatus,
    renderLimitOrderExpiry,
    gtMd,
    renderLimitOrderPrice,
    renderFillsAt,
    renderLimitOrderFilledStatus,
    surplus,
    getPayAddressAccountInfos.result?.accountId,
    getReceiveAddressAccountInfos.result?.accountId,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.Limit_order_history_title,
        })}
      />
      <Page.Body>{renderLimitOrderDetails()}</Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_support,
        })}
        confirmButtonProps={{
          icon: 'BubbleAnnotationOutline',
          variant: 'secondary',
        }}
        onConfirm={() => {
          void showIntercom();
        }}
      />
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
