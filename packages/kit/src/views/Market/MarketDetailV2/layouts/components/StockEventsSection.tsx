import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketStockEvent,
  IMarketStockEventsResponse,
} from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { STAT_FALLBACK_VALUE } from '../../utils/statValue';
import { getStockEventMetadataRows } from '../../utils/stockPublicDataUtils';
import { STOCK_DETAIL_HORIZONTAL_GUTTER } from '../stockDesktopLayoutConstants';

function getStockEventTitle(event: IMarketStockEvent) {
  if (event.type === 'earnings') return 'Earnings';
  if (event.type === 'cash_dividend') return 'Cash Dividends';
  if (event.type === 'stock_split') return 'Stock Split';
  return event.title;
}

function getStockEventDescription(event: IMarketStockEvent) {
  const epsEstimate = event.metadata?.epsEstimated;
  if (
    event.type === 'earnings' &&
    epsEstimate !== null &&
    epsEstimate !== undefined
  ) {
    return `EPS estimate: $${epsEstimate}`;
  }
  return event.description ?? STAT_FALLBACK_VALUE;
}

function StockEventRow({
  event,
  isPast,
}: {
  event: IMarketStockEvent;
  isPast: boolean;
}) {
  const { format } = useFormatDate();
  const [isExpanded, setIsExpanded] = useState(false);
  const metadataRows = getStockEventMetadataRows(event);

  return (
    <YStack opacity={isPast ? 0.62 : 1} gap="$3">
      <XStack
        testID={`stock-event-${event.id}`}
        minHeight={52}
        alignItems="center"
        gap="$3.5"
        cursor="pointer"
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.8 }}
        onPress={() => setIsExpanded((value) => !value)}
      >
        <YStack
          width={52}
          height={52}
          borderRadius="$3"
          bg="$bgSubdued"
          alignItems="center"
          justifyContent="center"
          gap="$0.5"
          flexShrink={0}
        >
          <SizableText size="$bodyMdMedium">
            {format(event.date, 'd')}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {format(event.date, 'MMM')}
          </SizableText>
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <SizableText size="$bodyMdMedium">
              {getStockEventTitle(event)}
            </SizableText>
            {event.status === 'scheduled' ? (
              <Stack px="$2" py="$0.5" borderRadius="$1" bg="$bgInfoSubdued">
                <SizableText size="$bodyXsMedium" color="$textInfo">
                  Upcoming
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {getStockEventDescription(event)}
          </SizableText>
        </YStack>
        <Icon
          name={
            isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
          }
          size="$4"
          color="$iconSubdued"
        />
      </XStack>
      {isExpanded && metadataRows.length > 0 ? (
        <YStack pl={66} gap="$2">
          {metadataRows.map((row) => (
            <XStack key={row.key} justifyContent="space-between" gap="$4">
              <SizableText size="$bodySm" color="$textSubdued">
                {row.label}
              </SizableText>
              <SizableText size="$bodySmMedium">{row.value}</SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

type IStockEventsRequestState = {
  data?: IMarketStockEventsResponse;
  status: 'pending' | 'success' | 'error';
};

export function StockEventsSection() {
  const { stockId } = useStockDetail();
  const intl = useIntl();
  const {
    result,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockEventsRequestState>(
    async () => {
      if (!stockId) return { status: 'success' };
      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockEvents({
            stockId,
          });
        return { data, status: 'success' };
      } catch (_error) {
        return { status: 'error' };
      }
    },
    [stockId],
    {
      initResult: { status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );
  const eventsResponse = result.data;
  const events = useMemo(() => {
    if (!eventsResponse || eventsResponse.stockId.toUpperCase() !== stockId) {
      return [];
    }
    return eventsResponse.items;
  }, [eventsResponse, stockId]);
  const upcomingEvents = events.filter((event) => event.status === 'scheduled');
  const pastEvents = events.filter((event) => event.status !== 'scheduled');

  return (
    <YStack
      testID="stock-detail-events"
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      py="$8"
      gap="$5"
    >
      <SizableText size="$headingXl">Events</SizableText>
      {isLoading && events.length === 0 ? (
        <YStack gap="$5">
          <Skeleton width="100%" height={52} />
          <Skeleton width="100%" height={52} />
        </YStack>
      ) : null}
      {!isLoading && result.status === 'error' ? (
        <YStack
          height={96}
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <SizableText color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            })}
          </SizableText>
          <Button
            testID="stock-events-retry"
            size="small"
            variant="tertiary"
            onPress={() => void retry()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      ) : null}
      {!isLoading && result.status === 'success' && events.length === 0 ? (
        <YStack height={96} alignItems="center" justifyContent="center">
          <SizableText color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
        </YStack>
      ) : null}
      {upcomingEvents.length > 0 ? (
        <YStack gap="$5">
          {upcomingEvents.map((event) => (
            <StockEventRow key={event.id} event={event} isPast={false} />
          ))}
        </YStack>
      ) : null}
      {pastEvents.length > 0 ? (
        <YStack gap="$3">
          <SizableText size="$bodySm" color="$textSubdued">
            Past events
          </SizableText>
          <YStack gap="$5">
            {pastEvents.map((event) => (
              <StockEventRow key={event.id} event={event} isPast />
            ))}
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
