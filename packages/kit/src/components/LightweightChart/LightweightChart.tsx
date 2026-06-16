import { useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';

import { useChartConfig } from './hooks/useChartConfig';
import {
  createAreaSeriesOptions,
  createChartOptions,
} from './utils/chartOptions';

import type { ILightweightChartData, ILightweightChartProps } from './types';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

const getChartLib = createLazySdkLoader(() => import('lightweight-charts'));
const DOTTED_AREA_OVERLAY_CLASS = 'ok-lightweight-dotted-area-overlay';

function removeDottedAreaOverlay(container: HTMLDivElement) {
  container
    .querySelectorAll(`.${DOTTED_AREA_OVERLAY_CLASS}`)
    .forEach((node) => node.remove());
}

function renderDottedAreaOverlay({
  chart,
  color,
  container,
  data,
  height,
  opacity,
  series,
}: {
  chart: IChartApi;
  color: string;
  container: HTMLDivElement;
  data: ILightweightChartData[];
  height: number;
  opacity?: number;
  series: ISeriesApi<'Area'> | ISeriesApi<'Baseline'>;
}) {
  removeDottedAreaOverlay(container);

  const width = container.clientWidth;
  if (width <= 0 || height <= 0 || data.length < 2) {
    return;
  }

  const points: { x: number; y: number }[] = [];
  for (const point of data) {
    const x = chart.timeScale().timeToCoordinate(point.time);
    const y = series.priceToCoordinate(point.value);
    if (typeof x === 'number' && typeof y === 'number') {
      points.push({ x: Number(x), y: Number(y) });
    }
  }

  if (points.length < 2) {
    return;
  }

  const areaBottom = Math.max(...points.map((point) => point.y), height - 28);
  const safeAreaBottom = Math.min(height, areaBottom);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const pathData = [
    `M ${firstPoint.x.toFixed(2)} ${safeAreaBottom.toFixed(2)}`,
    ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${lastPoint.x.toFixed(2)} ${safeAreaBottom.toFixed(2)}`,
    'Z',
  ].join(' ');
  const patternId = `ok-dotted-area-${Math.random().toString(36).slice(2)}`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add(DOTTED_AREA_OVERLAY_CLASS);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1';

  Array.from(container.children).forEach((child) => {
    if (!child.classList.contains(DOTTED_AREA_OVERLAY_CLASS)) {
      const element = child as HTMLElement;
      element.style.position = 'relative';
      element.style.zIndex = '2';
    }
  });

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const pattern = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'pattern',
  );
  pattern.setAttribute('id', patternId);
  pattern.setAttribute('width', '8');
  pattern.setAttribute('height', '8');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');

  const circle = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'circle',
  );
  circle.setAttribute('cx', '1');
  circle.setAttribute('cy', '1');
  circle.setAttribute('r', '1');
  circle.setAttribute('fill', color);
  circle.setAttribute('opacity', String(opacity ?? 0.42));
  pattern.appendChild(circle);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', `url(#${patternId})`);
  path.setAttribute('stroke', 'none');
  svg.appendChild(path);

  container.style.position = 'relative';
  container.appendChild(svg);
}

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
  showDottedArea,
  dottedAreaColor,
  dottedAreaOpacity,
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
    showDottedArea,
    dottedAreaColor,
    dottedAreaOpacity,
    priceScaleMargins,
    priceFormatter,
    fontSize,
    seriesType,
    baselineOptions,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let chart: IChartApi | undefined;

    // Capture container for cleanup
    const container = chartContainerRef.current;

    void getChartLib().then(({ createChart }) => {
      if (cancelled) return;

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

      chart = createChart(container, {
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

      const updateDottedAreaOverlay = () => {
        if (!chart || !chartConfig.showDottedArea) {
          removeDottedAreaOverlay(container);
          return;
        }
        requestAnimationFrame(() => {
          if (cancelled || !chart) {
            return;
          }
          renderDottedAreaOverlay({
            chart,
            color: chartConfig.dottedAreaColor ?? chartConfig.theme.lineColor,
            container,
            data: chartConfig.data,
            height,
            opacity: chartConfig.dottedAreaOpacity,
            series,
          });
        });
      };
      updateDottedAreaOverlay();

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
      resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || entries[0].target !== container) return;
        const { width: newWidth } = entries[0].contentRect;
        chart?.applyOptions({ width: newWidth });
        updateDottedAreaOverlay();
      });

      resizeObserver.observe(container);
    });

    return () => {
      cancelled = true;
      // Cleanup in correct order
      resizeObserver?.disconnect();
      removeDottedAreaOverlay(container);
      chart?.remove();

      // CRITICAL: Clear all refs to release memory
      chartRef.current = null;
      seriesRef.current = null;
      secondarySeriesRef.current = null;
    };
  }, [chartConfig, height, onHover, showLastValue]);

  return <Stack ref={chartContainerRef} width="100%" height={height} />;
}
