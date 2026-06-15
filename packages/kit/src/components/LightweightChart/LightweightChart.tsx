import { useEffect, useId, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';

import { useChartConfig } from './hooks/useChartConfig';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from './utils/chartOptions';
import {
  createDottedAreaSeriesOptions,
  createDottedAreaSeriesPaneView,
} from './utils/dottedAreaSeries';

import type { ILightweightChartConfig, ILightweightChartProps } from './types';
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

type IChartOverlayGeometry = {
  width: number;
  height: number;
  path?: string;
  marker?: {
    x: number;
    y: number;
    radius: number;
    color: string;
  };
};

function createChartOverlayGeometry({
  chart,
  series,
  chartConfig,
  container,
  height,
}: {
  chart: IChartApi;
  series: IPrimarySeriesApi;
  chartConfig: ILightweightChartConfig;
  container: HTMLDivElement;
  height: number;
}): IChartOverlayGeometry | null {
  const hasPatternFill = chartConfig.patternFill?.type === 'dots';
  const hasLastPointMarker = !!chartConfig.showLastPointMarker;

  if (!hasPatternFill && !hasLastPointMarker) {
    return null;
  }

  if (chartConfig.seriesType === 'dotted-area') {
    return null;
  }

  const width = container.clientWidth;
  const overlayHeight = container.clientHeight || height;
  const points = chartConfig.data
    .map((item) => {
      const x = chart.timeScale().timeToCoordinate(item.time);
      const y = series.priceToCoordinate(item.value);
      if (x === null || y === null) {
        return undefined;
      }
      return { x, y };
    })
    .filter(Boolean) as { x: number; y: number }[];

  if (points.length === 0) {
    return null;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const path =
    hasPatternFill && points.length > 1
      ? [
          `M ${firstPoint.x} ${overlayHeight}`,
          ...points.map((point) => `L ${point.x} ${point.y}`),
          `L ${lastPoint.x} ${overlayHeight}`,
          'Z',
        ].join(' ')
      : undefined;

  return {
    width,
    height: overlayHeight,
    path,
    marker: hasLastPointMarker
      ? {
          x: lastPoint.x,
          y: lastPoint.y,
          radius: chartConfig.lastPointMarkerRadius ?? 5,
          color:
            chartConfig.lastPointMarkerColor ?? chartConfig.theme.lineColor,
        }
      : undefined,
  };
}

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
  textColor,
  textSubduedColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth,
  showPriceScale,
  showHorzGridLines,
  priceScaleMargins,
  priceFormatter,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  showTimeScale,
  patternFill,
  showLastPointMarker,
  lastPointMarkerColor,
  lastPointMarkerRadius,
  priceFormatterType,
  priceFormatterTickStep,
  onHover,
}: ILightweightChartProps) {
  const chartPatternId = useId().replace(/:/g, '');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<IPrimarySeriesApi | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [overlayGeometry, setOverlayGeometry] =
    useState<IChartOverlayGeometry | null>(null);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
    textColor,
    textSubduedColor,
    secondaryLineData,
    secondaryLineColor,
    secondaryLineWidth,
    lineWidth,
    showPriceScale,
    showHorzGridLines,
    priceScaleMargins,
    priceFormatter,
    priceFormatterType,
    fontSize,
    seriesType,
    baselineOptions,
    showLastValue,
    showTimeScale,
    patternFill,
    showLastPointMarker,
    lastPointMarkerColor,
    lastPointMarkerRadius,
    priceFormatterTickStep,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let chart: IChartApi | undefined;
    let overlayFrame: number | undefined;

    // Capture container for cleanup
    const container = chartContainerRef.current;

    const scheduleOverlayUpdate = (targetSeries: IPrimarySeriesApi) => {
      if (overlayFrame !== undefined) {
        globalThis.cancelAnimationFrame(overlayFrame);
      }
      overlayFrame = globalThis.requestAnimationFrame(() => {
        overlayFrame = undefined;
        if (cancelled || !chart) return;
        setOverlayGeometry(
          createChartOverlayGeometry({
            chart,
            series: targetSeries,
            chartConfig,
            container,
            height,
          }),
        );
      });
    };

    void getChartLib().then(
      ({ AreaSeries, BaselineSeries, LineSeries, createChart }) => {
        if (cancelled) return;

        const baseOptions = createChartOptions(
          chartConfig.theme,
          chartConfig.showPriceScale,
          chartConfig.fontSize,
          chartConfig.priceScaleMargins,
          chartConfig.showTimeScale,
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
              patternFill: chartConfig.patternFill,
              showLastValue,
              showLastPointMarker: chartConfig.showLastPointMarker,
              lastPointMarkerColor: chartConfig.lastPointMarkerColor,
              lastPointMarkerRadius: chartConfig.lastPointMarkerRadius,
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

        chart.timeScale().fitContent();
        scheduleOverlayUpdate(series);

        chartRef.current = chart;
        seriesRef.current = series;

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
          scheduleOverlayUpdate(series);
        });

        resizeObserver.observe(container);
      },
    );

    return () => {
      cancelled = true;
      // Cleanup in correct order
      if (overlayFrame !== undefined) {
        globalThis.cancelAnimationFrame(overlayFrame);
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
      {overlayGeometry ? (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${overlayGeometry.width} ${overlayGeometry.height}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {overlayGeometry.path && patternFill?.type === 'dots' ? (
            <>
              <defs>
                <pattern
                  id={chartPatternId}
                  x="0"
                  y="0"
                  width={patternFill.spacing ?? 10}
                  height={patternFill.spacing ?? 10}
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx={(patternFill.spacing ?? 10) / 2}
                    cy={(patternFill.spacing ?? 10) / 2}
                    r={patternFill.radius ?? 1.1}
                    fill={patternFill.color ?? lineColor ?? '#8D8FE8'}
                  />
                </pattern>
              </defs>
              <path
                d={overlayGeometry.path}
                fill={`url(#${chartPatternId})`}
                opacity={patternFill.opacity ?? 0.5}
              />
            </>
          ) : null}
          {overlayGeometry.marker ? (
            <circle
              cx={overlayGeometry.marker.x}
              cy={overlayGeometry.marker.y}
              r={overlayGeometry.marker.radius}
              fill={overlayGeometry.marker.color}
            />
          ) : null}
        </svg>
      ) : null}
    </Stack>
  );
}
