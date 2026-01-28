import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { createChart } from 'lightweight-charts';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import type { ILightweightChartTheme } from '@onekeyhq/kit/src/components/LightweightChart/types';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from '@onekeyhq/kit/src/components/LightweightChart/utils/chartOptions';

import {
  CHART_HEIGHT,
  INTEREST_RATE_CHART_COLORS,
  InterestRateModelHeader,
  InterestRateModelLegend,
  InterestRateModelTooltip,
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
  const [verticalLineX, setVerticalLineX] = useState<number | null>(null);

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

    // Calculate current utilization vertical line x coordinate
    const currentUtilTime = utilizationRatio
      ? convertUtilizationToTime(
          normalizeUtilization(parseFloat(utilizationRatio)),
        )
      : null;

    const updateVerticalLinePosition = () => {
      if (currentUtilTime !== null) {
        const xCoord = chart
          .timeScale()
          .timeToCoordinate(currentUtilTime as UTCTimestamp);
        setVerticalLineX(xCoord);
      } else {
        setVerticalLineX(null);
      }
    };

    // Update position after chart is ready
    chart
      .timeScale()
      .subscribeVisibleTimeRangeChange(updateVerticalLinePosition);

    chartRef.current = chart;

    chart.timeScale().fitContent();

    // Initial position update after fitContent
    requestAnimationFrame(updateVerticalLinePosition);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || entries[0].target !== container) return;
      const { width: newWidth } = entries[0].contentRect;
      chart.applyOptions({ width: newWidth });
      updateVerticalLinePosition();
    });

    resizeObserver.observe(container);

    return () => {
      chart
        .timeScale()
        .unsubscribeVisibleTimeRangeChange(updateVerticalLinePosition);
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
      <YStack gap="$6">
        <Skeleton width={180} height={24} borderRadius="$2" />
        <XStack gap="$3" ai="center">
          <Skeleton width={80} height={16} borderRadius="$2" />
          <Skeleton width={80} height={16} borderRadius="$2" />
          <Skeleton width={120} height={16} borderRadius="$2" />
        </XStack>
        <Stack height={CHART_HEIGHT}>
          <Skeleton width="100%" height={CHART_HEIGHT} />
        </Stack>
      </YStack>
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
        {verticalLineX !== null ? (
          <Stack
            position="absolute"
            left={verticalLineX}
            top={0}
            bottom={0}
            width={2}
            backgroundColor="$iconSubdued"
            pointerEvents="none"
          />
        ) : null}
        <Stack ref={chartContainerRef} width="100%" height={CHART_HEIGHT} />
      </Stack>
    </YStack>
  );
}
