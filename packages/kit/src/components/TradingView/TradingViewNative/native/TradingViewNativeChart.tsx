import { memo, useCallback, useMemo, useState } from 'react';

import {
  Canvas,
  Group,
  Paint,
  Picture,
  type SkPicture,
  Skia,
} from '@shopify/react-native-skia';

import { SizableText, Stack, useTheme } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { LayoutChangeEvent } from 'react-native';

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

interface ITradingViewNativeChartProps {
  isSwitchingInterval: boolean;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
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

export const TradingViewNativeChart = memo(
  ({ isSwitchingInterval, points, testID }: ITradingViewNativeChartProps) => {
    const [chartSize, setChartSize] = useState<IChartSize>({
      height: 0,
      width: 0,
    });
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const chartOpacity = isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1;

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

    return (
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
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
