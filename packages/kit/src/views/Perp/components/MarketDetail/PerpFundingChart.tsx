import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Spinner,
  Tooltip,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import {
  type ILightweightChartLineType,
  LightweightChart,
} from '@onekeyhq/kit/src/components/LightweightChart';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { usePerpFundingHistory } from '../../hooks/usePerpMarketDetail';
import {
  type IPerpFundingChartInterval,
  buildPerpFundingChartData,
  getPerpFundingTooltipPosition,
} from '../../utils/fundingChart';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

const FUNDING_INTERVAL_ITEMS: Array<{
  key: IPerpFundingChartInterval;
  label: string;
}> = [
  { key: '1h', label: '1h' },
  { key: '4h', label: '4h' },
  { key: '8h', label: '8h' },
  { key: '12h', label: '12h' },
  { key: '1d', label: 'D' },
];

const FUNDING_POSITIVE_COLOR = '#31E72F';
const FUNDING_NEGATIVE_COLOR = '#EF4444';
const CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const FUNDING_CHART_AREA_FILL_ALPHA = 0.1;
const CUMULATIVE_CHART_AREA_FILL_ALPHA = 0.18;
const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 72;
const CUMULATIVE_TOOLTIP_HEIGHT = 92;
const TOOLTIP_PADDING = 8;
const FUNDING_RATE_DESCRIPTION =
  'The funding rate for each selected interval. Positive rates mean long positions pay short positions; negative rates mean short positions pay long positions.';
