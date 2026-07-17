import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_PADDING as CHART_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TICK_COUNT as PRICE_AXIS_TICK_COUNT,
  TRADING_VIEW_NATIVE_PRICE_AXIS_WIDTH as PRICE_AXIS_WIDTH,
  TRADING_VIEW_NATIVE_PRICE_VOLUME_GAP_RATIO as PRICE_VOLUME_GAP_RATIO,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_VOLUME_HEIGHT_RATIO as VOLUME_HEIGHT_RATIO,
  TRADING_VIEW_NATIVE_VOLUME_OPACITY as VOLUME_OPACITY,
} from '../chartConstants';
import { formatTradingViewNativePriceTick } from '../utils/chartLayout';
import {
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativePriceRange,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from '../utils/chartViewport';

import type {
  ITradingViewNativeChartColors,
  ITradingViewNativeChartProps,
} from '../types';

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_DELTA_LINE_HEIGHT = 16;

interface IChartColors extends ITradingViewNativeChartColors {
  axisText: string;
}

interface IChartViewportState {
  offset: number;
  points: IMarketTokenKLineDataPoint[];
  zoomScale: number;
}

interface IPointerDragState {
  pointerId: number;
  points: IMarketTokenKLineDataPoint[];
  startClientX: number;
  startOffset: number;
  zoomScale: number;
}

function getCanvasChartWidth(canvas: HTMLCanvasElement) {
  return (
    canvas.getBoundingClientRect().width - PRICE_AXIS_WIDTH - CHART_PADDING
  );
}

function getWheelDeltaYInPixels(event: WheelEvent, canvas: HTMLCanvasElement) {
  if (event.deltaMode === WHEEL_DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_DELTA_LINE_HEIGHT;
  }
  if (event.deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return event.deltaY * canvas.clientHeight;
  }
  return event.deltaY;
}

function drawKLineChart(
  canvas: HTMLCanvasElement,
  points: IMarketTokenKLineDataPoint[],
  colors: IChartColors,
  panOffset: number,
  zoomScale: number,
) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    return;
  }

  const pixelRatio = Math.max(globalThis.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  if (!points.length) {
    return;
  }

  const priceAxisX = width - PRICE_AXIS_WIDTH;
  const chartWidth = priceAxisX - CHART_PADDING;
  const contentHeight = height - CHART_PADDING * 2;
  if (chartWidth <= 0 || contentHeight <= 0) {
    return;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const clampedPanOffset = clampTradingViewNativePanOffset({
    chartWidth,
    offset: panOffset,
    pointCount: points.length,
    zoomScale: clampedZoomScale,
  });

  const volumeHeight = contentHeight * VOLUME_HEIGHT_RATIO;
  const priceChartHeight =
    contentHeight * (1 - VOLUME_HEIGHT_RATIO - PRICE_VOLUME_GAP_RATIO);
  const volumeBottom = height - CHART_PADDING;
  let maxVolume = 0;

  for (const point of points) {
    if (Number.isFinite(point.v)) {
      maxVolume = Math.max(maxVolume, point.v);
    }
  }

  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    chartWidth,
    offset: clampedPanOffset,
    pointCount: points.length,
    zoomScale: clampedZoomScale,
  });
  const visiblePriceRange = getTradingViewNativePriceRange({
    ...visiblePointRange,
    points,
  });
  if (!visiblePriceRange) {
    return;
  }
  const { maxPrice, minPrice } = visiblePriceRange;
  const priceRange = maxPrice - minPrice;
  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(priceAxisX, CHART_PADDING);
  context.lineTo(priceAxisX, CHART_PADDING + priceChartHeight);
  context.stroke();

  context.fillStyle = colors.axisText;
  context.font = '11px sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  const priceTickCount = priceRange === 0 ? 1 : PRICE_AXIS_TICK_COUNT;
  for (let index = 0; index < priceTickCount; index += 1) {
    const progress = priceTickCount === 1 ? 0.5 : index / (priceTickCount - 1);
    const y = CHART_PADDING + priceChartHeight * progress;
    const price = maxPrice - priceRange * progress;
    context.beginPath();
    context.moveTo(CHART_PADDING, y);
    context.lineTo(priceAxisX + 4, y);
    context.stroke();
    context.fillText(formatTradingViewNativePriceTick(price), width - 8, y);
  }

  const toY = (price: number) =>
    priceRange === 0
      ? CHART_PADDING + priceChartHeight / 2
      : CHART_PADDING + ((maxPrice - price) / priceRange) * priceChartHeight;
  const candleBodyWidth =
    TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * clampedZoomScale;
  const candleGap = TRADING_VIEW_NATIVE_CANDLE_GAP * clampedZoomScale;
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_STEP * clampedZoomScale;
  const lastCandleX =
    priceAxisX - candleGap - candleBodyWidth / 2 + clampedPanOffset;

  context.save();
  context.beginPath();
  context.rect(CHART_PADDING, 0, chartWidth, height);
  context.clip();

  points.forEach((point, index) => {
    const color = point.c >= point.o ? colors.up : colors.down;
    const x = lastCandleX - (points.length - index - 1) * candleStep;
    const openY = toY(point.o);
    const highY = toY(point.h);
    const lowY = toY(point.l);
    const closeY = toY(point.c);

    context.fillStyle = color;
    context.fillRect(
      x - TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH / 2,
      highY,
      TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
      Math.max(lowY - highY, 1),
    );
    context.fillRect(
      x - candleBodyWidth / 2,
      Math.min(openY, closeY),
      candleBodyWidth,
      Math.max(Math.abs(closeY - openY), 1),
    );

    if (maxVolume > 0 && Number.isFinite(point.v) && point.v > 0) {
      const volumeBarHeight = Math.max((point.v / maxVolume) * volumeHeight, 1);
      context.globalAlpha = VOLUME_OPACITY;
      context.fillRect(
        x - candleBodyWidth / 2,
        volumeBottom - volumeBarHeight,
        candleBodyWidth,
        volumeBarHeight,
      );
      context.globalAlpha = 1;
    }
  });
  context.restore();
}

