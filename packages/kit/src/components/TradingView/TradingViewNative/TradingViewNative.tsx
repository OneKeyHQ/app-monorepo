import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

import type { ITradingViewNativeProps } from './types';
import type { ITradingViewIntervalOption } from '../TradingViewV2/types';

const DEFAULT_KLINE_INTERVAL = '60';
const MIN_KLINE_RANGE_SECONDS = 2 * 24 * 60 * 60;
const MAX_KLINE_RANGE_SECONDS = 5 * 365 * 24 * 60 * 60;
const MAX_VISIBLE_CANDLES = 160;
const VOLUME_HEIGHT_RATIO = 0.2;
const PRICE_VOLUME_GAP_RATIO = 0.04;
const VOLUME_OPACITY = 0.8;
const SWITCHING_INTERVAL_OPACITY = 0.8;
const PRICE_AXIS_WIDTH = 80;
const PRICE_AXIS_TICK_COUNT = 5;
const CHART_UP_COLOR = '#30A46C';
const CHART_DOWN_COLOR = '#E5484D';

const KLINE_INTERVALS: (ITradingViewIntervalOption & {
  seconds: number;
})[] = [
  { label: '1m', value: '1', seconds: 60 },
  { label: '15m', value: '15', seconds: 15 * 60 },
  { label: '1H', value: '60', seconds: 60 * 60 },
  { label: '4H', value: '240', seconds: 4 * 60 * 60 },
  { label: '1D', value: '1D', seconds: 24 * 60 * 60 },
  { label: '1W', value: '1W', seconds: 7 * 24 * 60 * 60 },
];

interface IChartColors {
  axisText: string;
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
  const priceAxisX = width - PRICE_AXIS_WIDTH;
  const chartWidth = priceAxisX - padding;
  const contentHeight = height - padding * 2;
  if (chartWidth <= 0 || contentHeight <= 0) {
    return;
  }

  const volumeHeight = contentHeight * VOLUME_HEIGHT_RATIO;
  const priceChartHeight =
    contentHeight * (1 - VOLUME_HEIGHT_RATIO - PRICE_VOLUME_GAP_RATIO);
  const volumeBottom = height - padding;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;
  let maxVolume = 0;

  for (const point of points) {
    minPrice = Math.min(minPrice, point.l);
    maxPrice = Math.max(maxPrice, point.h);
    if (Number.isFinite(point.v)) {
      maxVolume = Math.max(maxVolume, point.v);
    }
  }

  const priceRange = maxPrice - minPrice;
  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(priceAxisX, padding);
  context.lineTo(priceAxisX, padding + priceChartHeight);
  context.stroke();

  context.fillStyle = colors.axisText;
  context.font = '11px sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  const priceTickCount = priceRange === 0 ? 1 : PRICE_AXIS_TICK_COUNT;
  for (let index = 0; index < priceTickCount; index += 1) {
    const progress = priceTickCount === 1 ? 0.5 : index / (priceTickCount - 1);
    const y = padding + priceChartHeight * progress;
    const price = maxPrice - priceRange * progress;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(priceAxisX + 4, y);
    context.stroke();
    context.fillText(Number(price.toPrecision(6)).toString(), width - 8, y);
  }

  const toY = (price: number) =>
    priceRange === 0
      ? padding + priceChartHeight / 2
      : padding + ((maxPrice - price) / priceRange) * priceChartHeight;
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

    if (maxVolume > 0 && Number.isFinite(point.v) && point.v > 0) {
      const volumeBarHeight = Math.max((point.v / maxVolume) * volumeHeight, 1);
      context.globalAlpha = VOLUME_OPACITY;
      context.fillRect(
        x - candleWidth / 2,
        volumeBottom - volumeBarHeight,
        candleWidth,
        volumeBarHeight,
      );
      context.globalAlpha = 1;
    }
  });
}

export const TradingViewNative = memo(
  ({
    testID,
    networkId = '',
    tokenAddress = '',
    nativeControlsLayoutMode,
  }: ITradingViewNativeProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const marketIdentityRef = useRef({ networkId, tokenAddress });
    const [points, setPoints] = useState<IMarketTokenKLineDataPoint[]>([]);
    const [kLineInterval, setKLineInterval] = useState(DEFAULT_KLINE_INTERVAL);
    const [isSwitchingInterval, setIsSwitchingInterval] = useState(false);
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;

    const intervalConfig = useMemo(
      () => ({
        intervals: KLINE_INTERVALS,
        activeInterval: kLineInterval,
      }),
      [kLineInterval],
    );

    const handleIntervalChange = useCallback(
      (interval: string) => {
        if (
          interval !== kLineInterval &&
          KLINE_INTERVALS.some((option) => option.value === interval)
        ) {
          setIsSwitchingInterval(true);
          setKLineInterval(interval);
        }
      },
      [kLineInterval],
    );

    useEffect(() => {
      let isActive = true;
      const previousMarketIdentity = marketIdentityRef.current;
      const hasMarketIdentityChanged =
        previousMarketIdentity.networkId !== networkId ||
        previousMarketIdentity.tokenAddress !== tokenAddress;
      marketIdentityRef.current = { networkId, tokenAddress };

      if (hasMarketIdentityChanged) {
        setIsSwitchingInterval(false);
        setPoints([]);
      }

      if (!networkId) {
        return () => {
          isActive = false;
        };
      }

      const selectedInterval =
        KLINE_INTERVALS.find((option) => option.value === kLineInterval) ??
        KLINE_INTERVALS[2];
      const kLineRangeSeconds = Math.min(
        MAX_KLINE_RANGE_SECONDS,
        Math.max(
          MIN_KLINE_RANGE_SECONDS,
          selectedInterval.seconds * MAX_VISIBLE_CANDLES,
        ),
      );
      const timeTo = Math.floor(Date.now() / 1000);
      void backgroundApiProxy.serviceMarketV2
        .fetchMarketTokenKline({
          tokenAddress,
          networkId,
          interval: selectedInterval.label,
          timeFrom: timeTo - kLineRangeSeconds,
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
            setIsSwitchingInterval(false);
          }
        })
        .catch(() => {
          if (isActive) {
            setIsSwitchingInterval(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [kLineInterval, networkId, tokenAddress]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      const renderChart = () => {
        drawKLineChart(canvas, points, {
          axisText,
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
    }, [axisText, background, grid, points]);

    return (
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <TradingViewNativeChartControlsContainer
          intervalConfig={intervalConfig}
          layoutMode={nativeControlsLayoutMode}
          onIntervalChange={handleIntervalChange}
        />
        <Stack
          flex={1}
          minHeight={0}
          opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
        >
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
      </Stack>
    );
  },
);

TradingViewNative.displayName = 'TradingViewNative';
