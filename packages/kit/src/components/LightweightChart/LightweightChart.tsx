import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
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
import {
  createHistogramSeriesOptions,
  createHistogramSeriesPaneView,
} from './utils/histogramSeries';

import type { ILightweightChartProps } from './types';
import type {
  IDottedAreaData,
  IDottedAreaSeriesOptions,
} from './utils/dottedAreaSeries';
import type {
  IHistogramData,
  IHistogramSeriesOptions,
} from './utils/histogramSeries';
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

type IHistogramSeriesApi = ISeriesApi<
  'Custom',
  Time,
  IHistogramData | WhitespaceData<Time>,
  IHistogramSeriesOptions,
  SeriesPartialOptions<IHistogramSeriesOptions>
>;

type IPrimarySeriesApi =
  | ISeriesApi<'Area'>
  | ISeriesApi<'Baseline'>
  | IHistogramSeriesApi
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
  horzLineColor,
  horzLineStyle,
  priceScalePosition,
  priceScaleMargins,
  priceScaleEntireTextOnly,
  priceScaleMinimumWidth,
  crosshairVertLineColor,
  crosshairVertLineStyle,
  patternColor,
  pulseLastPointColor,
  priceFormatter,
  fontSize,
  seriesType,
  lineType,
  baselineOptions,
  histogramOptions,
  referenceLine,
  showLastValue,
  showLastPointMarker,
  showTimeScale,
  useTimeScaleTickMarkWithoutUnit,
  timeZone,
  locale,
  pulseLastPoint,
  preserveChartInstanceOnDataChange,
  onHover,
}: ILightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<IPrimarySeriesApi | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const heightRef = useRef(height);
  heightRef.current = height;
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
    horzLineColor,
    horzLineStyle,
    priceScalePosition,
    priceScaleMargins,
    priceScaleEntireTextOnly,
    crosshairVertLineColor,
    crosshairVertLineStyle,
    patternColor,
    pulseLastPointColor,
    priceFormatter,
    fontSize,
    seriesType,
    lineType,
    baselineOptions,
    histogramOptions,
    referenceLine,
    showLastValue,
    showLastPointMarker,
    showTimeScale,
    useTimeScaleTickMarkWithoutUnit,
    timeZone,
    locale,
  });
  const chartConfigRef = useRef(chartConfig);
  chartConfigRef.current = chartConfig;
  const lastPointPositionUpdaterRef = useRef<(() => void) | undefined>(
    undefined,
  );
  const lastPointPositionGenerationRef = useRef(0);
  const canPublishLastPointPositionRef = useRef(false);
  const hasSecondaryLineData =
    Array.isArray(chartConfig.secondaryLineData) &&
    chartConfig.secondaryLineData.length > 0;
  const chartDataCreateDependency = preserveChartInstanceOnDataChange
    ? undefined
    : chartConfig.data;
  const secondaryLineDataCreateDependency = preserveChartInstanceOnDataChange
    ? undefined
    : chartConfig.secondaryLineData;

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let chart: IChartApi | undefined;
    let lastPointPositionUpdater: (() => void) | undefined;
    let lastPointRafId: number | undefined;
    let resizeRafId: number | undefined;
    const lastPointPositionGeneration =
      lastPointPositionGenerationRef.current + 1;
    lastPointPositionGenerationRef.current = lastPointPositionGeneration;
    canPublishLastPointPositionRef.current = false;

    // Capture container for cleanup
    const container = chartContainerRef.current;
    setLastPointPosition(null);

    void getChartLib().then(
      ({
        AreaSeries,
        BaselineSeries,
        LineSeries,
        LineStyle,
        LineType,
        createChart,
      }) => {
        if (cancelled) return;

        const currentChartConfig = chartConfigRef.current;
        const baseOptions = createChartOptions(
          currentChartConfig.theme,
          currentChartConfig.showPriceScale,
          currentChartConfig.fontSize,
          currentChartConfig.priceScaleMargins,
          currentChartConfig.showTimeScale,
          currentChartConfig.priceScaleEntireTextOnly,
          currentChartConfig.useTimeScaleTickMarkWithoutUnit,
          priceScaleMinimumWidth,
          currentChartConfig.priceScalePosition,
          currentChartConfig.timeZone,
          currentChartConfig.locale,
          {
            color: currentChartConfig.crosshairVertLineColor,
            style: currentChartConfig.crosshairVertLineStyle,
          },
        );
        const gridOptions = {
          vertLines: { visible: false },
          horzLines: currentChartConfig.showHorzGridLines
            ? {
                visible: true,
                color: currentChartConfig.horzLineColor ?? '#E5E5EA',
                style: currentChartConfig.horzLineStyle ?? 2,
              }
            : { visible: false },
        };

        chart = createChart(container, {
          ...baseOptions,
          grid: gridOptions,
          width: container.clientWidth,
          height: container.clientHeight || heightRef.current,
        });

        const isBaseline = currentChartConfig.seriesType === 'baseline';
        const isDottedArea = currentChartConfig.seriesType === 'dotted-area';
        const isHistogram = currentChartConfig.seriesType === 'histogram';
        let series: IPrimarySeriesApi;
        if (isDottedArea) {
          series = chart.addCustomSeries(
            createDottedAreaSeriesPaneView(),
            createDottedAreaSeriesOptions({
              theme: currentChartConfig.theme,
              lineWidth: currentChartConfig.lineWidth,
              showLastValue,
              showLastPointMarker: currentChartConfig.showLastPointMarker,
              patternColor: currentChartConfig.patternColor,
              priceFormatter: currentChartConfig.priceFormatter,
            }),
          );
          series.applyOptions({
            priceScaleId: currentChartConfig.priceScalePosition,
          });
        } else if (isBaseline) {
          series = chart.addSeries(BaselineSeries, {
            ...currentChartConfig.baselineOptions,
            priceScaleId: currentChartConfig.priceScalePosition,
            lineType:
              currentChartConfig.lineType === 'steps'
                ? LineType.WithSteps
                : LineType.Simple,
            lineWidth: Math.min(
              4,
              Math.max(1, Math.round(currentChartConfig.lineWidth)),
            ) as 1 | 2 | 3 | 4,
            lastValueVisible: !!showLastValue,
            priceLineVisible: !!showLastValue,
            crosshairMarkerRadius: 5,
            priceFormat: {
              type: 'custom',
              formatter:
                currentChartConfig.priceFormatter ??
                ((price: number) => `$${price.toFixed(2)}`),
            },
          });
        } else if (isHistogram) {
          series = chart.addCustomSeries(
            createHistogramSeriesPaneView(),
            createHistogramSeriesOptions({
              theme: currentChartConfig.theme,
              histogramOptions: currentChartConfig.histogramOptions,
              showLastValue,
              priceFormatter: currentChartConfig.priceFormatter,
            }),
          );
          series.applyOptions({
            priceScaleId: currentChartConfig.priceScalePosition,
          });
        } else {
          series = chart.addSeries(AreaSeries, {
            priceScaleId: currentChartConfig.priceScalePosition,
            ...createAreaSeriesOptions(
              currentChartConfig.theme,
              currentChartConfig.lineWidth,
              currentChartConfig.priceFormatter,
            ),
            ...(showLastValue && {
              lastValueVisible: true,
              priceLineVisible: true,
            }),
          });
        }
        series.setData(currentChartConfig.data);

        if (currentChartConfig.referenceLine) {
          const referenceLineStyle = {
            solid: LineStyle.Solid,
            dotted: LineStyle.Dotted,
            dashed: LineStyle.Dashed,
            'large-dashed': LineStyle.LargeDashed,
            'sparse-dotted': LineStyle.SparseDotted,
          }[currentChartConfig.referenceLine.lineStyle ?? 'solid'];
          series.createPriceLine({
            price: currentChartConfig.referenceLine.price,
            color: currentChartConfig.referenceLine.color,
            lineWidth: currentChartConfig.referenceLine.lineWidth ?? 1,
            lineStyle: referenceLineStyle,
            lineVisible: true,
            axisLabelVisible:
              currentChartConfig.referenceLine.axisLabelVisible ?? false,
            title: '',
          });
        }

        if (
          Array.isArray(currentChartConfig.secondaryLineData) &&
          currentChartConfig.secondaryLineData.length > 0
        ) {
          const normalizedSecondaryLineWidth = Math.min(
            4,
            Math.max(1, Math.round(currentChartConfig.secondaryLineWidth ?? 2)),
          ) as 1 | 2 | 3 | 4;
          const secondarySeries = chart.addSeries(LineSeries, {
            priceScaleId: currentChartConfig.priceScalePosition,
            color: currentChartConfig.secondaryLineColor ?? '#0177E5',
            lineWidth: normalizedSecondaryLineWidth,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          secondarySeries.setData(currentChartConfig.secondaryLineData);
          secondarySeriesRef.current = secondarySeries;
        }

        chartRef.current = chart;
        seriesRef.current = series;

        // Track the last data point's pixel position so the pulse-dot overlay
        // stays glued to the chart tail across layout/range/resize changes.
        const updateLastPointPosition = () => {
          // Guard against the teardown window: a range-change event firing during
          // chart.remove() must not setState on the unmounting component.
          if (cancelled || !canPublishLastPointPositionRef.current) return;
          const currentChart = chartRef.current;
          const currentSeries = seriesRef.current;
          if (!currentChart || !currentSeries) return;
          const currentData = chartConfigRef.current.data;
          const lastBar = currentData[currentData.length - 1];
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
        lastPointPositionUpdaterRef.current = updateLastPointPosition;
        // Subscribe before fitContent so the resulting range change recomputes
        // the position once the layout (and price scale) has settled.
        chart
          .timeScale()
          .subscribeVisibleTimeRangeChange(updateLastPointPosition);

        chart.timeScale().fitContent();

        // Price autoscaling and axis label measurement settle on the next chart
        // frame. Keep the overlay hidden until then so it never paints with the
        // temporary full-width/unscaled coordinates.
        lastPointRafId = requestAnimationFrame(() => {
          if (
            cancelled ||
            lastPointPositionGenerationRef.current !==
              lastPointPositionGeneration
          ) {
            return;
          }
          canPublishLastPointPositionRef.current = true;
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
          const { height: newHeight, width: newWidth } = entries[0].contentRect;
          chart?.applyOptions({ height: newHeight, width: newWidth });
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
      lastPointPositionGenerationRef.current += 1;
      canPublishLastPointPositionRef.current = false;
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
      lastPointPositionUpdaterRef.current = undefined;
    };
  }, [
    chartConfig.baselineOptions,
    chartConfig.crosshairVertLineColor,
    chartConfig.crosshairVertLineStyle,
    chartConfig.fontSize,
    chartConfig.horzLineColor,
    chartConfig.horzLineStyle,
    chartConfig.histogramOptions,
    chartConfig.lineWidth,
    chartConfig.lineType,
    chartConfig.patternColor,
    chartConfig.priceFormatter,
    chartConfig.priceScalePosition,
    chartConfig.priceScaleEntireTextOnly,
    chartConfig.priceScaleMargins,
    chartConfig.referenceLine,
    chartConfig.secondaryLineColor,
    chartConfig.secondaryLineWidth,
    chartConfig.seriesType,
    chartConfig.showHorzGridLines,
    chartConfig.showLastPointMarker,
    chartConfig.showPriceScale,
    chartConfig.showTimeScale,
    chartConfig.theme.bgColor,
    chartConfig.theme.bottomColor,
    chartConfig.theme.lineColor,
    chartConfig.theme.textSubduedColor,
    chartConfig.theme.topColor,
    chartConfig.timeZone,
    chartConfig.useTimeScaleTickMarkWithoutUnit,
    chartConfig.locale,
    chartDataCreateDependency,
    hasSecondaryLineData,
    onHover,
    preserveChartInstanceOnDataChange,
    priceScaleMinimumWidth,
    secondaryLineDataCreateDependency,
    showLastValue,
  ]);

  useEffect(() => {
    if (!preserveChartInstanceOnDataChange) {
      return undefined;
    }

    const currentChart = chartRef.current;
    const currentSeries = seriesRef.current;
    if (!currentChart || !currentSeries) {
      return undefined;
    }

    const lastPointPositionGeneration =
      lastPointPositionGenerationRef.current + 1;
    lastPointPositionGenerationRef.current = lastPointPositionGeneration;
    canPublishLastPointPositionRef.current = false;
    setLastPointPosition(null);

    currentSeries.setData(chartConfig.data);
    currentChart.timeScale().fitContent();

    const lastPointRafId = requestAnimationFrame(() => {
      if (
        lastPointPositionGenerationRef.current !== lastPointPositionGeneration
      ) {
        return;
      }
      canPublishLastPointPositionRef.current = true;
      lastPointPositionUpdaterRef.current?.();
    });

    return () => {
      cancelAnimationFrame(lastPointRafId);
      if (
        lastPointPositionGenerationRef.current === lastPointPositionGeneration
      ) {
        lastPointPositionGenerationRef.current += 1;
        canPublishLastPointPositionRef.current = false;
      }
    };
  }, [chartConfig.data, preserveChartInstanceOnDataChange]);

  // The overlay series is re-cut on every crosshair step by charts that dim the
  // part of the line past the cursor, so it gets its own update path: replacing
  // its data must not re-fit the time scale or drop the pulse-dot anchor, or
  // scrubbing would make the chart strobe.
  useEffect(() => {
    if (!preserveChartInstanceOnDataChange) {
      return;
    }
    secondarySeriesRef.current?.setData(chartConfig.secondaryLineData ?? []);
  }, [chartConfig.secondaryLineData, preserveChartInstanceOnDataChange]);

  return (
    <Stack position="relative" width="100%" height={height}>
      <Stack
        ref={chartContainerRef as unknown as Ref<IElement>}
        position="absolute"
        inset={0}
      />
      {pulseLastPoint && lastPointPosition ? (
        <LightweightChartPulseDot
          x={lastPointPosition.x}
          y={lastPointPosition.y}
          color={chartConfig.pulseLastPointColor ?? chartConfig.theme.lineColor}
        />
      ) : null}
    </Stack>
  );
}
