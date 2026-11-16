import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Button,
  ButtonFrame,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  type ILightweightChartProps,
  LightweightChart,
} from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swrCacheNamespaceName } from '@onekeyhq/shared/src/storage/SnapshotCache';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  swrCacheNamespaces,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { fetchPerpOiHistory } from '../../utils/fetchPerpOiHistory';
import { getPerpFundingTooltipPosition } from '../../utils/fundingChart';

import type { IPerpOiHistoryRange } from '../../utils/fetchPerpOiHistory';

const CHART_HEIGHT = 244;
const OI_CACHE_NAMESPACE = swrCacheNamespaces.perpsOiHistory;
const USE_WEB_SNAPSHOT_STORE = Platform.select({
  native: false,
  default: true,
});

type IOiHoverPoint = { time: number; price: number; x: number; y: number };

type IPerpOiHistoryResult = {
  requestKey: string;
  history?: Awaited<ReturnType<typeof fetchPerpOiHistory>>;
  refreshFailed?: boolean;
};

let webOiSnapshotRestore: Promise<void> | undefined;

function restoreWebOiSnapshots() {
  webOiSnapshotRestore ??= (async () => {
    const { primeWebUiSnapshotStore, readWebUiSnapshotEntriesFromIdb } =
      await import('@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore');
    const entries = await readWebUiSnapshotEntriesFromIdb({
      namespaces: [swrCacheNamespaceName(OI_CACHE_NAMESPACE)],
    });
    primeWebUiSnapshotStore(entries);
  })().catch(() => undefined);
  return webOiSnapshotRestore;
}

function formatOpenInterestUsd(value: number) {
  const formatted = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(value.toString(), { currency: '$' }),
  );
  return typeof formatted === 'string' ? formatted : '--';
}