const CUMULATIVE_FUNDING_RATE_DESCRIPTION =
  'The running sum of funding rates over the displayed period. It shows how funding has accumulated over time, not the funding paid by an individual account.';

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  const percentage = Math.round(alpha * 100);
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : hex;
  if (fullHex.length !== 6) {
    return `color-mix(in srgb, ${normalized} ${percentage}%, transparent)`;
  }

  const red = parseInt(fullHex.slice(0, 2), 16);
  const green = parseInt(fullHex.slice(2, 4), 16);
  const blue = parseInt(fullHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatFundingPercent(value: number) {
  const normalizedValue = Math.abs(value) < 0.000_000_1 ? 0 : value;
  return `${normalizedValue.toFixed(Math.abs(normalizedValue) < 0.1 ? 4 : 2)}%`;
}

function createFundingBaselineOptions({
  palette,
  fillAlpha,
}: {
  palette: IFundingChartPalette;
  fillAlpha: number;
}): BaselineSeriesPartialOptions {
  return {
    baseValue: { type: 'price', price: 0 },
    topLineColor: palette.positive,
    topFillColor1: colorWithAlpha(palette.positive, fillAlpha),
    topFillColor2: colorWithAlpha(palette.positive, fillAlpha),
    bottomLineColor: palette.negative,
    bottomFillColor1: colorWithAlpha(palette.negative, fillAlpha),
    bottomFillColor2: colorWithAlpha(palette.negative, fillAlpha),
  };
}

function FundingIntervalButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      minWidth="$8"
      px="$2"
      py="$1"
      justifyContent="center"
      borderRadius="$2"
      bg={active ? '$bgActive' : 'transparent'}
      onPress={onPress}
      cursor="pointer"
    >
      <SizableText
        size="$bodySmMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

type IFundingChartHoverData = {
  time: number;
  value: number;
  periodFundingRate?: number;
  x: number;
  y: number;
};

type IFundingChartPalette = {
  positive: string;
  negative: string;
};

function FundingTooltipRow({ label, value }: { label: string; value: number }) {
  return (
    <XStack gap="$3" justifyContent="space-between">
      <SizableText size="$bodyXs" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        color="$text"
        fontVariant={['tabular-nums']}
      >
        {formatFundingPercent(value)}
      </SizableText>
    </XStack>
  );
}

function FundingChartPanel({
  data,
  label,
  description,
  interval,
  onIntervalChange,
  palette,
  baselineOptions,
  lineType,
  lineWidth = 1,
  periodFundingRateData,
  showLastValue = true,
}: {
  data: IMarketTokenChart;
  label: string;
  description: string;
  interval: IPerpFundingChartInterval;
  onIntervalChange: (interval: IPerpFundingChartInterval) => void;
  palette: IFundingChartPalette;
  baselineOptions: BaselineSeriesPartialOptions;
  lineType?: ILightweightChartLineType;
  lineWidth?: number;
  periodFundingRateData?: IMarketTokenChart;
  showLastValue?: boolean;
}) {
  const intl = useIntl();
  const [chartSize, setChartSize] = useState({ width: 0, height: 180 });
  const [hoveredData, setHoveredData] = useState<
    IFundingChartHoverData | undefined
  >();
  const periodFundingRateByTime = useMemo(
    () => new Map(periodFundingRateData ?? []),
    [periodFundingRateData],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intl.locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    [intl.locale],
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

  const tooltipWidth = Math.min(
    TOOLTIP_WIDTH,
    Math.max(0, chartSize.width - TOOLTIP_PADDING * 2),
  );
  const tooltipPosition =
    hoveredData && tooltipWidth > 0
      ? getPerpFundingTooltipPosition({
          x: hoveredData.x,
          y: hoveredData.y,
          chartWidth: chartSize.width,
          chartHeight: chartSize.height,
          tooltipWidth,
          tooltipHeight: periodFundingRateData
            ? CUMULATIVE_TOOLTIP_HEIGHT
            : TOOLTIP_HEIGHT,
          offset: 10,
          padding: TOOLTIP_PADDING,
        })
      : undefined;

  return (
    <YStack
      flexGrow={1}
      flexShrink={1}
      flexBasis={480}
      height={340}
      minHeight={340}
      minWidth={320}
      p="$3"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <YStack gap="$2" mb="$2">
        <XStack alignItems="center" gap="$1">
          <SizableText size="$headingMd" color="$text">
            {label}
          </SizableText>
          <Tooltip
            placement="top-start"
            renderTrigger={
              <Icon
                name="InfoCircleOutline"
                size="$4"
                color="$iconSubdued"
                cursor="help"
              />
            }
            renderContent={description}
          />
        </XStack>
        <XStack gap="$1">
          {FUNDING_INTERVAL_ITEMS.map((item) => (
            <FundingIntervalButton
              key={item.key}
              active={interval === item.key}
              label={item.label}
              onPress={() => onIntervalChange(item.key)}
            />
          ))}
        </XStack>
      </YStack>
      <YStack
        flex={1}
        minHeight={0}
        position="relative"
        overflow="hidden"
        onLayout={(event) => {
          const nextWidth = Math.max(
            0,
            Math.floor(event.nativeEvent.layout.width),
          );
          const nextHeight = Math.max(
            100,
            Math.floor(event.nativeEvent.layout.height),
          );
          setChartSize((currentSize) =>
            currentSize.width === nextWidth && currentSize.height === nextHeight
              ? currentSize
              : { width: nextWidth, height: nextHeight },
          );
        }}
      >
        <LightweightChart
          data={data}
          height={chartSize.height}
          lineColor={palette.positive}
          lineWidth={lineWidth}
          lineType={lineType}
          showPriceScale
          priceScalePosition="left"
          showHorzGridLines
          priceScaleMargins={CHART_PRICE_SCALE_MARGINS}
          priceScaleMinimumWidth={64}
          priceFormatter={formatFundingPercent}
          fontSize={11}
          seriesType="baseline"
          baselineOptions={baselineOptions}
          showLastValue={showLastValue}
          showTimeScale
          preserveChartInstanceOnDataChange
          onHover={handleChartHover}
        />
        {hoveredData && tooltipPosition ? (
          <YStack
            position="absolute"
            zIndex={100}
            left={tooltipPosition.left}
            top={tooltipPosition.top}
            width={tooltipWidth}
            px="$3"
            py="$2"
            gap="$1"
            bg="$bg"
            borderRadius="$2"
            borderWidth={1}
            borderColor="$borderSubdued"
            pointerEvents="none"
          >
            <SizableText
              size="$bodyXs"
              color="$textDisabled"
              fontVariant={['tabular-nums']}
            >
              {dateTimeFormatter.format(new Date(hoveredData.time * 1000))}
            </SizableText>
            {hoveredData.periodFundingRate !== undefined ? (
              <FundingTooltipRow
                label="Funding Rate"
                value={hoveredData.periodFundingRate}
              />
            ) : null}
            <FundingTooltipRow label={label} value={hoveredData.value} />
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

export function PerpFundingChart({ coin }: { coin: string }) {
  const intl = useIntl();
  const theme = useTheme();
  const [fundingInterval, setFundingInterval] =
    useState<IPerpFundingChartInterval>('8h');
  const [cumulativeInterval, setCumulativeInterval] =
    useState<IPerpFundingChartInterval>('8h');
  const fundingHistory = usePerpFundingHistory(coin, '30d');
  const history = useMemo(
    () => fundingHistory.result ?? [],
    [fundingHistory.result],
  );
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
  const chartPalette = useMemo(
    () => ({
      positive: theme.bgAccent?.val ?? FUNDING_POSITIVE_COLOR,
      negative: theme.bgCriticalStrong?.val ?? FUNDING_NEGATIVE_COLOR,
    }),
    [theme.bgAccent?.val, theme.bgCriticalStrong?.val],
  );
  const fundingBaselineOptions = useMemo(
    () =>
      createFundingBaselineOptions({
        palette: chartPalette,
        fillAlpha: FUNDING_CHART_AREA_FILL_ALPHA,
      }),
    [chartPalette],
  );
  const cumulativeBaselineOptions = useMemo(
    () =>
      createFundingBaselineOptions({
        palette: chartPalette,
        fillAlpha: CUMULATIVE_CHART_AREA_FILL_ALPHA,
      }),
    [chartPalette],
  );
  return (
    <YStack flex={1} minHeight={0} px="$5" pt="$6" pb="$4">
      <YStack
        flex={1}
        minHeight={0}
        alignItems="stretch"
        justifyContent="flex-start"
      >
        {fundingHistory.isLoading && fundingRateData.length === 0 ? (
          <Spinner size="large" />
        ) : null}
        {!fundingHistory.isLoading && fundingRateData.length < 2 ? (
          <SizableText textAlign="center" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_market_info_data_unavailable__desc,
            })}
          </SizableText>
        ) : null}
        {fundingRateData.length > 1 ? (
          <XStack width="100%" gap="$5" alignItems="flex-start" flexWrap="wrap">
            <FundingChartPanel
              data={fundingRateData}
              label="Funding Rate"
              description={FUNDING_RATE_DESCRIPTION}
              interval={fundingInterval}
              onIntervalChange={setFundingInterval}
              palette={chartPalette}
              baselineOptions={fundingBaselineOptions}
              showLastValue={false}
            />
            <FundingChartPanel
              data={cumulativeFundingRateData}
              label="Cumulative Funding Rate"
              description={CUMULATIVE_FUNDING_RATE_DESCRIPTION}
              interval={cumulativeInterval}
              onIntervalChange={setCumulativeInterval}
              palette={chartPalette}
              baselineOptions={cumulativeBaselineOptions}
              lineType="steps"
              lineWidth={1}
              periodFundingRateData={cumulativePeriodFundingRateData}
            />
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
