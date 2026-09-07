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
import {
  STAT_FALLBACK_VALUE,
  formatCurrencyStatValue,
} from '../../utils/statValue';
import { formatDirectPercentValue } from '../../utils/stockPublicDataUtils';
import { STOCK_DETAIL_HORIZONTAL_GUTTER } from '../stockDesktopLayoutConstants';

import type { IntlShape } from 'react-intl';

const STOCK_EVENT_ROW_HEIGHT = 72;
const STOCK_EVENT_CALENDAR_SIZE = 56;
// The detail column is padded by 3px so its collapsed height (3 + 24 + 6 + 20 +
// 3) matches the 56px calendar block sitting next to it.
const STOCK_EVENT_DETAIL_VERTICAL_PADDING = 3;

type IFormatDate = ReturnType<typeof useFormatDate>['formatDate'];

type IStockEventDetailLine = {
  key: string;
  text: string;
};

/**
 * Keys the backend sends but the design never spelled out have no translation,
 * so they fall back to a camelCase split and still render as one
 * `Label: value` line.
 */
const STOCK_EVENT_METADATA_LABEL_IDS: Record<string, ETranslations> = {
  epsEstimated: ETranslations.market_stock_event_eps_estimate,
  epsActual: ETranslations.market_stock_event_eps_actual,
  revenueEstimated: ETranslations.market_stock_event_revenue_estimate,
  revenueActual: ETranslations.market_stock_event_revenue_actual,
  dividendPerShare: ETranslations.market_stock_event_dividend_per_share,
  adjustedDividendPerShare:
    ETranslations.market_stock_event_adj_dividend_per_share,
  dividendYield: ETranslations.dexmarket_stock_dividend_yield,
  declarationDate: ETranslations.market_stock_event_declaration_date,
  recordDate: ETranslations.market_stock_event_record_date,
  paymentDate: ETranslations.market_stock_event_payment_date,
  frequency: ETranslations.market_stock_event_frequency,
  lastUpdated: ETranslations.market_last_updated,
};

const STOCK_EVENT_CURRENCY_METADATA_KEYS = new Set([
  'epsEstimated',
  'epsActual',
  'revenueEstimated',
  'revenueActual',
  'dividendPerShare',
  'adjustedDividendPerShare',
]);

const STOCK_EVENT_PERCENT_METADATA_KEYS = new Set(['dividendYield']);

const STOCK_EVENT_DATE_METADATA_KEYS = new Set([
  'declarationDate',
  'recordDate',
  'paymentDate',
  'lastUpdated',
]);

function getStockEventMetadataLabel(key: string, intl: IntlShape) {
  const labelId = STOCK_EVENT_METADATA_LABEL_IDS[key];
  if (labelId) {
    return intl.formatMessage({ id: labelId });
  }
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function formatStockEventMetadataValue(
  key: string,
  value: string | number,
  formatDate: IFormatDate,
) {
  if (STOCK_EVENT_CURRENCY_METADATA_KEYS.has(key)) {
    return formatCurrencyStatValue(value);
  }
  if (STOCK_EVENT_PERCENT_METADATA_KEYS.has(key)) {
    return formatDirectPercentValue(value);
  }
  if (STOCK_EVENT_DATE_METADATA_KEYS.has(key) && typeof value === 'string') {
    return formatDate(value, { hideTimeForever: true }) || value;
  }
  return String(value);
}

/**
 * The expanded design lists every metadata field as its own `Label: value`
 * line inside the detail column, so there is no row cap here.
 */
function getStockEventDetailLines(
  event: IMarketStockEvent,
  formatDate: IFormatDate,
  intl: IntlShape,
): IStockEventDetailLine[] {
  if (!event.metadata) return [];
  return Object.entries(event.metadata).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === '') return [];
    const label = getStockEventMetadataLabel(key, intl);
    const formattedValue = formatStockEventMetadataValue(
      key,
      value,
      formatDate,
    );
    return [{ key, text: `${label}: ${formattedValue}` }];
  });
}

