import { memo, useEffect, useRef, useState } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeProps } from './types';

const KLINE_INTERVAL = '1H';
const KLINE_RANGE_SECONDS = 7 * 24 * 60 * 60;
const MAX_VISIBLE_CANDLES = 160;
const CHART_UP_COLOR = '#30A46C';
const CHART_DOWN_COLOR = '#E5484D';

interface IChartColors {
  background: string;
  grid: string;
  up: string;
  down: string;
}

function isValidKLinePoint(point: IMarketTokenKLineDataPoint) {
  return (
    Number.isFinite(point.o) &&
    Number.isFinite(point.h) &&
    Number.isFinite(point.l) &&
    Number.isFinite(point.c) &&
    point.h >= point.l
  );
}

function drawKLineChart(
  canvas: HTMLCanvasElement,
  points: IMarketTokenKLineDataPoint[],
  colors: IChartColors,
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

  const padding = 24;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minPrice = Math.min(minPrice, point.l);
    maxPrice = Math.max(maxPrice, point.h);
  }

  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    const y = padding + (chartHeight * index) / 4;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  const priceRange = maxPrice - minPrice;
  const toY = (price: number) =>
    priceRange === 0
      ? height / 2
      : padding + ((maxPrice - price) / priceRange) * chartHeight;
  const candleStep = chartWidth / points.length;
  const candleWidth = Math.max(1, Math.min(candleStep * 0.65, 10));

  points.forEach((point, index) => {
    const color = point.c >= point.o ? colors.up : colors.down;
    const x = padding + candleStep * (index + 0.5);
    const openY = toY(point.o);
    const highY = toY(point.h);
    const lowY = toY(point.l);
    const closeY = toY(point.c);
    const wickWidth = Math.max(1, Math.min(candleWidth * 0.2, 2));

    context.fillStyle = color;
    context.fillRect(
      x - wickWidth / 2,
      highY,
      wickWidth,
      Math.max(lowY - highY, 1),
    );
    context.fillRect(
      x - candleWidth / 2,
      Math.min(openY, closeY),
      candleWidth,
      Math.max(Math.abs(closeY - openY), 1),
    );
  });
}

export const TradingViewNative = memo(
  ({ testID, networkId = '', tokenAddress = '' }: ITradingViewNativeProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [points, setPoints] = useState<IMarketTokenKLineDataPoint[]>([]);
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;

    useEffect(() => {
      let isActive = true;
      setPoints([]);

      if (!networkId) {
        return () => {
          isActive = false;
        };
      }

      const timeTo = Math.floor(Date.now() / 1000);
      void backgroundApiProxy.serviceMarketV2
        .fetchMarketTokenKline({
          tokenAddress,
          networkId,
          interval: KLINE_INTERVAL,
          timeFrom: timeTo - KLINE_RANGE_SECONDS,
          timeTo,
          autoHandleError: false,
        })
        .then((data) => {
          if (isActive) {
            setPoints(
              (data?.points ?? [])
                .filter(isValidKLinePoint)
                .toSorted((a, b) => a.t - b.t)
                .slice(-MAX_VISIBLE_CANDLES),
            );
          }
        })
        .catch(() => {
          if (isActive) {
            setPoints([]);
          }
        });

      return () => {
        isActive = false;
      };
    }, [networkId, tokenAddress]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      const renderChart = () => {
        drawKLineChart(canvas, points, {
          background,
          grid,
          up: CHART_UP_COLOR,
          down: CHART_DOWN_COLOR,
        });
      };
      renderChart();

      const resizeObserver = new ResizeObserver(renderChart);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, [background, grid, points]);

    return (
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <canvas
          ref={canvasRef}
          data-testid={testID}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />
      </Stack>
    );
  },
);

TradingViewNative.displayName = 'TradingViewNative';
