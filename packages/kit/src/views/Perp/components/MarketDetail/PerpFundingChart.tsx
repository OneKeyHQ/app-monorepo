import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { colorTokens } from '@tamagui/themes';
import { colord } from 'colord';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  ScrollView,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';
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
  { key: '8h', label: '8h' },
  { key: '1d', label: 'D' },
];

const FUNDING_POSITIVE_COLOR = '#31E72F';
const FUNDING_NEGATIVE_COLOR = '#EF4444';
const CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const FUNDING_CHART_AREA_FILL_ALPHA = 0.18;
const DESKTOP_TOOLTIP_WIDTH = 200;
const MOBILE_TOOLTIP_WIDTH = 144;
const MOBILE_CUMULATIVE_TOOLTIP_WIDTH = 160;
const TOOLTIP_HEIGHT = 72;
const CUMULATIVE_TOOLTIP_HEIGHT = 92;
const MOBILE_TOOLTIP_HEIGHT = 52;
const MOBILE_CUMULATIVE_TOOLTIP_HEIGHT = 72;
const TOOLTIP_PADDING = 8;
const DESKTOP_CHART_PANEL_HEIGHT = 364;
const MOBILE_CHART_PANEL_HEIGHT = 384;
const DESKTOP_CHART_FONT_SIZE = 11;
const MOBILE_CHART_FONT_SIZE = 9;
const DESKTOP_PRICE_SCALE_MINIMUM_WIDTH = 64;
const MOBILE_PRICE_SCALE_MINIMUM_WIDTH = 48;
const EMPTY_FUNDING_HISTORY: IFundingHistoryRecord[] = [];

function formatFundingPercent(value: number) {
  const normalizedValue = Math.abs(value) < 0.000_000_1 ? 0 : value;
  return `${normalizedValue.toFixed(Math.abs(normalizedValue) < 0.1 ? 4 : 2)}%`;
}

function getFundingChartFillColor(color: string) {
  const parsedColor = colord(color);
  return parsedColor.isValid()
    ? parsedColor.alpha(FUNDING_CHART_AREA_FILL_ALPHA).toRgbString()
    : color;
}