function getStockEventTitle(event: IMarketStockEvent, intl: IntlShape) {
  if (event.type === 'earnings') {
    return intl.formatMessage({
      id: ETranslations.market_stock_event_earnings,
    });
  }
  if (event.type === 'cash_dividend') {
    return intl.formatMessage({
      id: ETranslations.market_stock_event_cash_dividends,
    });
  }
  if (event.type === 'stock_split') {
    return intl.formatMessage({
      id: ETranslations.market_stock_event_stock_split,
    });
  }
  return event.title;
}

function getStockEventDescription(event: IMarketStockEvent, intl: IntlShape) {
  const epsEstimate = event.metadata?.epsEstimated;
  if (
    event.type === 'earnings' &&
    epsEstimate !== null &&
    epsEstimate !== undefined
  ) {
    const label = intl.formatMessage({
      id: ETranslations.market_stock_event_eps_estimate,
    });
    return `${label}: $${epsEstimate}`;
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
  const intl = useIntl();
  const { format, formatDate } = useFormatDate();
  const [isExpanded, setIsExpanded] = useState(false);
  const detailLines = getStockEventDetailLines(event, formatDate, intl);

  return (
    <YStack opacity={isPast ? 0.62 : 1}>
      <XStack
        testID={`stock-event-${event.id}`}
        minHeight={STOCK_EVENT_ROW_HEIGHT}
        alignItems="flex-start"
        gap="$4"
        py="$2"
        cursor="pointer"
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.8 }}
        onPress={() => setIsExpanded((value) => !value)}
      >
        <YStack
          width={STOCK_EVENT_CALENDAR_SIZE}
          height={STOCK_EVENT_CALENDAR_SIZE}
          borderRadius="$2"
          bg="$bgSubdued"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <SizableText size="$headingMd">{format(event.date, 'd')}</SizableText>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {format(event.date, 'MMM')}
          </SizableText>
        </YStack>
        <YStack
          flex={1}
          minWidth={0}
          gap="$1.5"
          py={STOCK_EVENT_DETAIL_VERTICAL_PADDING}
        >
          <XStack alignItems="center" gap="$2">
            <SizableText size="$headingLg">
              {getStockEventTitle(event, intl)}
            </SizableText>
            {event.status === 'scheduled' ? (
              <Stack
                px="$2"
                py="$0.5"
                minWidth={36}
                alignItems="center"
                justifyContent="center"
                borderRadius="$1"
                bg="$bgInfoSubdued"
              >
                <SizableText size="$bodySmMedium" color="$textInfo">
                  {intl.formatMessage({
                    id: ETranslations.market_chart_settings__upcoming_events,
                  })}
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
          {isExpanded && detailLines.length > 0 ? (
            detailLines.map((line) => (
              <SizableText key={line.key} size="$bodyMd" color="$textSubdued">
                {line.text}
              </SizableText>
            ))
          ) : (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {getStockEventDescription(event, intl)}
            </SizableText>
          )}
        </YStack>
        {/* The chevron keeps its own 16px vertical padding so it stays near the
        title row instead of centering against the expanded detail lines. */}
        <XStack alignItems="center" py="$4" flexShrink={0}>
          <Icon
            name={
              isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
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
      gap="$4"
    >
      <SizableText size="$headingXl">
        {intl.formatMessage({
          id: ETranslations.market_chart_settings__events,
        })}
      </SizableText>
      {isLoading && events.length === 0 ? (
        <YStack gap="$5">
          <Skeleton width="100%" height={STOCK_EVENT_ROW_HEIGHT} />
          <Skeleton width="100%" height={STOCK_EVENT_ROW_HEIGHT} />
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
      {events.length > 0 ? (
        <YStack gap="$2">
          {upcomingEvents.map((event) => (
            <StockEventRow key={event.id} event={event} isPast={false} />
          ))}
          {pastEvents.length > 0 ? (
            <SizableText size="$bodyMd" color="$textSubdued" pt="$2">
              {intl.formatMessage({
                id: ETranslations.market_chart_settings__past_events,
              })}
            </SizableText>
          ) : null}
          {pastEvents.map((event) => (
            <StockEventRow key={event.id} event={event} isPast />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
