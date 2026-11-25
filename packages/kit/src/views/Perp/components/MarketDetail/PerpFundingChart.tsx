import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  SizableText,
  Spinner,
  Theme,
  XStack,
  YStack,
  getTokenValue,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import type { ILightweightChartHistogramOptions } from '@onekeyhq/kit/src/components/LightweightChart/types';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { usePerpFundingHistory } from '../../hooks/usePerpMarketDetail';
import {
  type IPerpFundingChartInterval,
  buildPerpFundingChartData,
} from '../../utils/fundingChart';

import { PerpChartTooltip } from './PerpChartTooltip';
import { PerpOiChart } from './PerpOiChart';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

const FUNDING_INTERVAL_ITEMS: Array<{
  key: IPerpFundingChartInterval;
  label: string;
}> = [
  { key: '1h', label: '1h' },
  { key: '8h', label: '8h' },
  { key: '1d', label: 'D' },
];

const FUNDING_CHART_HEIGHT = 214;
const CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const CHART_FONT_SIZE = 11;
const EMPTY_FUNDING_HISTORY: IFundingHistoryRecord[] = [];

function formatFundingPercent(value: number) {
  const normalizedValue = Math.abs(value) < 0.000_000_1 ? 0 : value;
  return `${normalizedValue.toFixed(Math.abs(normalizedValue) < 0.1 ? 4 : 2)}%`;
}

type IFundingChartHoverData = {
  time: number;
  value: number;
  periodFundingRate?: number;
  x: number;
  y: number;
};

type IFundingChartColor = 'green9' | 'red9' | 'orange9';

type IFundingChartVariant = 'workspace' | 'mobile';

function FundingTooltipRow({
  color,
  label,
  value,
}: {
  color: IFundingChartColor;
  label: string;
  value: number;
}) {
  const themeName = useThemeName();
  return (
    <XStack gap="$2" alignItems="center">
      <Theme name={themeName === 'dark' ? 'light' : 'dark'}>
        <YStack width="$2" height="$2" borderRadius="$full" bg={`$${color}`} />
      </Theme>
      <SizableText
        flex={1}
        minWidth={0}
        size="$bodySm"
        color="$textInverse"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </SizableText>
      <SizableText
        flexShrink={0}
        size="$bodySmMedium"
        color="$textInverse"
        fontVariant={['tabular-nums']}
      >
        {formatFundingPercent(value)}
      </SizableText>
    </XStack>
  );
}

