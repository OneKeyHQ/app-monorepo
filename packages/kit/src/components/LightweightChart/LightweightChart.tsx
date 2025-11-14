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
  onHover,
}: ILightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      ...createChartOptions(chartConfig.theme),
      width: chartContainerRef.current.clientWidth,
      height,
    });

    const series = chart.addAreaSeries(
      createAreaSeriesOptions(chartConfig.theme),
    );
    series.setData(chartConfig.data as any);
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
            onHover({
              time:
                typeof param.time === 'number'
                  ? param.time
                  : Number(param.time),
              price: typeof price === 'number' ? price : Number(price),
              x: param.point.x,
              y: param.point.y,
            });
          }
        } else {
          onHover({
            time: undefined,
            price: undefined,
            x: undefined,
            y: undefined,
          });
        }
      });
    }

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (
        entries.length === 0 ||
        entries[0].target !== chartContainerRef.current
      )
        return;
      const { width: newWidth } = entries[0].contentRect;
      chart.applyOptions({ width: newWidth });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartConfig, height, onHover]);

  return <Stack ref={chartContainerRef} width="100%" height={height} />;
}
