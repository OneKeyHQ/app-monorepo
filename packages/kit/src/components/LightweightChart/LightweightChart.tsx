import { useEffect, useRef } from 'react';

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
  priceFormatter,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  showLastPointMarker,
  showTimeScale,
  onHover,
}: ILightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<IPrimarySeriesApi | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

        chart.timeScale().fitContent();

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
        });

        resizeObserver.observe(container);
      },
    );

    return () => {
      cancelled = true;
      // Cleanup in correct order
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
    </Stack>
  );
}