export function PerpOiChart({
  coin,
  isActive,
  isMobile,
}: {
  coin: string;
  isActive: boolean;
  isMobile: boolean;
}) {
  const intl = useIntl();
  const timeZone = useDeviceTimeZone();
  const { formatDate } = useFormatDate();
  const [range, setRange] = useState<IPerpOiHistoryRange>('24h');
  const [chartWidth, setChartWidth] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState<IOiHoverPoint>();
  const requestKey = `${OI_CACHE_NAMESPACE}:rogue-iq-usd-v1:${coin}:${range}`;
  const pollingInterval = range === 'history' ? 60 * 60_000 : 5 * 60_000;
  const { result, isLoading, run, setResult } = usePromiseResult<
    IPerpOiHistoryResult | undefined
  >(
    async () => {
      if (!coin) return undefined;

      const history = await fetchPerpOiHistory(coin, range).catch(
        () => undefined,
      );
      return history
        ? { requestKey, history }
        : { requestKey, refreshFailed: true };
    },
    [coin, range, requestKey],
    {
      overrideIsFocused: (isFocused) => isFocused && isActive && Boolean(coin),
      revalidateOnFocus: true,
      watchLoading: true,
      pollingInterval: coin ? pollingInterval : undefined,
      runImmediatelyOnMount: true,
      runImmediatelyOnPollingIntervalChange: true,
      swrKey: coin ? requestKey : undefined,
      swrShouldPersist: (snapshot) =>
        Boolean(snapshot?.history?.data.length && !snapshot.refreshFailed),
    },
  );

  useEffect(() => {
    if (!USE_WEB_SNAPSHOT_STORE || !isActive || !coin) return;

    let isCurrent = true;
    void restoreWebOiSnapshots().then(() => {
      if (!isCurrent) return;
      const cached = swrCacheUtils.get<IPerpOiHistoryResult>(requestKey);
      if (!cached?.history?.data.length) return;

      setResult((previous) => {
        if (
          previous &&
          (previous.requestKey !== requestKey || previous.history?.data.length)
        ) {
          return previous;
        }
        return { ...cached, refreshFailed: Boolean(previous) };
      });
    });
    return () => {
      isCurrent = false;
    };
  }, [coin, isActive, requestKey, setResult]);

  const current = result?.requestKey === requestKey ? result : undefined;
  // Hydration and an empty or failed refresh can finish in either order.
  const cachedHistory =
    current && !current.history?.data.length
      ? swrCacheUtils.get<IPerpOiHistoryResult>(requestKey)?.history
      : undefined;
  const history = cachedHistory ?? current?.history;
  const data = history?.data;
  const historyStart = range === 'history' ? data?.[0]?.[0] : undefined;
  const lastSample = data?.at(-1)?.[0];
  const showLastSample =
    lastSample !== undefined &&
    (history?.stale ||
      cachedHistory !== undefined ||
      current?.refreshFailed ||
      Date.now() - lastSample * 1000 > 2 * pollingInterval);
  const title = intl.formatMessage({
    id: ETranslations.perp_token_bar_open_Interest,
  });
  const priceScaleMinimumWidth = isMobile ? 48 : 64;
  const tooltipWidth = Math.min(isMobile ? 144 : 200, chartWidth - 16);

  const handleHover = useCallback<
    NonNullable<ILightweightChartProps['onHover']>
  >(({ time, price, x, y }) => {
    if (
      time === undefined ||
      price === undefined ||
      x === undefined ||
      y === undefined ||
      ![time, price, x, y].every(Number.isFinite)
    ) {
      setHoveredPoint(undefined);
      return;
    }
    setHoveredPoint({ time, price, x, y });
  }, []);

  useEffect(() => {
    setHoveredPoint(undefined);
  }, [data, isActive]);

  const tooltipPosition =
    hoveredPoint && tooltipWidth > 0
      ? getPerpFundingTooltipPosition({
          x: hoveredPoint.x,
          y: hoveredPoint.y,
          chartWidth,
          chartHeight: CHART_HEIGHT,
          tooltipWidth,
          tooltipHeight: isMobile ? 52 : 56,
          leftPriceScaleWidth: priceScaleMinimumWidth,
          offset: 10,
        })
      : undefined;

  const waiting = Boolean(coin && (!current || isLoading));
  const failed = Boolean(current && !history);
  const ranges: Array<{ key: IPerpOiHistoryRange; label: string }> = [
    { key: '24h', label: '24H' },
    { key: '7d', label: '7D' },
    {
      key: 'history',
      label: intl.formatMessage({ id: ETranslations.global_history }),
    },
  ];

  return (
    <YStack
      testID="perp-open-interest-chart"
      mt={isMobile ? '$8' : '$5'}
      p={isMobile ? '$2' : '$3'}
      borderWidth={isMobile ? 0 : '$px'}
      borderColor="$borderSubdued"
      borderRadius="$3"
      gap="$2"
    >
      <SizableText size="$headingMd">{title}</SizableText>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        mb="$2"
        flexWrap="wrap"
      >
        <XStack gap="$1">
          {ranges.map(({ key, label }) => (
            <ButtonFrame
              key={key}
              testID={`perp-oi-range-${key}`}
              minWidth="$8"
              px="$2"
              py="$1"
              borderWidth={0}
              borderRadius="$2"
              bg={range === key ? '$bgActive' : 'transparent'}
              hoverStyle={{ bg: range === key ? '$bgActive' : '$bgHover' }}
              aria-pressed={range === key}
              onPress={() => setRange(key)}
              cursor="pointer"
            >
              <SizableText
                size="$bodySmMedium"
                color={range === key ? '$text' : '$textSubdued'}
              >
                {label}
              </SizableText>
            </ButtonFrame>
          ))}
        </XStack>
        {historyStart || showLastSample ? (
          <XStack alignItems="center" gap="$2">
            {historyStart ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatDate(historyStart * 1000, {
                  dateStyle: 'medium',
                  timeZone,
                })}
              </SizableText>
            ) : null}
            {showLastSample ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.market_last_updated,
                })}{' '}
                {formatDate(new Date(lastSample * 1000), {
                  hideSeconds: true,
                  timeZone,
                })}
              </SizableText>
            ) : null}
          </XStack>
        ) : null}
      </XStack>
      {data?.length ? (
        <YStack
          testID="perp-oi-plot"
          position="relative"
          onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        >
          <LightweightChart
            data={data}
            height={CHART_HEIGHT}
            lineWidth={2}
            priceFormatter={formatOpenInterestUsd}
            priceScalePosition="left"
            priceScaleMinimumWidth={priceScaleMinimumWidth}
            showHorzGridLines
            showPriceScale
            showLastValue
            showLastValuePriceLine
            timeZone={timeZone}
            locale={intl.locale}
            hideCrosshairPriceLabel
            preserveChartInstanceOnDataChange
            onHover={handleHover}
          />
          {hoveredPoint && tooltipPosition ? (
            <YStack
              testID="perp-oi-tooltip"
              position="absolute"
              zIndex={100}
              left={tooltipPosition.left}
              top={tooltipPosition.top}
              width={tooltipWidth}
              px={isMobile ? '$2' : '$3'}
              py={isMobile ? '$1' : '$2'}
              gap="$1"
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              pointerEvents="none"
            >
              <SizableText size="$bodyXs" color="$textDisabled">
                {formatDate(new Date(hoveredPoint.time * 1000), {
                  hideYear: true,
                  hideSeconds: true,
                  timeZone,
                })}
              </SizableText>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
              >
                <SizableText
                  flex={1}
                  size="$bodyXs"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {title}
                </SizableText>
                <SizableText
                  flexShrink={0}
                  size={isMobile ? '$bodyXsMedium' : '$bodySmMedium'}
                  fontVariant={['tabular-nums']}
                >
                  {formatOpenInterestUsd(hoveredPoint.price)}
                </SizableText>
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        <YStack
          height={CHART_HEIGHT}
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          {waiting ? <Spinner /> : null}
          {!waiting && failed ? (
            <>
              <SizableText color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.global_network_error })}
              </SizableText>
              <Button
                testID="perp-oi-retry"
                size="small"
                variant="secondary"
                onPress={() => void run()}
              >
                {intl.formatMessage({ id: ETranslations.global_try_again })}
              </Button>
            </>
          ) : null}
          {!waiting && !failed ? (
            <SizableText color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_no_data })}
            </SizableText>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}