function FundingChartPanel({
  testID,
  data,
  isLoading,
  label,
  tooltipLabel,
  description,
  interval,
  onIntervalChange,
  color,
  baselineOptions,
  histogramOptions,
  seriesType,
  periodFundingRateData,
  timeZone,
  variant,
}: {
  testID: string;
  data: IMarketTokenChart;
  isLoading: boolean;
  label: string;
  tooltipLabel: string;
  description: string;
  interval: IPerpFundingChartInterval;
  onIntervalChange: (interval: IPerpFundingChartInterval) => void;
  color: IFundingChartColor;
  baselineOptions: BaselineSeriesPartialOptions;
  histogramOptions: ILightweightChartHistogramOptions;
  seriesType: 'histogram' | 'baseline';
  periodFundingRateData?: IMarketTokenChart;
  timeZone: string;
  variant: IFundingChartVariant;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const { formatDate } = useFormatDate();
  const isMobile = variant === 'mobile';
  const hasData = data.length > 1;
  const legendItems: { color: IFundingChartColor; label: string }[] =
    seriesType === 'histogram'
      ? [
          {
            color: 'green9',
            label: intl.formatMessage({
              id: ETranslations.perp_positive_funding_rate__label,
            }),
          },
          {
            color: 'red9',
            label: intl.formatMessage({
              id: ETranslations.perp_negative_funding_rate__label,
            }),
          },
        ]
      : [{ color, label: tooltipLabel }];
  const [chartWidth, setChartWidth] = useState(0);
  const [hoveredData, setHoveredData] = useState<
    IFundingChartHoverData | undefined
  >();
  const periodFundingRateByTime = useMemo(
    () => new Map(periodFundingRateData ?? []),
    [periodFundingRateData],
  );
  const handleChartHover = useCallback(
    ({
      time,
      price,
      x,
      y,
    }: {
      time?: number;
      price?: number;
      x?: number;
      y?: number;
    }) => {
      if (
        time === undefined ||
        price === undefined ||
        x === undefined ||
        y === undefined ||
        !Number.isFinite(time) ||
        !Number.isFinite(price) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        setHoveredData(undefined);
        return;
      }

      setHoveredData({
        time,
        value: price,
        periodFundingRate: periodFundingRateByTime.get(time),
        x,
        y,
      });
    },
    [periodFundingRateByTime],
  );

  useEffect(() => {
    setHoveredData(undefined);
  }, [data]);

  return (
    <YStack
      testID={testID}
      flexGrow={isMobile ? 0 : 1}
      flexShrink={isMobile ? 0 : 1}
      flexBasis={isMobile ? undefined : 480}
      width={isMobile ? '100%' : undefined}
      minWidth={isMobile ? 0 : 320}
      overflow="visible"
      zIndex={hoveredData ? 1 : 0}
    >
      <XStack
        gap="$2"
        mb="$4"
        minHeight="$10"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
      >
        <XStack flex={1} minWidth={160} alignItems="center" gap="$1">
          <SizableText size="$headingMd" color="$text" flexShrink={1}>
            {label}
          </SizableText>
          <InfoIcon
            size="$4"
            tooltip={{
              title: label,
              content: description,
            }}
          />
        </XStack>
        <XStack
          height={38}
          py="$1"
          gap="$0.5"
          alignItems="center"
          flexShrink={0}
        >
          {FUNDING_INTERVAL_ITEMS.map((item) => (
            <Button
              key={item.key}
              testID={`${testID}-interval-${item.key}`}
              size="small"
              height={30}
              m="$0"
              px="$2.5"
              borderWidth={0}
              flexShrink={0}
              borderRadius="$full"
              variant={interval === item.key ? 'secondary' : 'tertiary'}
              aria-pressed={interval === item.key}
              onPress={() => onIntervalChange(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </XStack>
      </XStack>
      <YStack
        height={FUNDING_CHART_HEIGHT}
        flexShrink={0}
        position="relative"
        overflow="visible"
        onLayout={(event) => {
          const nextWidth = Math.max(
            0,
            Math.floor(event.nativeEvent.layout.width),
          );
          setChartWidth(nextWidth);
        }}
      >
        {hasData ? (
          <LightweightChart
            data={data}
            height={FUNDING_CHART_HEIGHT}
            lineColor={theme[color].val}
            lineWidth={2}
            showPriceScale
            priceScalePosition="right"
            priceScaleMinimumWidth={60}
            priceScaleLabelAlign="right"
            showHorzGridLines
            horzLineColor={theme.neutral3.val}
            horzLineStyle={0}
            priceScaleMargins={CHART_PRICE_SCALE_MARGINS}
            priceFormatter={formatFundingPercent}
            priceFormatterPrecision={4}
            fontSize={CHART_FONT_SIZE}
            seriesType={seriesType}
            baselineOptions={
              seriesType === 'baseline' ? baselineOptions : undefined
            }
            histogramOptions={
              seriesType === 'histogram' ? histogramOptions : undefined
            }
            showLastValue={false}
            showTimeScale
            timeZone={timeZone}
            locale={intl.locale}
            hideCrosshairPriceLabel
            preserveChartInstanceOnDataChange
            onHover={handleChartHover}
          />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            {isLoading ? (
              <Spinner />
            ) : (
              <SizableText textAlign="center" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_funding_rate_history_empty__desc,
                })}
              </SizableText>
            )}
          </YStack>
        )}
        {hasData && hoveredData ? (
          <PerpChartTooltip
            testID={`${testID}-tooltip`}
            chartWidth={chartWidth}
            chartHeight={FUNDING_CHART_HEIGHT}
            x={hoveredData.x}
            y={hoveredData.y}
          >
            <SizableText
              size="$bodyXs"
              color="$textInverseSubdued"
              fontVariant={['tabular-nums']}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatDate(new Date(hoveredData.time * 1000), {
                hideYear: true,
                hideSeconds: true,
                timeZone,
              })}
            </SizableText>
            {hoveredData.periodFundingRate !== undefined ? (
              <FundingTooltipRow
                color={hoveredData.periodFundingRate >= 0 ? 'green9' : 'red9'}
                label={intl.formatMessage({
                  id: ETranslations.perp_funding_rate_short__title,
                })}
                value={hoveredData.periodFundingRate}
              />
            ) : null}
            <FundingTooltipRow
              color={
                seriesType === 'histogram' && hoveredData.value < 0
                  ? 'red9'
                  : color
              }
              label={tooltipLabel}
              value={hoveredData.value}
            />
          </PerpChartTooltip>
        ) : null}
      </YStack>
      <XStack
        testID={`${testID}-legend`}
        gap="$1"
        mt="$1"
        minHeight="$5"
        alignItems="center"
        justifyContent="center"
      >
        {legendItems.map((item) => (
          <XStack key={item.color} alignItems="center" gap="$1" mx="$1">
            <YStack
              width={7}
              height={7}
              borderRadius="$full"
              bg={theme[item.color].val}
            />
            <SizableText size="$bodyXs" color="$textSubdued">
              {item.label}
            </SizableText>
          </XStack>
        ))}
      </XStack>
    </YStack>
  );
}

export function PerpFundingChart({
  coin,
  isActive = true,
  variant = 'workspace',
}: {
  coin: string;
  isActive?: boolean;
  variant?: IFundingChartVariant;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const timeZone = useDeviceTimeZone();
  const [fundingInterval, setFundingInterval] =
    useState<IPerpFundingChartInterval>('8h');
  const [cumulativeInterval, setCumulativeInterval] =
    useState<IPerpFundingChartInterval>('8h');
  const fundingHistory = usePerpFundingHistory(coin, '90d');
  const { setStopPolling } = fundingHistory;
  const isMobile = variant === 'mobile';
  useEffect(() => {
    setStopPolling(!isActive);
  }, [isActive, setStopPolling]);
  const nextHistory = fundingHistory.result ?? EMPTY_FUNDING_HISTORY;
  const stableHistoryRef = useRef(nextHistory);
  if (!isEqual(stableHistoryRef.current, nextHistory)) {
    stableHistoryRef.current = nextHistory;
  }
  const history = stableHistoryRef.current;
  const fundingRateData = useMemo<IMarketTokenChart>(
    () =>
      buildPerpFundingChartData(history, fundingInterval).map(
        ({ time, fundingRate }) => [time, fundingRate],
      ),
    [fundingInterval, history],
  );
  const cumulativeChartPoints = useMemo(
    () => buildPerpFundingChartData(history, cumulativeInterval),
    [cumulativeInterval, history],
  );
  const cumulativeFundingRateData = useMemo<IMarketTokenChart>(
    () =>
      cumulativeChartPoints.map(({ time, cumulativeFundingRate }) => [
        time,
        cumulativeFundingRate,
      ]),
    [cumulativeChartPoints],
  );
  const cumulativePeriodFundingRateData = useMemo<IMarketTokenChart>(
    () =>
      cumulativeChartPoints.map(({ time, fundingRate }) => [time, fundingRate]),
    [cumulativeChartPoints],
  );
  const baselineOptions = useMemo<BaselineSeriesPartialOptions>(
    () => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: theme.orange9.val,
      bottomLineColor: theme.orange9.val,
      topFillColor1: 'transparent',
      topFillColor2: 'transparent',
      bottomFillColor1: 'transparent',
      bottomFillColor2: 'transparent',
    }),
    [theme.orange9.val],
  );
  const histogramOptions = useMemo<ILightweightChartHistogramOptions>(
    () => ({
      positiveColor: theme.green9.val,
      negativeColor: theme.red9.val,
      base: 0,
      barWidthRatio: 0.5,
      maxBarWidth: isMobile ? 22 : 28,
      borderRadius: getTokenValue('$1', 'radius') / 2,
    }),
    [isMobile, theme.green9.val, theme.red9.val],
  );
  const isFundingLoading = fundingHistory.isLoading !== false;
  const content = (
    <YStack width="100%" pl="$5" pr="$5" pt={isMobile ? '$5' : '$6'} pb="$4">
      <YStack alignItems="stretch" justifyContent="flex-start">
        <XStack
          width="100%"
          gap={isMobile ? '$8' : '$10'}
          alignItems="stretch"
          flexDirection={isMobile ? 'column' : 'row'}
          flexWrap={isMobile ? 'nowrap' : 'wrap'}
        >
          <FundingChartPanel
            testID="perp-funding-rate-chart"
            data={fundingRateData}
            isLoading={isFundingLoading}
            label={intl.formatMessage({
              id: ETranslations.perp_funding_rate_history__title,
            })}
            tooltipLabel={intl.formatMessage({
              id: ETranslations.perp_funding_rate_short__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.perp_funding_rate_chart__desc,
            })}
            interval={fundingInterval}
            onIntervalChange={setFundingInterval}
            color="green9"
            baselineOptions={baselineOptions}
            histogramOptions={histogramOptions}
            seriesType="histogram"
            timeZone={timeZone}
            variant={variant}
          />
          <FundingChartPanel
            testID="perp-cumulative-funding-rate-chart"
            data={cumulativeFundingRateData}
            isLoading={isFundingLoading}
            label={intl.formatMessage({
              id: ETranslations.perp_cumulative_funding_rate__title,
            })}
            tooltipLabel={intl.formatMessage({
              id: ETranslations.perp_cumulative_funding_rate_short__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.perp_cumulative_funding_rate_chart__desc,
            })}
            interval={cumulativeInterval}
            onIntervalChange={setCumulativeInterval}
            color="orange9"
            baselineOptions={baselineOptions}
            histogramOptions={histogramOptions}
            seriesType="baseline"
            periodFundingRateData={cumulativePeriodFundingRateData}
            timeZone={timeZone}
            variant={variant}
          />
        </XStack>
        <PerpOiChart coin={coin} isActive={isActive} isMobile={isMobile} />
      </YStack>
    </YStack>
  );

  if (isMobile) {
    return content;
  }

  return (
    <ScrollView
      testID="perp-funding-chart-scroll-view"
      flex={1}
      minHeight={0}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {content}
    </ScrollView>
  );
}
