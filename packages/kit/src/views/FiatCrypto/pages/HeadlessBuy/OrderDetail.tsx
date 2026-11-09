import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  ZoomIn,
} from 'react-native-reanimated';

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
  getHeadlessBuyOrderSentenceId,
  isHeadlessBuyOrderDelayed,
  isTerminalHeadlessBuyOrder,
} from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHeadlessBuyOrderStatus } from '@onekeyhq/shared/types/fiatCrypto';

import {
  DETAIL_CARD_PROPS,
  DetailAddressValue,
  DetailRow,
  DetailRowMotion,
  formatPrice,
} from '../../components/Headless/DetailRow';
import { FeeRow } from '../../components/Headless/FeeRow';
import {
  MOTION_BLOCK_ENTERING_AFTER_EXIT,
  MOTION_BLOCK_EXITING,
  MOTION_EASE_OUT,
  MOTION_ENTER_MS,
  MOTION_EXIT_MS,
  MOTION_ROW_LAYOUT,
} from '../../components/Headless/motionTokens';
import { formatHeadlessBuyOrderTime } from '../../components/Headless/orderFormat';
import {
  OrderStatusBadge,
  getHeadlessBuyOrderStatusLabelId,
} from '../../components/Headless/OrderStatusBadge';
import {
  ProviderLogo,
  getProviderDisplayName,
} from '../../components/Headless/ProviderLogo';
import { RateRow } from '../../components/Headless/RateRow';
import { useHeadlessBuyOrders } from '../../hooks/useHeadlessBuyOrders';

import type { RouteProp } from '@react-navigation/core';

// A status that changes while the page is open (the poll below) swaps its
// block in place: the old one fades out over EXIT, then the new one fades in
// over ENTER — both at once would print two statuses over each other — and
// the new badge settles in from 95% with it: the eye lands on what changed.
// Scaled from its left edge, where it is anchored; never from 0, which reads
// as a pop rather than a change.
const STATUS_BADGE_ENTERING = ZoomIn.withInitialValues({ scale: 0.95 })
  .duration(MOTION_ENTER_MS)
  .delay(MOTION_EXIT_MS)
  .easing(MOTION_EASE_OUT);
const STATUS_BADGE_ORIGIN = { transformOrigin: 'left center' } as const;

