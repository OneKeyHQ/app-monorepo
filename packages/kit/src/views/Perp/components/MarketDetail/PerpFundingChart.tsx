import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
} from '@onekeyhq/components';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { usePerpFundingHistory } from '../../hooks/usePerpMarketDetail';
import {
  type IPerpFundingChartInterval,
  PERP_DATA_CHART_HEIGHT,
  buildPerpFundingChartData,
  getPerpFundingTooltipPosition,
} from '../../utils/fundingChart';

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

const FUNDING_POSITIVE_COLOR = '#31E72F';
const FUNDING_NEGATIVE_COLOR = '#EF4444';
const CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const FUNDING_CHART_AREA_FILL_ALPHA = 0.2;
const FUNDING_CHART_BASE_FILL_ALPHA = 0.04;
const DESKTOP_TOOLTIP_WIDTH = 200;
const MOBILE_TOOLTIP_WIDTH = 144;
const MOBILE_CUMULATIVE_TOOLTIP_WIDTH = 160;
const TOOLTIP_HEIGHT = 72;
const CUMULATIVE_TOOLTIP_HEIGHT = 92;
const MOBILE_TOOLTIP_HEIGHT = 52;
const MOBILE_CUMULATIVE_TOOLTIP_HEIGHT = 72;
const TOOLTIP_PADDING = 8;
const DESKTOP_CHART_FONT_SIZE = 11;
const MOBILE_CHART_FONT_SIZE = 9;
const DESKTOP_PRICE_SCALE_MINIMUM_WIDTH = 64;
const MOBILE_PRICE_SCALE_MINIMUM_WIDTH = 48;
const EMPTY_FUNDING_HISTORY: IFundingHistoryRecord[] = [];

function formatFundingPercent(value: number) {
  const normalizedValue = Math.abs(value) < 0.000_000_1 ? 0 : value;
  return `${normalizedValue.toFixed(Math.abs(normalizedValue) < 0.1 ? 4 : 2)}%`;
}

function getFundingChartFillColor(color: string, alpha: number) {
  const parsedColor = colord(color);
  return parsedColor.isValid() ? parsedColor.alpha(alpha).toRgbString() : color;
}

function createFundingBaselineOptions({
  palette,
}: {
  palette: IFundingChartPalette;
}): BaselineSeriesPartialOptions {
  return {
    baseValue: { type: 'price', price: 0 },
    topLineColor: palette.positive,
    topFillColor1: getFundingChartFillColor(
      palette.positive,
      FUNDING_CHART_AREA_FILL_ALPHA,
    ),
    topFillColor2: getFundingChartFillColor(
      palette.positive,
      FUNDING_CHART_BASE_FILL_ALPHA,
    ),
    bottomLineColor: palette.negative,
    bottomFillColor1: getFundingChartFillColor(
      palette.negative,
      FUNDING_CHART_BASE_FILL_ALPHA,
    ),
    bottomFillColor2: getFundingChartFillColor(
      palette.negative,
      FUNDING_CHART_AREA_FILL_ALPHA,
    ),
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
  testID,
  data,
  isLoading,
  label,
  tooltipLabel,
  description,
  interval,
  onIntervalChange,
  palette,
  baselineOptions,
  lineWidth = 2,
  periodFundingRateData,
  showLastValue = true,
  timeZone,
  variant,
  legendPositiveLabel,
  legendNegativeLabel,
}: {
  testID: string;
  data: IMarketTokenChart;
  isLoading: boolean;
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
  const { formatDate } = useFormatDate();
  const isMobile = variant === 'mobile';
  const hasData = data.length > 1;
  const [chartWidth, setChartWidth] = useState(0);
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
    Math.max(0, chartWidth - TOOLTIP_PADDING * 2),
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
          chartWidth,
          chartHeight: PERP_DATA_CHART_HEIGHT,
          tooltipWidth,
          tooltipHeight,
          leftPriceScaleWidth: priceScaleMinimumWidth,
          offset: 10,
          padding: TOOLTIP_PADDING,
        })
      : undefined;

  return (
    <YStack
      testID={testID}
      flexGrow={isMobile ? 0 : 1}
      flexShrink={isMobile ? 0 : 1}
      flexBasis={isMobile ? undefined : 480}
      width={isMobile ? '100%' : undefined}
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
        height={PERP_DATA_CHART_HEIGHT}
        flexShrink={0}
        position="relative"
        overflow="hidden"
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
            height={PERP_DATA_CHART_HEIGHT}
            lineColor={palette.positive}
            lineWidth={isMobile ? lineWidth : Math.max(lineWidth, 2)}
            showPriceScale
            priceScalePosition="left"
            showHorzGridLines
            priceScaleMargins={CHART_PRICE_SCALE_MARGINS}
            priceScaleMinimumWidth={priceScaleMinimumWidth}
            priceFormatter={formatFundingPercent}
            priceFormatterPrecision={4}
            fontSize={
              isMobile ? MOBILE_CHART_FONT_SIZE : DESKTOP_CHART_FONT_SIZE
            }
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
        {hasData && hoveredData && tooltipPosition ? (
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
              {formatDate(new Date(hoveredData.time * 1000), {
                hideYear: true,
                hideSeconds: true,
                timeZone,
              })}
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
    }),
    [theme.bgAccent?.val, theme.bgCriticalStrong?.val],
  );
  const baselineOptions = useMemo(
    () =>
      createFundingBaselineOptions({
        palette: chartPalette,
      }),
    [chartPalette],
  );
  const isFundingLoading = fundingHistory.isLoading !== false;
  const content = (
    <YStack
      width="100%"
      pl={isMobile ? '$2' : '$5'}
      pr="$5"
      pt={isMobile ? '$5' : '$6'}
      pb="$4"
    >
      <YStack alignItems="stretch" justifyContent="flex-start">
        <XStack
          width="100%"
          gap={isMobile ? '$8' : '$5'}
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
