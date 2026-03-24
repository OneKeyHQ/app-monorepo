import { useEffect, useRef } from 'react';

import { createChart } from 'lightweight-charts';

import { Stack } from '@onekeyhq/components';

import { useChartConfig } from './hooks/useChartConfig';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from './utils/chartOptions';

import type { ILightweightChartProps } from './types';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export function LightweightChart({
  data,
  height,
  lineColor,
  topColor,
  bottomColor,
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
  onHover,
}: ILightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Baseline'> | null>(
    null,
  );
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
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
  });

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    // Capture container for cleanup
    const container = chartContainerRef.current;

    const baseOptions = createChartOptions(
      chartConfig.theme,
      chartConfig.showPriceScale,
      chartConfig.fontSize,
      chartConfig.priceScaleMargins,
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

    const chart = createChart(container, {
      ...baseOptions,
      grid: gridOptions,
      width: container.clientWidth,
      height,
    });

    const isBaseline = chartConfig.seriesType === 'baseline';
    const series = isBaseline
      ? chart.addBaselineSeries({
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
        })
      : chart.addAreaSeries({
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
    series.setData(chartConfig.data);

    if (
      Array.isArray(chartConfig.secondaryLineData) &&
      chartConfig.secondaryLineData.length > 0
    ) {
      const normalizedSecondaryLineWidth = Math.min(
        4,
        Math.max(1, Math.round(chartConfig.secondaryLineWidth ?? 2)),
      ) as 1 | 2 | 3 | 4;
      const secondarySeries = chart.addLineSeries({
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
          param.seriesPrices &&
          param.seriesPrices.size > 0 &&
          param.point
        ) {
          const price = param.seriesPrices.get(series);
          if (price !== undefined) {
            const rawSecondary = secondarySeriesRef.current
              ? param.seriesPrices.get(secondarySeriesRef.current)
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
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || entries[0].target !== container) return;
      const { width: newWidth } = entries[0].contentRect;
      chart.applyOptions({ width: newWidth });
    });

    resizeObserver.observe(container);

    return () => {
      // Cleanup in correct order
      resizeObserver.disconnect();
      chart.remove();

      // CRITICAL: Clear all refs to release memory
      chartRef.current = null;
      seriesRef.current = null;
      secondarySeriesRef.current = null;
    };
  }, [chartConfig, height, onHover, showLastValue]);

  return <Stack ref={chartContainerRef} width="100%" height={height} />;
}
