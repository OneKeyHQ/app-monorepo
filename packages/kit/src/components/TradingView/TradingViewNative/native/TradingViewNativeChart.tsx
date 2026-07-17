import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Canvas,
  Group,
  Paint,
  Picture,
  type SkPicture,
  Skia,
} from '@shopify/react-native-skia';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { SizableText, Stack, useTheme } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
} from '../chartConstants';
import {
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePriceRange,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from '../utils/chartViewport';

const CHART_PADDING = 24;
const VOLUME_HEIGHT_RATIO = 0.2;
const PRICE_VOLUME_GAP_RATIO = 0.04;
const VOLUME_OPACITY = 0.8;
const SWITCHING_INTERVAL_OPACITY = 0.8;
const PRICE_AXIS_WIDTH = 80;
const PRICE_AXIS_TICK_COUNT = 5;
const PRICE_AXIS_LABEL_HEIGHT = 18;
const NATIVE_CANDLE_GAP = 1;
const NATIVE_CANDLE_STEP =
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + NATIVE_CANDLE_GAP;
const PAN_DRAG_RATIO = 1.1;
const PAN_DECELERATION = 0.9982;
const MIN_FLING_VELOCITY = 100;
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
  candlesPicture: SkPicture;
  gridPicture: SkPicture;
  priceTicks: IPriceTick[];
}

interface ITradingViewNativeChartProps {
  isSwitchingInterval: boolean;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
}

interface IVisiblePointRangeState extends ITradingViewNativeVisiblePointRange {
  chartWidth: number;
  points: IMarketTokenKLineDataPoint[];
}