export const TradingViewNativeChart = memo(
  ({ isSwitchingInterval, points, testID }: ITradingViewNativeChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pointerDragStateRef = useRef<IPointerDragState | null>(null);
    const [viewportState, setViewportState] = useState<IChartViewportState>(
      () => ({
        offset: 0,
        points,
        zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
      }),
    );
    const isCurrentViewport = viewportState.points === points;
    const panOffset = isCurrentViewport ? viewportState.offset : 0;
    const zoomScale = isCurrentViewport
      ? viewportState.zoomScale
      : TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE;
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      const renderChart = () => {
        drawKLineChart(
          canvas,
          points,
          {
            axisText,
            background,
            grid,
            up: CHART_UP_COLOR,
            down: CHART_DOWN_COLOR,
          },
          panOffset,
          zoomScale,
        );
      };
      renderChart();

      const resizeObserver = new ResizeObserver(renderChart);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, [axisText, background, grid, panOffset, points, zoomScale]);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0) {
          return;
        }

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }

        const chartWidth = getCanvasChartWidth(event.currentTarget);
        pointerDragStateRef.current = {
          pointerId: event.pointerId,
          points,
          startClientX: event.clientX,
          startOffset: clampTradingViewNativePanOffset({
            chartWidth,
            offset: panOffset,
            pointCount: points.length,
            zoomScale,
          }),
          zoomScale,
        };
      },
      [panOffset, points, zoomScale],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const dragState = pointerDragStateRef.current;
        if (
          !dragState ||
          dragState.pointerId !== event.pointerId ||
          dragState.points !== points
        ) {
          return;
        }

        event.preventDefault();
        const chartWidth = getCanvasChartWidth(event.currentTarget);
        const nextOffset = clampTradingViewNativePanOffset({
          chartWidth,
          offset:
            dragState.startOffset + event.clientX - dragState.startClientX,
          pointCount: points.length,
          zoomScale: dragState.zoomScale,
        });
        setViewportState((currentState) =>
          currentState.points === points &&
          currentState.offset === nextOffset &&
          currentState.zoomScale === dragState.zoomScale
            ? currentState
            : {
                offset: nextOffset,
                points,
                zoomScale: dragState.zoomScale,
              },
        );
      },
      [points],
    );

    const finishPointerDrag = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (pointerDragStateRef.current?.pointerId !== event.pointerId) {
          return;
        }

        pointerDragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      [],
    );

    const handleWheel = useCallback(
      (event: WheelEvent) => {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getCanvasChartWidth(canvas);
        const deltaY = getWheelDeltaYInPixels(event, canvas);
        const anchorX = event.clientX - canvasRect.left - CHART_PADDING;
        setViewportState((currentState) => {
          const hasCurrentPoints = currentState.points === points;
          const currentOffset = hasCurrentPoints ? currentState.offset : 0;
          const currentZoomScale = hasCurrentPoints
            ? currentState.zoomScale
            : TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE;
          const nextViewport = getTradingViewNativeZoomedViewport({
            anchorX,
            chartWidth,
            currentOffset,
            currentZoomScale,
            nextZoomScale:
              currentZoomScale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY),
            pointCount: points.length,
          });
          if (
            hasCurrentPoints &&
            currentState.offset === nextViewport.offset &&
            currentState.zoomScale === nextViewport.zoomScale
          ) {
            return currentState;
          }
          return {
            ...nextViewport,
            points,
          };
        });
      },
      [points],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    return (
      <Stack
        flex={1}
        minHeight={0}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <canvas
          ref={canvasRef}
          data-testid={testID}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          style={{
            cursor: 'grab',
            display: 'block',
            touchAction: 'pan-y',
            userSelect: 'none',
            width: '100%',
            height: '100%',
          }}
        />
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