function createFundingBaselineOptions({
  palette,
}: {
  palette: IFundingChartPalette;
}): BaselineSeriesPartialOptions {
  return {
    baseValue: { type: 'price', price: 0 },
    topLineColor: palette.positive,
    topFillColor1: getFundingChartFillColor(palette.positiveFill),
    topFillColor2: getFundingChartFillColor(palette.positiveFill),
    bottomLineColor: palette.negative,
    bottomFillColor1: getFundingChartFillColor(palette.negativeFill),
    bottomFillColor2: getFundingChartFillColor(palette.negativeFill),
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
  positiveFill: string;
  negativeFill: string;
};

type IFundingChartVariant = 'workspace' | 'mobile';

function FundingChartLegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <XStack alignItems="center" gap="$1">
      <YStack width={12} height={2} borderRadius="$full" bg={color} />
      <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

function FundingChartLegend({
  palette,
  positiveLabel,
  negativeLabel,
}: {
  palette: IFundingChartPalette;
  positiveLabel: string;
  negativeLabel: string;
}) {
  return (
    <XStack
      flexShrink={0}
      mt="$2"
      gap="$3"
      alignItems="center"
      justifyContent="center"
    >
      <FundingChartLegendItem color={palette.positive} label={positiveLabel} />
      <FundingChartLegendItem color={palette.negative} label={negativeLabel} />
    </XStack>
  );
}

function FundingTooltipRow({
  isMobile,
  label,
  value,
}: {
  isMobile: boolean;
  label: string;
  value: number;
}) {
  return (
    <XStack gap={isMobile ? '$2' : '$3'} justifyContent="space-between">
      <SizableText
        flex={1}
        minWidth={0}
        size="$bodyXs"
        lineHeight={isMobile ? 14 : undefined}
        color="$textSubdued"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </SizableText>
      <SizableText
        flexShrink={0}
        size={isMobile ? '$bodyXsMedium' : '$bodySmMedium'}
        lineHeight={isMobile ? 14 : undefined}
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
  tooltipLabel,
  description,
  interval,
  onIntervalChange,
  palette,
  baselineOptions,
  lineWidth = 1,
  periodFundingRateData,
  showLastValue = true,
  timeZone,
  variant,
  legendPositiveLabel,
  legendNegativeLabel,
}: {
  data: IMarketTokenChart;
  label: string;
  tooltipLabel: string;
  description: string;
  interval: IPerpFundingChartInterval;
  onIntervalChange: (interval: IPerpFundingChartInterval) => void;
  palette: IFundingChartPalette;
  baselineOptions: BaselineSeriesPartialOptions;
  lineWidth?: number;
  periodFundingRateData?: IMarketTokenChart;
  showLastValue?: boolean;
  timeZone: string;
  variant: IFundingChartVariant;
  legendPositiveLabel: string;
  legendNegativeLabel: string;
}) {
  const intl = useIntl();
  const isMobile = variant === 'mobile';
  const [chartSize, setChartSize] = useState({ width: 0, height: 180 });
  const [hoveredData, setHoveredData] = useState<
    IFundingChartHoverData | undefined
  >();
  const periodFundingRateByTime = useMemo(
    () => new Map(periodFundingRateData ?? []),
    [periodFundingRateData],
  );
  const priceScaleMinimumWidth = isMobile
    ? MOBILE_PRICE_SCALE_MINIMUM_WIDTH
    : DESKTOP_PRICE_SCALE_MINIMUM_WIDTH;
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intl.locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone,
      }),
    [intl.locale, timeZone],
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

  let preferredTooltipWidth = DESKTOP_TOOLTIP_WIDTH;
  if (isMobile) {
    preferredTooltipWidth = periodFundingRateData
      ? MOBILE_CUMULATIVE_TOOLTIP_WIDTH
      : MOBILE_TOOLTIP_WIDTH;
  }
  const tooltipWidth = Math.min(
    preferredTooltipWidth,
    Math.max(0, chartSize.width - TOOLTIP_PADDING * 2),
  );
  let tooltipHeight = periodFundingRateData
    ? CUMULATIVE_TOOLTIP_HEIGHT
    : TOOLTIP_HEIGHT;
  if (isMobile) {
    tooltipHeight = periodFundingRateData
      ? MOBILE_CUMULATIVE_TOOLTIP_HEIGHT
      : MOBILE_TOOLTIP_HEIGHT;
  }
  const tooltipPosition =
    hoveredData && tooltipWidth > 0
      ? getPerpFundingTooltipPosition({
          x: hoveredData.x,
          y: hoveredData.y,
          chartWidth: chartSize.width,
          chartHeight: chartSize.height,
          tooltipWidth,
          tooltipHeight,
          leftPriceScaleWidth: priceScaleMinimumWidth,
          offset: 10,
          padding: TOOLTIP_PADDING,
        })
      : undefined;

  return (
    <YStack
      flexGrow={isMobile ? 0 : 1}
      flexShrink={isMobile ? 0 : 1}
      flexBasis={isMobile ? undefined : 480}
      width={isMobile ? '100%' : undefined}
      height={isMobile ? MOBILE_CHART_PANEL_HEIGHT : DESKTOP_CHART_PANEL_HEIGHT}
      minHeight={
        isMobile ? MOBILE_CHART_PANEL_HEIGHT : DESKTOP_CHART_PANEL_HEIGHT
      }
      minWidth={isMobile ? 0 : 320}
      p={isMobile ? '$0' : '$3'}
      borderWidth={isMobile ? 0 : '$px'}
      borderColor="$borderSubdued"
      borderRadius={isMobile ? 0 : '$3'}
      overflow="hidden"
    >
      <YStack gap="$2" mb="$2" px={isMobile ? '$2' : undefined}>
        <XStack alignItems="center" gap="$1" pl={isMobile ? '$1' : undefined}>
          <SizableText size="$headingMd" color="$text">
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
          lineWidth={isMobile ? lineWidth : Math.max(lineWidth, 2)}
          showPriceScale
          priceScalePosition="left"
          showHorzGridLines
          priceScaleMargins={CHART_PRICE_SCALE_MARGINS}
          priceScaleMinimumWidth={priceScaleMinimumWidth}
          priceFormatter={formatFundingPercent}
          priceFormatterPrecision={4}
          fontSize={isMobile ? MOBILE_CHART_FONT_SIZE : DESKTOP_CHART_FONT_SIZE}
          seriesType="baseline"
          baselineOptions={baselineOptions}
          showLastValue={showLastValue}
          showTimeScale
          timeZone={timeZone}
          locale={intl.locale}
          hideCrosshairPriceLabel
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
            px={isMobile ? '$2' : '$3'}
            py={isMobile ? '$1' : '$2'}
            gap="$1"
            bg="$bg"
            borderRadius="$2"
            borderWidth={1}
            borderColor="$borderSubdued"
            pointerEvents="none"
          >
            <SizableText
              size="$bodyXs"
              lineHeight={isMobile ? 14 : undefined}
              color="$textDisabled"
              fontVariant={['tabular-nums']}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {dateTimeFormatter.format(new Date(hoveredData.time * 1000))}
            </SizableText>
            {hoveredData.periodFundingRate !== undefined ? (
              <FundingTooltipRow
                isMobile={isMobile}
                label={intl.formatMessage({
                  id: ETranslations.perp_funding_rate_short__title,
                })}
                value={hoveredData.periodFundingRate}
              />
            ) : null}
            <FundingTooltipRow
              isMobile={isMobile}
              label={tooltipLabel}
              value={hoveredData.value}
            />
          </YStack>
        ) : null}
      </YStack>
      <FundingChartLegend
        palette={palette}
        positiveLabel={legendPositiveLabel}
        negativeLabel={legendNegativeLabel}
      />
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
  const themeName = useThemeName();
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
  const chartPalette = useMemo(
    () => ({
      positive: theme.bgAccent?.val ?? FUNDING_POSITIVE_COLOR,
      negative: theme.bgCriticalStrong?.val ?? FUNDING_NEGATIVE_COLOR,
      positiveFill: colorTokens[themeName].green.green3,
      negativeFill: colorTokens[themeName].red.red3,
    }),
    [theme.bgAccent?.val, theme.bgCriticalStrong?.val, themeName],
  );
  const baselineOptions = useMemo(
    () =>
      createFundingBaselineOptions({
        palette: chartPalette,
      }),
    [chartPalette],
  );
  const isInitialLoading =
    fundingHistory.isLoading !== false && fundingRateData.length === 0;
  const isEmpty =
    fundingHistory.isLoading === false && fundingRateData.length < 2;
  const content = (
    <YStack
      width="100%"
      pl={isMobile ? '$2' : '$5'}
      pr="$5"
      pt={isMobile ? '$5' : '$6'}
      pb="$4"
    >
      <YStack alignItems="stretch" justifyContent="flex-start">
        {isInitialLoading ? <Spinner size="large" /> : null}
        {isEmpty ? (
          <SizableText textAlign="center" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_funding_rate_history_empty__desc,
            })}
          </SizableText>
        ) : null}
        {fundingRateData.length > 1 ? (
          <XStack
            width="100%"
            gap={isMobile ? '$8' : '$5'}
            alignItems="stretch"
            flexDirection={isMobile ? 'column' : 'row'}
            flexWrap={isMobile ? 'nowrap' : 'wrap'}
          >
            <FundingChartPanel
              data={fundingRateData}
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
              palette={chartPalette}
              baselineOptions={baselineOptions}
              showLastValue={false}
              timeZone={timeZone}
              variant={variant}
              legendPositiveLabel={intl.formatMessage({
                id: ETranslations.perp_positive_funding_rate__label,
              })}
              legendNegativeLabel={intl.formatMessage({
                id: ETranslations.perp_negative_funding_rate__label,
              })}
            />
            <FundingChartPanel
              data={cumulativeFundingRateData}
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
              palette={chartPalette}
              baselineOptions={baselineOptions}
              periodFundingRateData={cumulativePeriodFundingRateData}
              timeZone={timeZone}
              variant={variant}
              legendPositiveLabel={intl.formatMessage({
                id: ETranslations.perp_positive_funding_rate__label,
              })}
              legendNegativeLabel={intl.formatMessage({
                id: ETranslations.perp_negative_funding_rate__label,
              })}
            />
          </XStack>
        ) : null}
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
      showsVerticalScrollIndicator
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {content}
    </ScrollView>
  );
}
