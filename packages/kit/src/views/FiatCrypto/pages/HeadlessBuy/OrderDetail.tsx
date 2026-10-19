import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { getOnramperQuotePricing } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import {
  getHeadlessBuyFailureKind,
  isHeadlessBuyOrderDelayed,
  isTerminalHeadlessBuyOrder,
} from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import { DetailRow, formatPrice } from '../../components/Headless/DetailRow';
import { formatHeadlessBuyOrderTime } from '../../components/Headless/orderFormat';
import { OrderStatusBadge } from '../../components/Headless/OrderStatusBadge';
import {
  ProviderLogo,
  getProviderDisplayName,
} from '../../components/Headless/ProviderLogo';
import { RateRow } from '../../components/Headless/RateRow';
import { useHeadlessBuyOrders } from '../../hooks/useHeadlessBuyOrders';

import type { RouteProp } from '@react-navigation/core';

// Detail page poll cadence while focused and the order is not terminal.
const POLL_INTERVAL_MS = 10_000;

function getStatusSentenceId(
  order: IHeadlessBuyOrder,
): ETranslations | undefined {
  switch (order.status) {
    case EHeadlessBuyOrderStatus.Processing:
      return ETranslations.buy_order_processing__desc;
    case EHeadlessBuyOrderStatus.Refunded:
      return ETranslations.buy_order_refunded__desc;
    case EHeadlessBuyOrderStatus.Failed:
      switch (getHeadlessBuyFailureKind(order)) {
        case 'refund':
          return ETranslations.buy_order_failed_refund__desc;
        case 'notCharged':
          return ETranslations.buy_order_failed_not_charged__desc;
        default:
          return ETranslations.buy_order_failed_unknown__desc;
      }
    default:
      return undefined;
  }
}

