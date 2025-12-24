import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useTheme } from '@tamagui/core';
import { createChart } from 'lightweight-charts';

import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ILightweightChartTheme } from '@onekeyhq/kit/src/components/LightweightChart/types';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from '@onekeyhq/kit/src/components/LightweightChart/utils/chartOptions';

import type { ColorTokens } from '@tamagui/core';
import type { BusinessDay, IChartApi, UTCTimestamp } from 'lightweight-charts';

interface IInterestRateModelChartProps {
  borrowCurve: [number, string][];
  supplyCurve: [number, string][];
  utilizationRatio?: string;
  isLoading?: boolean;
}

const CHART_HEIGHT = 280;

// Convert utilization (0-1) to timestamp for LightweightChart
// We use a base timestamp and map utilization (0-1) to a reasonable timestamp range
// This allows LightweightChart to work with non-time-series data
const BASE_TIMESTAMP = 1_000_000_000; // Base timestamp (2001-09-09)
const UTILIZATION_RANGE = 1_000_000; // Map 0-1 utilization to 0-1000000 timestamp range
const convertUtilizationToTime = (util: number): UTCTimestamp => {
  // Clamp utilization to 0-1 range
  const clampedUtil = Math.max(0, Math.min(1, util));
  // Map 0-1 utilization to timestamp range
  return (BASE_TIMESTAMP +
    Math.round(clampedUtil * UTILIZATION_RANGE)) as UTCTimestamp;
};

// Convert timestamp back to utilization (0-1)
const convertTimeToUtilization = (time: UTCTimestamp | BusinessDay): number => {
  const timeValue = typeof time === 'number' ? time : Number(time);
  const util = (timeValue - BASE_TIMESTAMP) / UTILIZATION_RANGE;
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, util));
};

export function InterestRateModelChart({
  borrowCurve,
  supplyCurve,
  utilizationRatio,
  isLoading,
}: IInterestRateModelChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const theme = useTheme();

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
    () => createTheme('#008347D6', '#00834726', '#00834700'),
    [createTheme],
  );

  const borrowTheme = useMemo(
    () => createTheme('#DA8A00C9', '#DA8A0026', '#DA8A0000'),
    [createTheme],
  );

  // Convert curve data to LightweightChart format
  const chartData = useMemo(() => {
    if (!borrowCurve.length || !supplyCurve.length) {
      return { supplyData: [], borrowData: [] };
    }

    const supplyData = supplyCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(util),
      value: parseFloat(apy),
    }));

    const borrowData = borrowCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(util),
      value: parseFloat(apy),
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
          color: '#E5E5EA',
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
          const util = convertTimeToUtilization(time);
          return `${Math.round(util * 100)}%`;
        },
      },
    });

    // Add supply series
    const supplySeries = chart.addAreaSeries(
      createAreaSeriesOptions(supplyTheme, 2),
    );
    supplySeries.setData(chartData.supplyData);

    // Add borrow series
    const borrowSeries = chart.addAreaSeries(
      createAreaSeriesOptions(borrowTheme, 2),
    );
    borrowSeries.setData(chartData.borrowData);

    // Add current utilization vertical line marker if available
    if (utilizationRatio) {
      const currentUtilRatio = parseFloat(utilizationRatio);
      const currentUtilTime = convertUtilizationToTime(currentUtilRatio);
      const iconSubduedColor = theme.iconSubdued?.val || '#8C8CA1';

      // Find the max value to draw the line from bottom to top
      const maxValue = Math.max(
        ...chartData.supplyData.map((d) => d.value),
        ...chartData.borrowData.map((d) => d.value),
      );

      // Add a vertical line series at the current utilization position
      const verticalLineSeries = chart.addLineSeries({
        color: iconSubduedColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        lineStyle: 0, // Solid line
      });

      // Draw vertical line by adding two points at the same time but different values
      verticalLineSeries.setData([
        { time: currentUtilTime, value: 0 },
        { time: currentUtilTime, value: maxValue * 1.1 },
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
    };
  }, [
    chartData,
    supplyTheme,
    borrowTheme,
    utilizationRatio,
    theme.iconSubdued?.val,
  ]);

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

  const utilizationPercentage = utilizationRatio
    ? `${parseFloat(utilizationRatio).toFixed(2)}%`
    : '0.00%';

  return (
    <YStack gap="$3">
      {/* Header showing current utilization */}
      <SizableText size="$headingLg">
        {utilizationPercentage} Utilization ratio
      </SizableText>

      {/* Legend */}
      <XStack mt="$3" gap="$6" ai="center">
        <XStack ai="center" gap="$2">
          <Icon
            name="CirclePlaceholderOnSolid"
            size="$1.5"
            color={'#DA8A00C9' as ColorTokens}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            Borrow APY
          </SizableText>
        </XStack>
        <XStack ai="center" gap="$2">
          <Icon
            name="CirclePlaceholderOnSolid"
            size="$1.5"
            color={'#008347D6' as ColorTokens}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            Supply APY
          </SizableText>
        </XStack>
        <XStack ai="center" gap="$2">
          <Icon
            name="CirclePlaceholderOnSolid"
            size="$1.5"
            color="$iconSubdued"
          />
          <SizableText size="$bodySm" color="$textSubdued">
            Current utilization
          </SizableText>
        </XStack>
      </XStack>

      <Stack ref={chartContainerRef} width="100%" height={CHART_HEIGHT} />
    </YStack>
  );
}
