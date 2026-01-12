import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { LineType, createChart } from 'lightweight-charts';

import { Skeleton, Stack, YStack } from '@onekeyhq/components';
import type { ILightweightChartTheme } from '@onekeyhq/kit/src/components/LightweightChart/types';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from '@onekeyhq/kit/src/components/LightweightChart/utils/chartOptions';

import {
  BASE_TIMESTAMP,
  CHART_HEIGHT,
  INTEREST_RATE_CHART_COLORS,
  InterestRateModelHeader,
  InterestRateModelLegend,
  InterestRateModelTooltip,
  UTILIZATION_RANGE,
  calculatePopoverPosition,
  convertTimeToUtilization,
  convertUtilizationToTime,
  normalizeApyToPercent,
  normalizeUtilization,
  useInterestRateModelLabels,
} from './InterestRateModelChartShared';

import type {
  IHoverData,
  IInterestRateModelChartProps,
} from './InterestRateModelChartShared';
import type {
  BusinessDay,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';

const getUtilizationLineTimeDelta = (timeValue: number) =>
  Math.max(Number.EPSILON * timeValue, Number.EPSILON);

const toTimestamp = (value: number) => value as UTCTimestamp;

export function InterestRateModelChart({
  borrowCurve,
  supplyCurve,
  utilizationRatio,
  isLoading,
}: IInterestRateModelChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const supplySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const borrowSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const theme = useTheme();

  const [hoverData, setHoverData] = useState<IHoverData | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const {
    utilizationRatioLabel,
    currentUtilizationLabel,
    supplyApyLabel,
    borrowApyLabel,
  } = useInterestRateModelLabels();

  const handleCrosshairMove = useCallback(
    (param: {
      time?: UTCTimestamp | BusinessDay;
      point?: { x: number; y: number };
      seriesPrices?: Map<ISeriesApi<'Area'>, number>;
    }) => {
      if (
        param.time &&
        param.point &&
        supplySeriesRef.current &&
        borrowSeriesRef.current
      ) {
        const supplyPrice = param.seriesPrices?.get(supplySeriesRef.current);
        const borrowPrice = param.seriesPrices?.get(borrowSeriesRef.current);

        if (supplyPrice !== undefined && borrowPrice !== undefined) {
          const timeValue =
            typeof param.time === 'number' ? param.time : Number(param.time);
          const util = convertTimeToUtilization(timeValue);
          setHoverData({
            utilizationRatio: util,
            supplyApy: supplyPrice,
            borrowApy: borrowPrice,
            x: param.point.x,
            y: param.point.y,
          });
          return;
        }
      }
      setHoverData(null);
    },
    [],
  );

  const popoverPosition = useMemo(
    () =>
      hoverData
        ? calculatePopoverPosition(hoverData.x, hoverData.y, containerWidth)
        : null,
    [hoverData, containerWidth],
  );

  // Create theme configs for both series
  const createTheme = useCallback(
    (
      lineColor: string,
      topColor: string,
      bottomColor: string,
    ): ILightweightChartTheme => ({
      bgColor: 'transparent',
      textColor: theme.text?.val || '#000000',
      textSubduedColor: theme.textSubdued?.val || '#666666',
      lineColor,
      topColor,
      bottomColor,
    }),
    [theme.text?.val, theme.textSubdued?.val],
  );

  const supplyTheme = useMemo(
    () =>
      createTheme(
        INTEREST_RATE_CHART_COLORS.supply.line,
        INTEREST_RATE_CHART_COLORS.supply.top,
        INTEREST_RATE_CHART_COLORS.supply.bottom,
      ),
    [createTheme],
  );

  const borrowTheme = useMemo(
    () =>
      createTheme(
        INTEREST_RATE_CHART_COLORS.borrow.line,
        INTEREST_RATE_CHART_COLORS.borrow.top,
        INTEREST_RATE_CHART_COLORS.borrow.bottom,
      ),
    [createTheme],
  );

  // Convert curve data to LightweightChart format
  const chartData = useMemo(() => {
    if (!borrowCurve.length || !supplyCurve.length) {
      return { supplyData: [], borrowData: [] };
    }

    const supplyData = supplyCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(
        normalizeUtilization(util),
      ) as UTCTimestamp,
      value: normalizeApyToPercent(parseFloat(apy)),
    }));

    const borrowData = borrowCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(
        normalizeUtilization(util),
      ) as UTCTimestamp,
      value: normalizeApyToPercent(parseFloat(apy)),
    }));

    return { supplyData, borrowData };
  }, [borrowCurve, supplyCurve]);

  useEffect(() => {
    if (
      !chartContainerRef.current ||
      !chartData.supplyData.length ||
      !chartData.borrowData.length
    ) {
      return undefined;
    }

    const container = chartContainerRef.current;

    // Create chart with custom time scale formatter and grid lines
    const baseOptions = createChartOptions(supplyTheme, true);
    const chart = createChart(container, {
      ...baseOptions,
      width: container.clientWidth,
      height: CHART_HEIGHT,
      grid: {
        vertLines: {
          visible: false,
        },
        horzLines: {
          visible: true,
          color: theme.borderSubdued?.val || '#E5E5EA',
          style: 2,
        },
      },
      rightPriceScale: {
        ...baseOptions.rightPriceScale,
        borderVisible: false,
      },
      timeScale: {
        ...baseOptions.timeScale,
        tickMarkFormatter: (time: UTCTimestamp | BusinessDay) => {
          const timeValue = typeof time === 'number' ? time : Number(time);
          const util = convertTimeToUtilization(timeValue);
          return `${Math.round(util * 100)}%`;
        },
      },
    });

    // Add supply series
    const supplySeries = chart.addAreaSeries(
      createAreaSeriesOptions(supplyTheme, 2),
    );
    supplySeries.setData(chartData.supplyData);
    supplySeriesRef.current = supplySeries;

    // Add borrow series
    const borrowSeries = chart.addAreaSeries(
      createAreaSeriesOptions(borrowTheme, 2),
    );
    borrowSeries.setData(chartData.borrowData);
    borrowSeriesRef.current = borrowSeries;

    // Subscribe to crosshair move for tooltip
    chart.subscribeCrosshairMove((param) => {
      handleCrosshairMove({
        time: param.time,
        point: param.point,
        seriesPrices: param.seriesPrices as
          | Map<ISeriesApi<'Area'>, number>
          | undefined,
      });
    });

    // Add current utilization vertical line marker if available
    if (utilizationRatio) {
      const currentUtilRatio = normalizeUtilization(
        parseFloat(utilizationRatio),
      );
      const currentUtilTime = convertUtilizationToTime(currentUtilRatio);
      const iconSubduedColor = theme.iconSubdued?.val || '#8C8CA1';

      // Find the max value to draw the line from bottom to top
      const rawMaxValue = Math.max(
        ...chartData.supplyData.map((d) => d.value),
        ...chartData.borrowData.map((d) => d.value),
      );
      const maxValue = rawMaxValue > 0 ? rawMaxValue : 1;

      const minTime = BASE_TIMESTAMP;
      const maxTime = BASE_TIMESTAMP + UTILIZATION_RANGE;
      const currentUtilTimeValue = Number(currentUtilTime);
      const lineTimeDelta = getUtilizationLineTimeDelta(currentUtilTimeValue);
      const lineStartTime = toTimestamp(
        Math.max(minTime, currentUtilTimeValue - lineTimeDelta),
      );
      const lineEndTime = toTimestamp(
        Math.min(maxTime, currentUtilTimeValue + lineTimeDelta),
      );

      // Add a vertical line series at the current utilization position
      const verticalLineSeries = chart.addLineSeries({
        color: iconSubduedColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        lineType: LineType.WithSteps,
        lineStyle: 0, // Solid line
      });

      // Draw a near-vertical line using two extremely close timestamps.
      verticalLineSeries.setData([
        { time: lineStartTime, value: 0 },
        { time: lineEndTime, value: maxValue * 1.1 },
      ]);
    }

    chartRef.current = chart;

    chart.timeScale().fitContent();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || entries[0].target !== container) return;
      const { width: newWidth } = entries[0].contentRect;
      chart.applyOptions({ width: newWidth });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      supplySeriesRef.current = null;
      borrowSeriesRef.current = null;
    };
  }, [
    chartData,
    supplyTheme,
    borrowTheme,
    utilizationRatio,
    theme.borderSubdued?.val,
    theme.iconSubdued?.val,
    handleCrosshairMove,
  ]);

  const utilizationPercentage = utilizationRatio
    ? `${(normalizeUtilization(parseFloat(utilizationRatio)) * 100).toFixed(
        2,
      )}%`
    : '0.00%';

  if (isLoading) {
    return (
      <Stack height={CHART_HEIGHT}>
        <Skeleton width="100%" height={CHART_HEIGHT} />
      </Stack>
    );
  }

  if (!borrowCurve.length || !supplyCurve.length) {
    return null;
  }

  return (
    <YStack gap="$6">
      <InterestRateModelHeader
        utilizationPercentage={utilizationPercentage}
        utilizationRatioLabel={utilizationRatioLabel}
      />

      <InterestRateModelLegend
        borrowApyLabel={borrowApyLabel}
        supplyApyLabel={supplyApyLabel}
        currentUtilizationLabel={currentUtilizationLabel}
      />

      <Stack
        position="relative"
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width !== containerWidth) {
            setContainerWidth(width);
          }
        }}
      >
        {hoverData && popoverPosition ? (
          <InterestRateModelTooltip
            hoverData={hoverData}
            popoverPosition={popoverPosition}
            utilizationRatioLabel={utilizationRatioLabel}
            borrowApyLabel={borrowApyLabel}
            supplyApyLabel={supplyApyLabel}
          />
        ) : null}
        <Stack ref={chartContainerRef} width="100%" height={CHART_HEIGHT} />
      </Stack>
    </YStack>
  );
}
