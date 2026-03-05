import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Divider,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { UTCTimestamp } from 'lightweight-charts';

type IApyHistoryItem = {
  timestamp: number;
  apy: string;
};

type IChartTimePeriod = '1h' | '1d' | '1w' | 'max';

interface IApyChartProps {
  apyHistory?: IApyHistoryItem[] | null;
  underlyingApyHistory?: IApyHistoryItem[] | null;
  showChartControls?: boolean;
  showUnderlyingApyToggle?: boolean;
  primaryApyLabel?: string;
  secondaryApyLabel?: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

function normalizeHistory(history?: IApyHistoryItem[] | null) {
  if (!history?.length) {
    return [];
  }

  return history
    .map((item) => ({
      timestamp: Number(item.timestamp),
      apy: Number(item.apy),
    }))
    .filter(
      (item) => Number.isFinite(item.timestamp) && Number.isFinite(item.apy),
    )
    .toSorted((a, b) => a.timestamp - b.timestamp);
}

function toUtcDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function toUtcWeekKey(timestamp: number) {
  const date = new Date(timestamp);
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return utcDate.getTime().toString();
}

function aggregateByPeriod(
  history: Array<{ timestamp: number; apy: number }>,
  period: '1d' | '1w',
) {
  const bucket = new Map<string, { timestamp: number; apy: number }>();

  history.forEach((item) => {
    const key =
      period === '1d'
        ? toUtcDateKey(item.timestamp)
        : toUtcWeekKey(item.timestamp);
    bucket.set(key, item);
  });

  return Array.from(bucket.values()).toSorted(
    (a, b) => a.timestamp - b.timestamp,
  );
}

function filterByTimeWindow(
  history: Array<{ timestamp: number; apy: number }>,
  windowMs: number,
) {
  if (!history.length) {
    return [];
  }

  const latestTimestamp = history[history.length - 1].timestamp;
  const minTimestamp = latestTimestamp - windowMs;
  return history.filter((item) => item.timestamp >= minTimestamp);
}

function buildChartHistory(
  history: IApyHistoryItem[] | null | undefined,
  period: IChartTimePeriod,
) {
  const normalized = normalizeHistory(history);

  if (!normalized.length) {
    return [];
  }

  if (period === '1h') {
    return filterByTimeWindow(normalized, SEVEN_DAYS_MS);
  }

  if (period === '1d') {
    return filterByTimeWindow(
      aggregateByPeriod(normalized, '1d'),
      THIRTY_DAYS_MS,
    );
  }

  if (period === '1w') {
    return filterByTimeWindow(aggregateByPeriod(normalized, '1w'), ONE_YEAR_MS);
  }

  return normalized;
}

const ApyChartComponent = ({
  apyHistory,
  underlyingApyHistory,
  showChartControls,
  showUnderlyingApyToggle,
  primaryApyLabel,
  secondaryApyLabel,
}: IApyChartProps) => {
  const intl = useIntl();

  const resolvedPrimaryLabel =
    primaryApyLabel || intl.formatMessage({ id: ETranslations.global_apy });
  const resolvedSecondaryLabel =
    secondaryApyLabel || intl.formatMessage({ id: ETranslations.global_apy });

  const [timePeriod, setTimePeriod] = useState<IChartTimePeriod>(
    showChartControls ? '1h' : 'max',
  );
  const [showUnderlyingApy, setShowUnderlyingApy] = useState(false);

  // Hover state for popover
  const [hoverData, setHoverData] = useState<{
    time: number;
    apy: number;
    secondaryApy?: number;
    x: number;
    y: number;
  } | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!showUnderlyingApyToggle) {
      setShowUnderlyingApy(false);
    }
  }, [showUnderlyingApyToggle]);

  const handleHover = useCallback(
    ({
      time,
      price,
      secondaryPrice,
      x,
      y,
    }: {
      time?: number;
      price?: number;
      secondaryPrice?: number;
      x?: number;
      y?: number;
    }) => {
      if (time && price && x !== undefined && y !== undefined) {
        setHoverData({
          time,
          apy: price,
          secondaryApy: secondaryPrice,
          x,
          y,
        });
      } else {
        setHoverData(null);
      }
    },
    [],
  );

  // Calculate popover position - switch side at midpoint
  const popoverPosition = useMemo(() => {
    if (!hoverData || !containerWidth) return null;

    const POPOVER_WIDTH = 144;
    const OFFSET = 10;
    const EDGE_PADDING = 16;
    const isLeftHalf = hoverData.x < containerWidth / 2;

    const translateXValue = isLeftHalf ? 0 : -POPOVER_WIDTH;
    const desiredLeft = isLeftHalf
      ? hoverData.x + OFFSET
      : hoverData.x - OFFSET;
    const minLeft = EDGE_PADDING;
    const maxLeft = Math.max(
      minLeft,
      containerWidth - POPOVER_WIDTH - EDGE_PADDING,
    );
    const actualLeft = desiredLeft + translateXValue;
    const clampedActualLeft = Math.min(Math.max(actualLeft, minLeft), maxLeft);

    return {
      left: clampedActualLeft - translateXValue,
      translateXValue,
      top: Math.max(10, hoverData.y - 70),
    };
  }, [hoverData, containerWidth]);

  const formatPopoverDate = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      const dateString = intl.formatDate(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeString = intl.formatTime(date, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${dateString} ${timeString}`;
    },
    [intl],
  );

  const filteredApyHistory = useMemo(
    () => buildChartHistory(apyHistory, timePeriod),
    [apyHistory, timePeriod],
  );

  const filteredUnderlyingApyHistory = useMemo(
    () => buildChartHistory(underlyingApyHistory, timePeriod),
    [underlyingApyHistory, timePeriod],
  );

  const chartData = useMemo(() => {
    if (!filteredApyHistory.length) {
      return null;
    }

    const marketChartData: [UTCTimestamp, number][] = filteredApyHistory.map(
      (item) => [Math.floor(item.timestamp / 1000) as UTCTimestamp, item.apy],
    );

    const secondaryLineData: [UTCTimestamp, number][] =
      filteredUnderlyingApyHistory.map((item) => [
        Math.floor(item.timestamp / 1000) as UTCTimestamp,
        item.apy,
      ]);

    return {
      marketChartData,
      secondaryLineData,
    };
  }, [filteredApyHistory, filteredUnderlyingApyHistory]);

  const isLoading = apyHistory === undefined;

  const timePeriodOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.market_1h }),
        value: '1h' as IChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1d }),
        value: '1d' as IChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1w }),
        value: '1w' as IChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_max }),
        value: 'max' as IChartTimePeriod,
      },
    ],
    [intl],
  );

  return (
    <YStack gap="$2">
      {showChartControls ? (
        <YStack gap="$2">
          <XStack ai="center" gap="$3" minHeight={44}>
            <XStack flex={1} />

            <SegmentControl
              value={timePeriod}
              options={timePeriodOptions}
              onChange={(nextValue) =>
                setTimePeriod(nextValue as IChartTimePeriod)
              }
              slotBackgroundColor="$bg"
              activeBackgroundColor="$bgActive"
              activeTextColor="$text"
            />
          </XStack>

          {showUnderlyingApyToggle ? (
            <Checkbox
              value={showUnderlyingApy}
              onChange={(value) => setShowUnderlyingApy(Boolean(value))}
              label={intl.formatMessage({
                id: ETranslations.defi_show_underlying_apy,
              })}
              containerProps={{
                ai: 'center',
              }}
              labelContainerProps={{
                py: '$0',
                my: '$0',
                justifyContent: 'center',
              }}
              labelProps={{
                variant: '$bodyMd',
              }}
            />
          ) : null}
        </YStack>
      ) : null}

      {isLoading && !chartData ? (
        <Stack
          $gtMd={{ height: 200 }}
          $md={{ height: 180 }}
          $sm={{ height: 160 }}
          height={160}
          position="relative"
          overflow="hidden"
          animation="quick"
          enterStyle={{ opacity: 0 }}
        >
          <Skeleton w="100%" h="100%" borderRadius="$2" />
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height="60%"
            opacity={0.3}
          >
            <Skeleton w="100%" h="100%" borderRadius="$2" />
          </Stack>
        </Stack>
      ) : null}

      {chartData && !isLoading ? (
        <YStack
          position="relative"
          animation="quick"
          enterStyle={{ opacity: 0, scale: 0.98 }}
          exitStyle={{ opacity: 0, scale: 0.98 }}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width !== containerWidth) {
              setContainerWidth(width);
            }
          }}
        >
          {hoverData && popoverPosition ? (
            <YStack
              position="absolute"
              top={popoverPosition.top}
              left={popoverPosition.left}
              transform={[{ translateX: popoverPosition.translateXValue }]}
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              px="$3"
              py="$2"
              shadowColor="$shadowDefault"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              zIndex={9999}
              pointerEvents="none"
              width={144}
              overflow="hidden"
            >
              <YStack gap="$2" width="100%">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {formatPopoverDate(hoverData.time)}
                </SizableText>
                <XStack jc="space-between" ai="center" width="100%">
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {resolvedPrimaryLabel}
                  </SizableText>
                  <SizableText size="$bodySmMedium" color="$text">
                    {hoverData.apy.toFixed(2)}%
                  </SizableText>
                </XStack>
                {showUnderlyingApy && hoverData.secondaryApy !== undefined ? (
                  <XStack jc="space-between" ai="center" width="100%">
                    <SizableText size="$bodySmMedium" color="$textSubdued">
                      {resolvedSecondaryLabel}
                    </SizableText>
                    <SizableText size="$bodySmMedium" color="$text">
                      {hoverData.secondaryApy.toFixed(2)}%
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
            </YStack>
          ) : null}

          <LightweightChart
            data={chartData.marketChartData}
            secondaryLineData={
              showUnderlyingApy && showUnderlyingApyToggle
                ? chartData.secondaryLineData
                : undefined
            }
            secondaryLineColor="#0177E5"
            secondaryLineWidth={2}
            height={200}
            onHover={handleHover}
            lineColor="#008347D6"
            topColor="#00834726"
            bottomColor="#00834700"
            lineWidth={2}
            showPriceScale
            showHorzGridLines
          />
          <Divider mt="$8" />
        </YStack>
      ) : null}
    </YStack>
  );
};

export const ApyChart = memo(ApyChartComponent);
