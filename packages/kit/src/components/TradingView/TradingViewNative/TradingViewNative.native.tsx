import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Canvas,
  Group,
  Paint,
  Picture,
  type SkPicture,
  Skia,
} from '@shopify/react-native-skia';

import { SizableText, Stack, useTheme } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

import type { ITradingViewNativeProps } from './types';
import type { ITradingViewIntervalOption } from '../TradingViewV2/types';
import type { LayoutChangeEvent } from 'react-native';

const DEFAULT_KLINE_INTERVAL = '60';
const MIN_KLINE_RANGE_SECONDS = 2 * 24 * 60 * 60;
const MAX_KLINE_RANGE_SECONDS = 5 * 365 * 24 * 60 * 60;
const MAX_VISIBLE_CANDLES = 160;
const CHART_PADDING = 24;
const VOLUME_HEIGHT_RATIO = 0.2;
const PRICE_VOLUME_GAP_RATIO = 0.04;
const VOLUME_OPACITY = 0.8;
const SWITCHING_INTERVAL_OPACITY = 0.8;
const PRICE_AXIS_WIDTH = 80;
const PRICE_AXIS_TICK_COUNT = 5;
const PRICE_AXIS_LABEL_HEIGHT = 18;
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

interface IChartSize {
  height: number;
  width: number;
}

interface IChartColors {
  background: string;
  grid: string;
  up: string;
  down: string;
}

interface IPriceTick {
  price: number;
  y: number;
}

interface IChartPictureData {
  picture: SkPicture;
  priceTicks: IPriceTick[];
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

function createKLineChartPicture({
  colors,
  height,
  points,
  width,
}: IChartSize & {
  colors: IChartColors;
  points: IMarketTokenKLineDataPoint[];
}): IChartPictureData | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  const backgroundPaint = Skia.Paint();
  backgroundPaint.setColor(Skia.Color(colors.background));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), backgroundPaint);

  const priceTicks: IPriceTick[] = [];
  if (points.length) {
    const priceAxisX = width - PRICE_AXIS_WIDTH;
    const chartWidth = priceAxisX - CHART_PADDING;
    const contentHeight = height - CHART_PADDING * 2;

    if (chartWidth > 0 && contentHeight > 0) {
      const volumeHeight = contentHeight * VOLUME_HEIGHT_RATIO;
      const priceChartHeight =
        contentHeight * (1 - VOLUME_HEIGHT_RATIO - PRICE_VOLUME_GAP_RATIO);
      const volumeBottom = height - CHART_PADDING;
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

      const gridPaint = Skia.Paint();
      gridPaint.setAntiAlias(true);
      gridPaint.setColor(Skia.Color(colors.grid));
      gridPaint.setStrokeWidth(1);

      const candlePaint = Skia.Paint();
      candlePaint.setAntiAlias(true);

      const volumePaint = Skia.Paint();
      volumePaint.setAntiAlias(true);

      const priceRange = maxPrice - minPrice;
      const priceTickCount = priceRange === 0 ? 1 : PRICE_AXIS_TICK_COUNT;

      canvas.drawLine(
        priceAxisX,
        CHART_PADDING,
        priceAxisX,
        CHART_PADDING + priceChartHeight,
        gridPaint,
      );

      for (let index = 0; index < priceTickCount; index += 1) {
        const progress =
          priceTickCount === 1 ? 0.5 : index / (priceTickCount - 1);
        const y = CHART_PADDING + priceChartHeight * progress;
        const price = maxPrice - priceRange * progress;
        canvas.drawLine(CHART_PADDING, y, priceAxisX + 4, y, gridPaint);
        priceTicks.push({ price, y });
      }

      const toY = (price: number) =>
        priceRange === 0
          ? CHART_PADDING + priceChartHeight / 2
          : CHART_PADDING +
            ((maxPrice - price) / priceRange) * priceChartHeight;
      const candleStep = chartWidth / points.length;
      const candleWidth = Math.max(1, Math.min(candleStep * 0.65, 10));

      points.forEach((point, index) => {
        const color = point.c >= point.o ? colors.up : colors.down;
        const skColor = Skia.Color(color);
        const x = CHART_PADDING + candleStep * (index + 0.5);
        const openY = toY(point.o);
        const highY = toY(point.h);
        const lowY = toY(point.l);
        const closeY = toY(point.c);
        const wickWidth = Math.max(1, Math.min(candleWidth * 0.2, 2));

        candlePaint.setColor(skColor);
        candlePaint.setStrokeWidth(wickWidth);
        canvas.drawLine(x, highY, x, Math.max(lowY, highY + 1), candlePaint);
        canvas.drawRect(
          Skia.XYWHRect(
            x - candleWidth / 2,
            Math.min(openY, closeY),
            candleWidth,
            Math.max(Math.abs(closeY - openY), 1),
          ),
          candlePaint,
        );

        if (maxVolume > 0 && Number.isFinite(point.v) && point.v > 0) {
          const volumeBarHeight = Math.max(
            (point.v / maxVolume) * volumeHeight,
            1,
          );
          volumePaint.setColor(
            Float32Array.of(skColor[0], skColor[1], skColor[2], VOLUME_OPACITY),
          );
          canvas.drawRect(
            Skia.XYWHRect(
              x - candleWidth / 2,
              volumeBottom - volumeBarHeight,
              candleWidth,
              volumeBarHeight,
            ),
            volumePaint,
          );
        }
      });

      gridPaint.dispose();
      candlePaint.dispose();
      volumePaint.dispose();
    }
  }

  const picture = recorder.finishRecordingAsPicture();
  recorder.dispose();
  backgroundPaint.dispose();

  return { picture, priceTicks };
}

