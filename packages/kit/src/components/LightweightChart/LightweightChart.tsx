import { useEffect, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';

import { useChartConfig } from './hooks/useChartConfig';
import { LightweightChartPulseDot } from './LightweightChartPulseDot';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from './utils/chartOptions';
import {
  createDottedAreaSeriesOptions,
  createDottedAreaSeriesPaneView,
} from './utils/dottedAreaSeries';

import type { ILightweightChartProps } from './types';
import type {
  IDottedAreaData,
  IDottedAreaSeriesOptions,
} from './utils/dottedAreaSeries';
import type {
  IChartApi,
  ISeriesApi,
  SeriesPartialOptions,
  Time,
  WhitespaceData,
} from 'lightweight-charts';

const getChartLib = createLazySdkLoader(() => import('lightweight-charts'));

type IDottedAreaSeriesApi = ISeriesApi<
  'Custom',
  Time,
  IDottedAreaData | WhitespaceData<Time>,
  IDottedAreaSeriesOptions,
  SeriesPartialOptions<IDottedAreaSeriesOptions>
>;

type IPrimarySeriesApi =
  | ISeriesApi<'Area'>
  | ISeriesApi<'Baseline'>
  | IDottedAreaSeriesApi;

function getSeriesValue(seriesData: unknown): number | undefined {
  if (seriesData && typeof seriesData === 'object' && 'value' in seriesData) {
    const value = seriesData.value;
    return typeof value === 'number' ? value : Number(value);
  }
  return undefined;
}

export function LightweightChart({
  data,
  height,
  lineColor,
  topColor,
  bottomColor,
  textSubduedColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth,
  showPriceScale,
  showHorzGridLines,
  priceScaleMargins,
  priceScaleEntireTextOnly,
  priceFormatter,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  showLastPointMarker,
  showTimeScale,
  pulseLastPoint,
  onHover,
}: ILightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<IPrimarySeriesApi | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  // Pixel position of the last data point (relative to the chart container's
  // top-left), kept in sync so the pulse-dot overlay tracks the chart tail.
  const [lastPointPosition, setLastPointPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
    textSubduedColor,
    secondaryLineData,
    secondaryLineColor,
    secondaryLineWidth,
    lineWidth,
    showPriceScale,
    showHorzGridLines,
    priceScaleMargins,
    priceScaleEntireTextOnly,
    priceFormatter,
    fontSize,
    seriesType,
    baselineOptions,
    showLastValue,
    showLastPointMarker,
    showTimeScale,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let chart: IChartApi | undefined;
    let lastPointPositionUpdater: (() => void) | undefined;
    let lastPointRafId: number | undefined;
    let resizeRafId: number | undefined;

    // Capture container for cleanup
    const container = chartContainerRef.current;

    void getChartLib().then(
      ({ AreaSeries, BaselineSeries, LineSeries, createChart }) => {
        if (cancelled) return;

        const baseOptions = createChartOptions(
          chartConfig.theme,
          chartConfig.showPriceScale,
          chartConfig.fontSize,
          chartConfig.priceScaleMargins,
          chartConfig.showTimeScale,
          chartConfig.priceScaleEntireTextOnly,
        );
        const gridOptions = {
          vertLines: { visible: false },
          horzLines: chartConfig.showHorzGridLines
            ? {
                visible: true,
                color: chartConfig.horzLineColor ?? '#E5E5EA',
                style: chartConfig.horzLineStyle ?? 2,
              }
            : { visible: false },
        };

        chart = createChart(container, {
          ...baseOptions,
          grid: gridOptions,
          width: container.clientWidth,
          height,
        });

        const isBaseline = chartConfig.seriesType === 'baseline';
        const isDottedArea = chartConfig.seriesType === 'dotted-area';
        let series: IPrimarySeriesApi;
        if (isDottedArea) {
          series = chart.addCustomSeries(
            createDottedAreaSeriesPaneView(),
            createDottedAreaSeriesOptions({
              theme: chartConfig.theme,
              lineWidth: chartConfig.lineWidth,
              showLastValue,
              showLastPointMarker: chartConfig.showLastPointMarker,
              priceFormatter: chartConfig.priceFormatter,
            }),
          );
        } else if (isBaseline) {
          series = chart.addSeries(BaselineSeries, {
            ...chartConfig.baselineOptions,
            lineWidth: Math.min(
              4,
              Math.max(1, Math.round(chartConfig.lineWidth)),
            ) as 1 | 2 | 3 | 4,
            lastValueVisible: !!showLastValue,
            priceLineVisible: !!showLastValue,
            crosshairMarkerRadius: 5,
            priceFormat: {
              type: 'custom',
              formatter:
                chartConfig.priceFormatter ??
                ((price: number) => `$${price.toFixed(2)}`),
            },
          });
        } else {
          series = chart.addSeries(AreaSeries, {
            ...createAreaSeriesOptions(
              chartConfig.theme,
              chartConfig.lineWidth,
              chartConfig.priceFormatter,
            ),
            ...(showLastValue && {
              lastValueVisible: true,
              priceLineVisible: true,
            }),
          });
        }
        series.setData(chartConfig.data);

        if (
          Array.isArray(chartConfig.secondaryLineData) &&
          chartConfig.secondaryLineData.length > 0
        ) {
          const normalizedSecondaryLineWidth = Math.min(
            4,
            Math.max(1, Math.round(chartConfig.secondaryLineWidth ?? 2)),
          ) as 1 | 2 | 3 | 4;
          const secondarySeries = chart.addSeries(LineSeries, {
            color: chartConfig.secondaryLineColor ?? '#0177E5',
            lineWidth: normalizedSecondaryLineWidth,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          secondarySeries.setData(chartConfig.secondaryLineData);
          secondarySeriesRef.current = secondarySeries;
        }

        chartRef.current = chart;
        seriesRef.current = series;

        // Track the last data point's pixel position so the pulse-dot overlay
        // stays glued to the chart tail across layout/range/resize changes.
        const updateLastPointPosition = () => {
          // Guard against the teardown window: a range-change event firing during
          // chart.remove() must not setState on the unmounting component.
          if (cancelled) return;
          const currentChart = chartRef.current;
          const currentSeries = seriesRef.current;
          if (!currentChart || !currentSeries) return;
          const lastBar = chartConfig.data[chartConfig.data.length - 1];
          if (!lastBar) {
            setLastPointPosition(null);
            return;
          }
          const xCoord = currentChart
            .timeScale()
            .timeToCoordinate(lastBar.time);
          const yCoord = currentSeries.priceToCoordinate(lastBar.value);
          if (xCoord === null || yCoord === null) {
            setLastPointPosition(null);
            return;
          }
          setLastPointPosition({ x: xCoord, y: yCoord });
        };
        lastPointPositionUpdater = updateLastPointPosition;
        // Subscribe before fitContent so the resulting range change recomputes
        // the position once the layout (and price scale) has settled.
        chart
          .timeScale()
          .subscribeVisibleTimeRangeChange(updateLastPointPosition);

        chart.timeScale().fitContent();

        // The first paint can leave coordinates unresolved, so recompute now and
        // again on the next frame as a fallback.
        updateLastPointPosition();
        lastPointRafId = requestAnimationFrame(() => {
          if (cancelled) return;
          updateLastPointPosition();
        });

        // Subscribe to crosshair move events
        if (onHover) {
          chart.subscribeCrosshairMove((param) => {
            if (
              param.time &&
              param.seriesData &&
              param.seriesData.size > 0 &&
              param.point
            ) {
              const price = getSeriesValue(param.seriesData.get(series));
              if (price !== undefined) {
                const rawSecondary = secondarySeriesRef.current
                  ? getSeriesValue(
                      param.seriesData.get(secondarySeriesRef.current),
                    )
                  : undefined;
                let secondaryPrice: number | undefined;
                if (rawSecondary !== undefined) {
                  secondaryPrice =
                    typeof rawSecondary === 'number'
                      ? rawSecondary
                      : Number(rawSecondary);
                }
                onHover({
                  time:
                    typeof param.time === 'number'
                      ? param.time
                      : Number(param.time),
                  price: typeof price === 'number' ? price : Number(price),
                  secondaryPrice,
                  x: param.point.x,
                  y: param.point.y,
                });
              }
            } else {
              onHover({
                time: undefined,
                price: undefined,
                secondaryPrice: undefined,
                x: undefined,
                y: undefined,
              });
            }
          });
        }

        // Handle resize
        resizeObserver = new ResizeObserver((entries) => {
          if (entries.length === 0 || entries[0].target !== container) return;
          const { width: newWidth } = entries[0].contentRect;
          chart?.applyOptions({ width: newWidth });
          // applyOptions relays out the chart (bar spacing / right-edge anchor)
          // on the next paint frame; reading coordinates synchronously here
          // returns the pre-resize layout, so the pulse dot would freeze at its
          // old x. lockVisibleTimeRangeOnResize also means the visible-range
          // subscription never fires on resize to correct it. Recompute after
          // the frame settles, mirroring the init path's rAF fallback.
          if (resizeRafId !== undefined) {
            cancelAnimationFrame(resizeRafId);
          }
          resizeRafId = requestAnimationFrame(() => {
            if (cancelled) return;
            lastPointPositionUpdater?.();
          });
        });

        resizeObserver.observe(container);
      },
    );

    return () => {
      cancelled = true;
      // Cleanup in correct order
      if (lastPointRafId !== undefined) {
        cancelAnimationFrame(lastPointRafId);
      }
      if (resizeRafId !== undefined) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver?.disconnect();
      chart?.remove();

      // CRITICAL: Clear all refs to release memory
      chartRef.current = null;
      seriesRef.current = null;
      secondarySeriesRef.current = null;
    };
  }, [chartConfig, height, onHover, showLastValue]);

  return (
    <Stack position="relative" width="100%" height={height}>
      <Stack ref={chartContainerRef} position="absolute" inset={0} />
      {pulseLastPoint && lastPointPosition ? (
        <LightweightChartPulseDot
          x={lastPointPosition.x}
          y={lastPointPosition.y}
          color={chartConfig.theme.lineColor}
        />
      ) : null}
    </Stack>
  );
}
