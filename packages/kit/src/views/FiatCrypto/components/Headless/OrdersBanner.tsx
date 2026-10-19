import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import { formatHeadlessBuyOrderTitle } from './orderFormat';
import { getHeadlessBuyOrderStatusLabelId } from './OrderStatusBadge';

export type IOrdersBannerTarget =
  | { kind: 'order'; order: IHeadlessBuyOrder }
  | { kind: 'list'; count: number };

// Which banner to show (product spec 2026-10-16): a not-yet-viewed failure
// wins and shows once; otherwise one processing order links to its detail
// and several link to the list. Null = no banner.
export function getOrdersBannerTarget({
  processingOrders,
  unseenFailedOrder,
}: {
  processingOrders: IHeadlessBuyOrder[];
  unseenFailedOrder?: IHeadlessBuyOrder;
}): IOrdersBannerTarget | null {
  if (unseenFailedOrder) {
    return { kind: 'order', order: unseenFailedOrder };
  }
  if (processingOrders.length === 1) {
    return { kind: 'order', order: processingOrders[0] };
  }
  if (processingOrders.length > 1) {
    return { kind: 'list', count: processingOrders.length };
  }
  return null;
}

// First row of the Buy tab list (scrolls with it; the search bar stays put).
export function OrdersBanner({
  target,
  onPress,
}: {
  target: IOrdersBannerTarget;
  onPress: (target: IOrdersBannerTarget) => void;
}) {
  const intl = useIntl();
  const isFailed =
    target.kind === 'order' &&
    target.order.status === EHeadlessBuyOrderStatus.Failed;
  const title =
    target.kind === 'order'
      ? formatHeadlessBuyOrderTitle(intl, target.order)
      : intl.formatMessage(
          { id: ETranslations.buy_orders_count__title },
          { count: target.count },
        );
  const statusLabelId =
    target.kind === 'order'
      ? getHeadlessBuyOrderStatusLabelId(target.order.status)
      : ETranslations.global_processing;
  return (
    <Stack px="$5" pb="$3">
      <XStack
        testID="headless-buy-orders-banner"
        ai="center"
        gap="$2"
        px="$3"
        py="$2.5"
        borderRadius="$3"
        bg="$bgSubdued"
        onPress={() => onPress(target)}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        cursor="pointer"
      >
        <Stack
          w="$2"
          h="$2"
          borderRadius="$full"
          bg={isFailed ? '$iconCritical' : '$iconInfo'}
        />
        <SizableText size="$bodyMdMedium" flex={1} numberOfLines={1}>
          {title}
        </SizableText>
        <SizableText
          size="$bodyMd"
          color={isFailed ? '$textCritical' : '$textSubdued'}
        >
          {intl.formatMessage({ id: statusLabelId })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </Stack>
  );
}