function createKLineChartPictures({
  colors,
  height,
  points,
  visiblePointRange,
  width,
}: IChartSize & {
  colors: IChartColors;
  points: IMarketTokenKLineDataPoint[];
  visiblePointRange: ITradingViewNativeVisiblePointRange;
}): IChartPictureData | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const gridRecorder = Skia.PictureRecorder();
  const gridCanvas = gridRecorder.beginRecording(
    Skia.XYWHRect(0, 0, width, height),
  );
  const candleDataWidth = points.length
    ? TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH +
      (points.length - 1) * NATIVE_CANDLE_STEP
    : 0;
  const candleCullLeft = Math.min(
    0,
    width - PRICE_AXIS_WIDTH - NATIVE_CANDLE_GAP - candleDataWidth,
  );
  const candlesRecorder = Skia.PictureRecorder();
  const candlesCanvas = candlesRecorder.beginRecording(
    Skia.XYWHRect(candleCullLeft, 0, width - candleCullLeft, height),
  );
  const backgroundPaint = Skia.Paint();
  backgroundPaint.setColor(Skia.Color(colors.background));
  gridCanvas.drawRect(Skia.XYWHRect(0, 0, width, height), backgroundPaint);

  const priceTicks: IPriceTick[] = [];
  if (points.length) {
    const priceAxisX = width - PRICE_AXIS_WIDTH;
    const chartWidth = priceAxisX - CHART_PADDING;
    const contentHeight = height - CHART_PADDING * 2;
    const visiblePriceRange = getTradingViewNativePriceRange({
      ...visiblePointRange,
      points,
    });

    if (chartWidth > 0 && contentHeight > 0 && visiblePriceRange) {
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

      const { maxPrice, minPrice } = visiblePriceRange;

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

      gridCanvas.drawLine(
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
        gridCanvas.drawLine(CHART_PADDING, y, priceAxisX + 4, y, gridPaint);
        priceTicks.push({ price, y });
      }

      const toY = (price: number) =>
        priceRange === 0
          ? CHART_PADDING + priceChartHeight / 2
          : CHART_PADDING +
            ((maxPrice - price) / priceRange) * priceChartHeight;
      const lastCandleX =
        priceAxisX -
        NATIVE_CANDLE_GAP -
        TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2;

      points.forEach((point, index) => {
        const color = point.c >= point.o ? colors.up : colors.down;
        const skColor = Skia.Color(color);
        const x =
          lastCandleX - (points.length - index - 1) * NATIVE_CANDLE_STEP;
        const openY = toY(point.o);
        const highY = toY(point.h);
        const lowY = toY(point.l);
        const closeY = toY(point.c);

        candlePaint.setColor(skColor);
        candlePaint.setStrokeWidth(TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH);
        candlesCanvas.drawLine(
          x,
          highY,
          x,
          Math.max(lowY, highY + 1),
          candlePaint,
        );
        candlesCanvas.drawRect(
          Skia.XYWHRect(
            x - TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2,
            Math.min(openY, closeY),
            TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
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
          candlesCanvas.drawRect(
            Skia.XYWHRect(
              x - TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2,
              volumeBottom - volumeBarHeight,
              TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
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

  const gridPicture = gridRecorder.finishRecordingAsPicture();
  const candlesPicture = candlesRecorder.finishRecordingAsPicture();
  gridRecorder.dispose();
  candlesRecorder.dispose();
  backgroundPaint.dispose();

  return { candlesPicture, gridPicture, priceTicks };
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
    const panOffset = useSharedValue(0);
    const zoomScale = useSharedValue(TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE);
    const panStartOffset = useSharedValue(0);
    const pinchStartOffset = useSharedValue(0);
    const pinchStartZoomScale = useSharedValue(
      TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    );
    const pinchAnchorX = useSharedValue(0);
    const previousPointsRef = useRef(points);
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const chartOpacity = isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1;
    const priceAxisX = chartSize.width - PRICE_AXIS_WIDTH;
    const chartWidth = Math.max(priceAxisX - CHART_PADDING, 0);
    const pointCount = points.length;
    const [visiblePointRangeState, setVisiblePointRangeState] =
      useState<IVisiblePointRangeState>(() => ({
        chartWidth: 0,
        endIndex: points.length,
        points,
        startIndex: 0,
      }));
    const defaultVisiblePointRange = useMemo(
      () =>
        getTradingViewNativeVisiblePointRange({
          candleGap: NATIVE_CANDLE_GAP,
          chartWidth,
          offset: 0,
          pointCount,
          zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
        }),
      [chartWidth, pointCount],
    );
    const visiblePointRange: ITradingViewNativeVisiblePointRange =
      visiblePointRangeState.points === points &&
      visiblePointRangeState.chartWidth === chartWidth
        ? visiblePointRangeState
        : defaultVisiblePointRange;

    const handleVisiblePointRangeChange = useCallback(
      (startIndex: number, endIndex: number) => {
        setVisiblePointRangeState((currentState) =>
          currentState.points === points &&
          currentState.chartWidth === chartWidth &&
          currentState.startIndex === startIndex &&
          currentState.endIndex === endIndex
            ? currentState
            : {
                chartWidth,
                endIndex,
                points,
                startIndex,
              },
        );
      },
      [chartWidth, points],
    );

    useAnimatedReaction(
      () => {
        const range = getTradingViewNativeVisiblePointRange({
          candleGap: NATIVE_CANDLE_GAP,
          chartWidth,
          offset: panOffset.value,
          pointCount,
          zoomScale: zoomScale.value,
        });
        return {
          chartWidth,
          ...range,
        };
      },
      (currentRange, previousRange) => {
        'worklet';

        if (
          currentRange.chartWidth !== previousRange?.chartWidth ||
          currentRange.startIndex !== previousRange?.startIndex ||
          currentRange.endIndex !== previousRange?.endIndex
        ) {
          scheduleOnRN(
            handleVisiblePointRangeChange,
            currentRange.startIndex,
            currentRange.endIndex,
          );
        }
      },
    );

    const chartPictureData = useMemo(
      () =>
        createKLineChartPictures({
          ...chartSize,
          colors: {
            background,
            grid,
            up: CHART_UP_COLOR,
            down: CHART_DOWN_COLOR,
          },
          points,
          visiblePointRange,
        }),
      [background, chartSize, grid, points, visiblePointRange],
    );

    useLayoutEffect(() => {
      const shouldResetViewport = previousPointsRef.current !== points;
      previousPointsRef.current = points;
      scheduleOnUI(() => {
        'worklet';

        cancelAnimation(panOffset);
        if (shouldResetViewport) {
          panOffset.value = 0;
          zoomScale.value = TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE;
          return;
        }
        panOffset.value = clampTradingViewNativePanOffset({
          candleGap: NATIVE_CANDLE_GAP,
          chartWidth,
          offset: panOffset.value,
          pointCount,
          zoomScale: zoomScale.value,
        });
      });
    }, [chartWidth, panOffset, pointCount, points, zoomScale]);

    const chartTransform = useDerivedValue(() => [
      { translateX: panOffset.value },
      { scaleX: zoomScale.value },
    ]);

    const chartGestures = useMemo(() => {
      const panGesture = Gesture.Pan()
        .onBegin(() => {
          'worklet';

          cancelAnimation(panOffset);
        })
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .maxPointers(1)
        .onStart(() => {
          'worklet';

          panStartOffset.value = clampTradingViewNativePanOffset({
            candleGap: NATIVE_CANDLE_GAP,
            chartWidth,
            offset: panOffset.value,
            pointCount,
            zoomScale: zoomScale.value,
          });
        })
        .onUpdate((event) => {
          'worklet';

          panOffset.value = clampTradingViewNativePanOffset({
            candleGap: NATIVE_CANDLE_GAP,
            chartWidth,
            offset: panStartOffset.value + event.translationX * PAN_DRAG_RATIO,
            pointCount,
            zoomScale: zoomScale.value,
          });
        })
        .onEnd((event) => {
          'worklet';

          const maxOffset = getTradingViewNativeMaxPanOffset({
            candleGap: NATIVE_CANDLE_GAP,
            chartWidth,
            pointCount,
            zoomScale: zoomScale.value,
          });
          if (maxOffset <= 0) {
            panOffset.value = 0;
            return;
          }
          if (Math.abs(event.velocityX) < MIN_FLING_VELOCITY) {
            return;
          }
          panOffset.value = withDecay({
            clamp: [0, maxOffset],
            deceleration: PAN_DECELERATION,
            velocity: event.velocityX * PAN_DRAG_RATIO,
          });
        });

      const pinchGesture = Gesture.Pinch()
        .onStart((event) => {
          'worklet';

          cancelAnimation(panOffset);
          pinchStartOffset.value = clampTradingViewNativePanOffset({
            candleGap: NATIVE_CANDLE_GAP,
            chartWidth,
            offset: panOffset.value,
            pointCount,
            zoomScale: zoomScale.value,
          });
          pinchStartZoomScale.value = zoomScale.value;
          pinchAnchorX.value = event.focalX - CHART_PADDING;
        })
        .onUpdate((event) => {
          'worklet';

          const nextViewport = getTradingViewNativeZoomedViewport({
            anchorX: pinchAnchorX.value,
            candleGap: NATIVE_CANDLE_GAP,
            chartWidth,
            currentOffset: pinchStartOffset.value,
            currentZoomScale: pinchStartZoomScale.value,
            nextZoomScale: pinchStartZoomScale.value * event.scale,
            pointCount,
          });
          panOffset.value = nextViewport.offset;
          zoomScale.value = nextViewport.zoomScale;
        });

      return Gesture.Race(panGesture, pinchGesture);
    }, [
      chartWidth,
      panOffset,
      panStartOffset,
      pinchAnchorX,
      pinchStartOffset,
      pinchStartZoomScale,
      pointCount,
      zoomScale,
    ]);

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
          <GestureDetector gesture={chartGestures}>
            <Canvas testID={testID} style={{ flex: 1 }}>
              <Group layer={<Paint opacity={chartOpacity} />}>
                <Picture picture={chartPictureData.gridPicture} />
                <Group
                  clip={Skia.XYWHRect(
                    CHART_PADDING,
                    0,
                    chartWidth,
                    chartSize.height,
                  )}
                >
                  <Group
                    origin={{ x: priceAxisX, y: 0 }}
                    transform={chartTransform}
                  >
                    <Picture picture={chartPictureData.candlesPicture} />
                  </Group>
                </Group>
              </Group>
            </Canvas>
          </GestureDetector>
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
