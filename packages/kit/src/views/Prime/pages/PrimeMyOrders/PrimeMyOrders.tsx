import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  Button,
  Empty,
  Icon,
  IconButton,
  Image,
  ListView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  ONEKEY_ORDERS_URL,
  ONEKEY_SHOP_URL,
  ONEKEY_TRACK_ORDER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IShopifyOrder } from '@onekeyhq/shared/types/prime/primeTypes';

const shopifyStatusToBadgeType: Record<string, IBadgeType> = {
  fulfilled: 'success',
  shipped: 'info',
  cancelled: 'warning',
  unfulfilled: 'default',
};

export default function PrimeMyOrders() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [showAlert, setShowAlert] = useState(true);

  const { user } = useOneKeyAuth();

  const { result: orders, isLoading } = usePromiseResult(
    () => backgroundApiProxy.servicePrime.apiFetchShopifyOrders(),
    [],
    { watchLoading: true },
  );

  const handleFindMyOrder = () => {
    openUrlUtils.openUrlExternal(ONEKEY_ORDERS_URL);
  };

  const handleBuyOneKey = () => {
    openUrlUtils.openUrlExternal(ONEKEY_SHOP_URL);
  };

  const handleCopyOrderNumber = useCallback(
    (orderNumber: string, event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
      copyText(orderNumber);
    },
    [copyText],
  );

  const handleOrderDetails = useCallback(
    (order: IShopifyOrder) => {
      const trackOrderUrl = `${ONEKEY_TRACK_ORDER_URL}?order=${encodeURIComponent(
        order.orderNumber,
      )}&token=${encodeURIComponent(user?.email ?? '')}`;
      openUrlUtils.openUrlExternal(trackOrderUrl);
    },
    [user?.email],
  );

  const { gtMd } = useMedia();

  const hasOrders = orders && Array.isArray(orders) && orders.length > 0;

  const renderOrderItem = useCallback(
    ({ item }: { item: IShopifyOrder }) => {
      const firstLineItem = item.lineItems[0];
      return (
        <XStack
          p="$4"
          bg="$bg"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          alignItems="center"
          gap="$3"
          {...(!gtMd && {
            onPress: () => handleOrderDetails(item),
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
            cursor: 'pointer',
          })}
        >
          {/* Product Image */}
          <Image
            width={48}
            height={48}
            borderRadius="$3"
            source={{ uri: firstLineItem?.imageUrl }}
          />

          {/* Order Info */}
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              {/* Order Number + Copy */}
              <XStack alignItems="center" gap="$1">
                <SizableText size="$bodyLgMedium">
                  {item.orderNumber}
                </SizableText>
                <IconButton
                  icon="Copy1Outline"
                  size="small"
                  variant="tertiary"
                  onPress={(e) => handleCopyOrderNumber(item.orderNumber, e)}
                />
              </XStack>
              {/* Status Badge */}
              <Badge
                badgeType={
                  shopifyStatusToBadgeType[item.status.toLowerCase()] ??
                  'default'
                }
                badgeSize="sm"
              >
                {item.status}
              </Badge>
            </XStack>

            {/* Items count and date */}
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.global_number_items },
                { number: item.itemCount },
              )}{' '}
              · {formatDate(new Date(item.createdAt))}
            </SizableText>

            {/* Price */}
            <SizableText size="$bodyMdMedium">${item.totalPrice}</SizableText>
          </YStack>

          {/* Action: Details button (desktop) or Chevron (mobile) */}
          {gtMd ? (
            <Button
              variant="primary"
              size="small"
              iconAfter="OpenOutline"
              onPress={() => handleOrderDetails(item)}
            >
              {intl.formatMessage({ id: ETranslations.global_details })}
            </Button>
          ) : (
            <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
          )}
        </XStack>
      );
    },
    [gtMd, intl, handleCopyOrderNumber, handleOrderDetails],
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    if (hasOrders) {
      return (
        <YStack flex={1} pb="$4" px={gtMd ? 60 : 20} gap="$2.5">
          {/* Alert Banner */}
          {showAlert ? (
            <Alert
              type="info"
              icon="CartOutline"
              title={intl.formatMessage({
                id: ETranslations.prime_order_link_title,
              })}
              description={intl.formatMessage({
                id: ETranslations.prime_order_link_desc,
              })}
              closable
              onClose={() => setShowAlert(false)}
            />
          ) : null}

          {/* Order List */}
          <ListView
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.orderNumber}
            estimatedItemSize={100}
            ItemSeparatorComponent={() => <Stack h="$3" />}
          />
        </YStack>
      );
    }

    return (
      <YStack flex={1} alignItems="center" justifyContent="center" p="$5">
        <Stack mb="$2.5">
          <Icon name="EmptyOrderIllus" width={192} height={108} />
        </Stack>
        <Empty
          title={intl.formatMessage({
            id: ETranslations.prime_no_order_yet,
          })}
          description={intl.formatMessage({
            id: ETranslations.prime_no_order_yet_desc,
          })}
          button={
            <YStack alignItems="center" mt="$6" gap="$4">
              {gtMd ? (
                <XStack gap="$4">
                  <Button
                    variant="primary"
                    borderRadius="$full"
                    onPress={handleFindMyOrder}
                  >
                    {intl.formatMessage({
                      id: ETranslations.prime_button_find_my_order,
                    })}
                  </Button>
                  <Button
                    variant="secondary"
                    borderRadius="$full"
                    onPress={handleBuyOneKey}
                    iconAfter="OpenOutline"
                  >
                    {intl.formatMessage({
                      id: ETranslations.prime_button_buy_onekey,
                    })}
                  </Button>
                </XStack>
              ) : (
                <>
                  <Button
                    variant="primary"
                    borderRadius="$full"
                    onPress={handleFindMyOrder}
                  >
                    {intl.formatMessage({
                      id: ETranslations.prime_button_find_my_order,
                    })}
                  </Button>
                  <XStack alignItems="center" gap="$1">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.global_onekey_prompt_dont_have_yet,
                      })}
                    </SizableText>
                    <SizableText
                      size="$bodyMdMedium"
                      color="$textInteractive"
                      onPress={handleBuyOneKey}
                      hoverStyle={{ opacity: 0.8 }}
                      cursor="pointer"
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_buy_one,
                      })}
                    </SizableText>
                  </XStack>
                </>
              )}
            </YStack>
          }
        />
      </YStack>
    );
  };

  return (
    <Page>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.prime_my_order,
        })}
      />
      <Page.Body>{renderContent()}</Page.Body>
    </Page>
  );
}