function formatPriceTick(price: number) {
  return Number(price.toPrecision(6)).toString();
}

export const TradingViewNative = memo(
  ({
    testID,
    networkId = '',
    tokenAddress = '',
    nativeControlsLayoutMode,
    onNativeSubIndicatorCountChange,
  }: ITradingViewNativeProps) => {
    const marketIdentityRef = useRef({ networkId, tokenAddress });
    const [chartSize, setChartSize] = useState<IChartSize>({
      height: 0,
      width: 0,
    });
    const [points, setPoints] = useState<IMarketTokenKLineDataPoint[]>([]);
    const [kLineInterval, setKLineInterval] = useState(DEFAULT_KLINE_INTERVAL);
    const [isSwitchingInterval, setIsSwitchingInterval] = useState(false);
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const chartOpacity = isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1;

    const intervalConfig = useMemo(
      () => ({
        intervals: KLINE_INTERVALS,
        activeInterval: kLineInterval,
      }),
      [kLineInterval],
    );

    const chartPictureData = useMemo(
      () =>
        createKLineChartPicture({
          ...chartSize,
          colors: {
            background,
            grid,
            up: CHART_UP_COLOR,
            down: CHART_DOWN_COLOR,
          },
          points,
        }),
      [background, chartSize, grid, points],
    );

    const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      const nextSize = {
        height: Math.round(height),
        width: Math.round(width),
      };
      setChartSize((currentSize) =>
        currentSize.height === nextSize.height &&
        currentSize.width === nextSize.width
          ? currentSize
          : nextSize,
      );
    }, []);

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
      onNativeSubIndicatorCountChange?.(0);
    }, [onNativeSubIndicatorCountChange]);

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

    return (
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <TradingViewNativeChartControlsContainer
          intervalConfig={intervalConfig}
          layoutMode={nativeControlsLayoutMode}
          onIntervalChange={handleIntervalChange}
        />
        <Stack flex={1} minHeight={0} onLayout={handleChartLayout}>
          {chartPictureData ? (
            <Canvas testID={testID} pointerEvents="none" style={{ flex: 1 }}>
              <Group layer={<Paint opacity={chartOpacity} />}>
                <Picture picture={chartPictureData.picture} />
              </Group>
            </Canvas>
          ) : null}
          {chartPictureData?.priceTicks.map(({ price, y }, index) => (
            <SizableText
              key={`${index}-${price}`}
              position="absolute"
              top={y - PRICE_AXIS_LABEL_HEIGHT / 2}
              right="$2"
              w={PRICE_AXIS_WIDTH - 12}
              color="$textSubdued"
              size="$bodySm"
              numberOfLines={1}
              pointerEvents="none"
              textAlign="right"
              opacity={chartOpacity}
            >
              {formatPriceTick(price)}
            </SizableText>
          ))}
        </Stack>
      </Stack>
    );
  },
);

TradingViewNative.displayName = 'TradingViewNative';