// Detail page poll cadence while focused and the order is not terminal. The
// lookup endpoint is rate limited per IP (10/min), so stay well under it.
const POLL_INTERVAL_MS = 15_000;

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
  const { orders, isReady } = useHeadlessBuyOrders();
  const order = useMemo(
    () => orders.find((o) => o.transactionId === transactionId),
    [orders, transactionId],
  );
  const isTerminal = order ? isTerminalHeadlessBuyOrder(order) : true;

  // One lookup once the local record has been read (before that the poll
  // interval is still unknown, and looking up anyway would double the first
  // request the moment the record arrives and the interval flips), then a
  // focused poll until the order settles. The interval flips to undefined on
  // a terminal status (the hook re-arms on pollingInterval changes by
  // itself), which ends the chain.
  usePromiseResult(
    async () => {
      if (!isReady) {
        return undefined;
      }
      return backgroundApiProxy.serviceFiatCrypto.refreshHeadlessBuyOrders({
        transactionIds: [transactionId],
      });
    },
    [transactionId, isReady],
    {
      pollingInterval: isReady && !isTerminal ? POLL_INTERVAL_MS : undefined,
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

  // A status that changes while the page is open (the poll above) is
  // announced: a VoiceOver user doesn't see the badge flip. The status the
  // page opens with is not — it is read with the page.
  const announcedStatusRef = useRef(order?.status);
  useEffect(() => {
    if (!order) {
      return;
    }
    const previous = announcedStatusRef.current;
    announcedStatusRef.current = order.status;
    if (previous === undefined || previous === order.status) {
      return;
    }
    const statusLabel = intl.formatMessage({
      id: getHeadlessBuyOrderStatusLabelId(order.status),
    });
    const changedSentenceId = getHeadlessBuyOrderSentenceId(order, Date.now());
    AccessibilityInfo.announceForAccessibility(
      changedSentenceId
        ? `${statusLabel}. ${intl.formatMessage(
            { id: changedSentenceId },
            { token: order.tokenSymbol },
          )}`
        : statusLabel,
    );
  }, [order, intl]);

  const now = Date.now();
  const sentenceId = order
    ? getHeadlessBuyOrderSentenceId(order, now)
    : undefined;
  const isDelayed = order ? isHeadlessBuyOrderDelayed(order, now) : false;
  const isFailed = order?.status === EHeadlessBuyOrderStatus.Failed;
  const isRefunded = order?.status === EHeadlessBuyOrderStatus.Refunded;
  const isDelivered = order?.status === EHeadlessBuyOrderStatus.Delivered;
  const showSupport = isDelayed || isFailed || isRefunded;
  // Nothing will be (or was) delivered: the quote-derived rows would only
  // mislead.
  const hideQuoteRows = isFailed || isRefunded;
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
        {isReady && !order ? (
          <Empty
            illustration="Orders"
            title={intl.formatMessage({
              id: ETranslations.buy_order_not_found__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.buy_order_not_found__desc,
            })}
          />
        ) : null}
        {order ? (
          // Mounted with the order, so the page opens still: only what
          // changes while it is open moves.
          <LayoutAnimationConfig skipEntering skipExiting>
            <YStack gap="$6" pt="$2">
              <Animated.View
                key={order.status}
                entering={MOTION_BLOCK_ENTERING_AFTER_EXIT}
                exiting={MOTION_BLOCK_EXITING}
              >
                <YStack gap="$3" ai="flex-start">
                  <Animated.View
                    entering={STATUS_BADGE_ENTERING}
                    style={STATUS_BADGE_ORIGIN}
                  >
                    <OrderStatusBadge status={order.status} badgeSize="lg" />
                  </Animated.View>
                  {/* These three can change while the status stays (a lookup
                      that fails, an order running late): they move like the
                      card's rows — a new one fades in once the rest have
                      glided — instead of popping in over a gliding card.
                      Not when the whole block swaps: it fades as one. */}
                  <LayoutAnimationConfig skipEntering>
                    {/* Stale note sits right under the label, ahead of the
                        sentence. */}
                    {order.lastCheckOk === false ? (
                      <DetailRowMotion>
                        <SizableText size="$bodySm" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.buy_order_status_stale__msg,
                          })}
                        </SizableText>
                      </DetailRowMotion>
                    ) : null}
                    {sentenceId ? (
                      // Keyed: a new sentence (e.g. running late) replaces
                      // the old one rather than rewriting it in place.
                      <DetailRowMotion key={sentenceId}>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage(
                            { id: sentenceId },
                            { token: order.tokenSymbol },
                          )}
                        </SizableText>
                      </DetailRowMotion>
                    ) : null}
                    {showSupport ? (
                      <DetailRowMotion>
                        <Button
                          testID="headless-buy-order-support"
                          size="small"
                          variant="secondary"
                          icon="BubbleAnnotationOutline"
                          // 30pt small button → 44pt target; nothing else
                          // is pressable within 7pt of it.
                          hitSlop={{ top: 7, bottom: 7 }}
                          onPress={contactSupport}
                        >
                          {intl.formatMessage({
                            id: ETranslations.swap_ch_status_hold,
                          })}
                        </Button>
                      </DetailRowMotion>
                    ) : null}
                  </LayoutAnimationConfig>
                </YStack>
              </Animated.View>
              {/* Same card and weights as the review breakdown: values are
                regular, only what the user gets (received / est. receive)
                is emphasized. Rows that come and go with the status fade in
                place; the card and the rows around them glide. */}
              <Animated.View layout={MOTION_ROW_LAYOUT}>
                <YStack {...DETAIL_CARD_PROPS}>
                  <DetailRowMotion>
                    <DetailRow
                      label={intl.formatMessage({
                        id: ETranslations.buy_order_amount_paid__title,
                      })}
                    >
                      <SizableText size="$bodyMd">
                        {formatPrice(order.fiatAmount)}
                      </SizableText>
                    </DetailRow>
                  </DetailRowMotion>
                  {showReceived ? (
                    <DetailRowMotion>
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
                    </DetailRowMotion>
                  ) : null}
                  {!hideQuoteRows &&
                  !showReceived &&
                  order.payout !== undefined ? (
                    <DetailRowMotion>
                      <DetailRow
                        label={intl.formatMessage({
                          id: ETranslations.earn_est_receive,
                        })}
                      >
                        <XStack
                          ai="center"
                          jc="flex-end"
                          flexWrap="wrap"
                          columnGap="$1"
                        >
                          <NumberSizeableText
                            size="$bodyMdMedium"
                            formatter="balance"
                            formatterOptions={{
                              tokenSymbol: order.tokenSymbol,
                            }}
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
                    </DetailRowMotion>
                  ) : null}
                  {!hideQuoteRows && pricing ? (
                    <DetailRowMotion>
                      <RateRow
                        tokenSymbol={order.tokenSymbol}
                        impliedPrice={pricing.impliedPrice}
                        providerName={order.providerName}
                      />
                    </DetailRowMotion>
                  ) : null}
                  {/* Paid minus received is mostly fees (a $10 buy lost a
                    third to them): without this row nothing on the receipt
                    accounted for the gap. */}
                  {!hideQuoteRows &&
                  (order.networkFee !== undefined ||
                    order.transactionFee !== undefined) ? (
                    <DetailRowMotion>
                      <FeeRow
                        networkFee={order.networkFee}
                        transactionFee={order.transactionFee}
                      />
                    </DetailRowMotion>
                  ) : null}
                  {order.providerName ? (
                    <DetailRowMotion>
                      <DetailRow
                        label={intl.formatMessage({
                          id: ETranslations.swap_history_detail_provider,
                        })}
                      >
                        <XStack ai="center" gap="$1.5">
                          <ProviderLogo provider={order.providerName} />
                          <SizableText size="$bodyMd">
                            {getProviderDisplayName(order.providerName)}
                          </SizableText>
                        </XStack>
                      </DetailRow>
                    </DetailRowMotion>
                  ) : null}
                  <DetailRowMotion>
                    <DetailRow
                      label={intl.formatMessage({
                        id: ETranslations.global_network,
                      })}
                    >
                      <XStack ai="center" gap="$1.5">
                        <NetworkAvatar networkId={order.networkId} size="$5" />
                        <SizableText size="$bodyMd">
                          {order.networkName ?? ''}
                        </SizableText>
                      </XStack>
                    </DetailRow>
                  </DetailRowMotion>
                  {order.address ? (
                    <DetailRowMotion>
                      <DetailRow
                        label={intl.formatMessage({
                          id: ETranslations.receive_address__title,
                        })}
                      >
                        <DetailAddressValue
                          address={order.address}
                          accountName={order.accountName}
                        />
                      </DetailRow>
                    </DetailRowMotion>
                  ) : null}
                  {/* Visual spec: the hash follows the address, ahead of time. */}
                  {isDelivered && order.transactionHash ? (
                    <DetailRowMotion>
                      <DetailRow
                        label={intl.formatMessage({
                          id: ETranslations.global_transaction_id,
                        })}
                        onPress={openTxHash}
                      >
                        <XStack ai="center" gap="$1.5">
                          <SizableText size="$bodyMd">
                            {accountUtils.shortenAddress({
                              address: order.transactionHash,
                            })}
                          </SizableText>
                          <Icon
                            name="OpenOutline"
                            size="$4"
                            color="$iconSubdued"
                          />
                        </XStack>
                      </DetailRow>
                    </DetailRowMotion>
                  ) : null}
                  <DetailRowMotion>
                    <DetailRow
                      label={intl.formatMessage({
                        id: ETranslations.global_time,
                      })}
                    >
                      <SizableText size="$bodyMd">
                        {formatHeadlessBuyOrderTime(order)}
                      </SizableText>
                    </DetailRow>
                  </DetailRowMotion>
                  <DetailRowMotion>
                    <DetailRow
                      label={intl.formatMessage({
                        id: ETranslations.buy_order_id__title,
                      })}
                      onPress={copyOrderId}
                    >
                      <XStack ai="center" gap="$1.5">
                        <SizableText size="$bodyMd">
                          {accountUtils.shortenAddress({
                            address: transactionId,
                          })}
                        </SizableText>
                        <Icon
                          name="Copy3Outline"
                          size="$4"
                          color="$iconSubdued"
                        />
                      </XStack>
                    </DetailRow>
                  </DetailRowMotion>
                </YStack>
              </Animated.View>
            </YStack>
          </LayoutAnimationConfig>
        ) : null}
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