// One native buy order. Replaces the former "Order submitted" page: reached
// via CommonActions.reset right after the `completed` event (fromCheckout →
// Done footer; the spent buy flow is gone from the stack) or pushed from the
// list / banner / amount-page reminder. Polls while focused until the order
// settles; the status copy follows the 2026-10-16 product spec.
function HeadlessBuyOrderDetailPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.HeadlessBuyOrderDetail
      >
    >();
  const { transactionId, fromCheckout } = route.params;
  const { orders } = useHeadlessBuyOrders();
  const order = useMemo(
    () => orders.find((o) => o.transactionId === transactionId),
    [orders, transactionId],
  );
  const isTerminal = order ? isTerminalHeadlessBuyOrder(order) : true;

  // One lookup on entry, then a focused poll until the order settles. The
  // interval flips to undefined on a terminal status (the hook re-arms on
  // pollingInterval changes by itself), which ends the chain.
  usePromiseResult(
    () =>
      backgroundApiProxy.serviceFiatCrypto.refreshHeadlessBuyOrders({
        transactionIds: [transactionId],
      }),
    [transactionId],
    {
      pollingInterval: isTerminal ? undefined : POLL_INTERVAL_MS,
      checkIsFocused: true,
      runImmediatelyOnPollingIntervalChange: true,
    },
  );
  // A failed order shows in the banner until it has been looked at once.
  useEffect(() => {
    if (order?.status === EHeadlessBuyOrderStatus.Failed) {
      void backgroundApiProxy.serviceFiatCrypto.markHeadlessBuyOrderViewed({
        transactionId,
      });
    }
  }, [order?.status, transactionId]);

  const { copyText } = useClipboard();
  const copyOrderId = useCallback(() => {
    copyText(transactionId);
    if (order) {
      defaultLogger.fiatCrypto.onramper.orderIdCopied({
        networkId: order.networkId,
        tokenSymbol: order.tokenSymbol,
        transactionId,
      });
    }
  }, [copyText, order, transactionId]);

  // Contact support carries the order id along: copy it, then open Intercom.
  const contactSupport = useCallback(() => {
    if (!order) {
      return;
    }
    defaultLogger.fiatCrypto.onramper.orderSupportPressed({
      transactionId,
      status: order.status,
    });
    copyText(transactionId);
    void showIntercom();
  }, [order, transactionId, copyText]);

  const openTxHash = useCallback(() => {
    if (!order?.transactionHash) {
      return;
    }
    defaultLogger.fiatCrypto.onramper.orderTxHashPressed({
      transactionId,
      networkId: order.networkId,
    });
    void openTransactionDetailsUrl({
      networkId: order.networkId,
      txid: order.transactionHash,
    });
  }, [order, transactionId]);

  const handleDone = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const now = Date.now();
  const sentenceId = order ? getStatusSentenceId(order) : undefined;
  const isDelayed = order ? isHeadlessBuyOrderDelayed(order, now) : false;
  const isFailed = order?.status === EHeadlessBuyOrderStatus.Failed;
  const isDelivered = order?.status === EHeadlessBuyOrderStatus.Delivered;
  const showSupport =
    isDelayed || isFailed || order?.status === EHeadlessBuyOrderStatus.Refunded;
  const showReceived = isDelivered && order?.outAmount !== undefined;
  // Same pricing as the review card (provider rate, not market price).
  const pricing =
    order &&
    order.payout !== undefined &&
    order.networkFee !== undefined &&
    order.transactionFee !== undefined
      ? getOnramperQuotePricing({
          amount: order.fiatAmount,
          payout: order.payout,
          networkFee: order.networkFee,
          transactionFee: order.transactionFee,
        })
      : undefined;

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.buy_order_details__title,
        })}
      />
      <Page.Body px="$5" pb="$3">
        {!order ? (
          <Empty
            illustration="Orders"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        ) : (
          <YStack gap="$6" pt="$2">
            <YStack gap="$3" ai="flex-start">
              <OrderStatusBadge status={order.status} badgeSize="lg" />
              {sentenceId ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage(
                    { id: sentenceId },
                    { token: order.tokenSymbol },
                  )}
                </SizableText>
              ) : null}
              {isDelayed ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.buy_order_delayed__desc,
                  })}
                </SizableText>
              ) : null}
              {order.lastCheckOk === false ? (
                <SizableText size="$bodySm" color="$textCaution">
                  {intl.formatMessage({
                    id: ETranslations.buy_order_status_stale__msg,
                  })}
                </SizableText>
              ) : null}
              {showSupport ? (
                <Button
                  testID="headless-buy-order-support"
                  size="small"
                  variant="secondary"
                  icon="BubbleAnnotationOutline"
                  onPress={contactSupport}
                >
                  {intl.formatMessage({
                    id: ETranslations.swap_ch_status_hold,
                  })}
                </Button>
              ) : null}
            </YStack>
            <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$3">
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.buy_order_amount_paid__title,
                })}
              >
                <SizableText size="$bodyMdMedium">
                  {formatPrice(order.fiatAmount)}
                </SizableText>
              </DetailRow>
              {showReceived ? (
                <DetailRow
                  label={intl.formatMessage({
                    id: ETranslations.buy_order_amount_received__title,
                  })}
                >
                  <NumberSizeableText
                    size="$bodyMdMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: order.tokenSymbol }}
                  >
                    {order.outAmount}
                  </NumberSizeableText>
                </DetailRow>
              ) : null}
              {!isFailed && !showReceived && order.payout !== undefined ? (
                <DetailRow
                  label={intl.formatMessage({
                    id: ETranslations.earn_est_receive,
                  })}
                >
                  <XStack ai="center" gap="$1">
                    <NumberSizeableText
                      size="$bodyMdMedium"
                      formatter="balance"
                      formatterOptions={{ tokenSymbol: order.tokenSymbol }}
                    >
                      {order.payout}
                    </NumberSizeableText>
                    {pricing ? (
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {`(≈${formatPrice(pricing.payoutFiatValue)})`}
                      </SizableText>
                    ) : null}
                  </XStack>
                </DetailRow>
              ) : null}
              {!isFailed && pricing ? (
                <RateRow
                  tokenSymbol={order.tokenSymbol}
                  impliedPrice={pricing.impliedPrice}
                  providerName={order.providerName}
                  size="$bodyMdMedium"
                />
              ) : null}
              {order.providerName ? (
                <DetailRow
                  label={intl.formatMessage({
                    id: ETranslations.swap_history_detail_provider,
                  })}
                >
                  <XStack ai="center" gap="$1.5">
                    <ProviderLogo provider={order.providerName} />
                    <SizableText size="$bodyMdMedium">
                      {getProviderDisplayName(order.providerName)}
                    </SizableText>
                  </XStack>
                </DetailRow>
              ) : null}
              <DetailRow
                label={intl.formatMessage({ id: ETranslations.global_network })}
              >
                <XStack ai="center" gap="$1.5">
                  <NetworkAvatar networkId={order.networkId} size="$5" />
                  <SizableText size="$bodyMdMedium">
                    {order.networkName ?? ''}
                  </SizableText>
                </XStack>
              </DetailRow>
              {order.address ? (
                <DetailRow
                  label={intl.formatMessage({
                    id: ETranslations.receive_address__title,
                  })}
                >
                  <SizableText size="$bodyMdMedium">
                    {[
                      order.accountName,
                      accountUtils.shortenAddress({ address: order.address }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </SizableText>
                </DetailRow>
              ) : null}
              <DetailRow
                label={intl.formatMessage({ id: ETranslations.global_time })}
              >
                <SizableText size="$bodyMdMedium">
                  {formatHeadlessBuyOrderTime(order)}
                </SizableText>
              </DetailRow>
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.buy_order_id__title,
                })}
                onPress={copyOrderId}
              >
                <XStack ai="center" gap="$1.5">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({ address: transactionId })}
                  </SizableText>
                  <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
                </XStack>
              </DetailRow>
              {isDelivered && order.transactionHash ? (
                <DetailRow
                  label={intl.formatMessage({
                    id: ETranslations.global_transaction_id,
                  })}
                  onPress={openTxHash}
                >
                  <XStack ai="center" gap="$1.5">
                    <SizableText size="$bodyMdMedium">
                      {accountUtils.shortenAddress({
                        address: order.transactionHash,
                      })}
                    </SizableText>
                    <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
                  </XStack>
                </DetailRow>
              ) : null}
            </YStack>
          </YStack>
        )}
      </Page.Body>
      {fromCheckout ? (
        <Page.Footer
          onConfirm={handleDone}
          onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
        />
      ) : null}
    </Page>
  );
}

export default HeadlessBuyOrderDetailPage;
