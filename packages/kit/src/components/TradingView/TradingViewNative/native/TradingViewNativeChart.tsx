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
  Line,
  Paint,
  Picture,
  type SkFont,
  type SkPicture,
  Skia,
  Text,
  matchFont,
} from '@shopify/react-native-skia';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  type SharedValue,
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Stack, useTheme } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_CHART_VERTICAL_PADDING as CHART_VERTICAL_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_WIDTH as PRICE_AXIS_WIDTH,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT as TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_VOLUME_OPACITY as VOLUME_OPACITY,
} from '../chartConstants';
import {
  type ITradingViewNativeTimeTick,
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceTransform,
  getTradingViewNativePriceY,
  getTradingViewNativeTimeAxisLayout,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
} from '../utils/chartLayout';
import {
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  getTradingViewNativeCandleX,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePriceRange,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from '../utils/chartViewport';

const PRICE_AXIS_FONT_SIZE = 12;
const PRICE_AXIS_TEXT_BASELINE_OFFSET = PRICE_AXIS_FONT_SIZE / 2 - 1;
const PRICE_AXIS_TICK_PROGRESS = [0, 0.25, 0.5, 0.75, 1] as const;
const TIME_AXIS_FONT_SIZE = 12;
const TIME_AXIS_TEXT_BASELINE_OFFSET =
  (TIME_AXIS_HEIGHT + TIME_AXIS_FONT_SIZE) / 2;
const NATIVE_CANDLE_GAP = 1;
const NATIVE_CANDLE_STEP =
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + NATIVE_CANDLE_GAP;
const PAN_DRAG_RATIO = 1.1;
const PAN_DECELERATION = 0.9982;
const MIN_FLING_VELOCITY = 100;

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

interface IChartPictureData {
  baseMaxPrice: number;
  basePriceRange: number;
  gridPicture: SkPicture;
  priceChartHeight: number;
  pricePicture: SkPicture;
  volumePicture: SkPicture;
}

interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  isSwitchingInterval: boolean;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
}

interface IVisiblePointRangeState extends ITradingViewNativeVisiblePointRange {
  chartWidth: number;
  minimumTimeTickIndexSpacing: number;
  points: IMarketTokenKLineDataPoint[];
}

function createKLineChartPictures({
  candleIntervalSeconds,
  colors,
  height,
  points,
  width,
}: IChartSize & {
  candleIntervalSeconds: number;
  colors: IChartColors;
  points: IMarketTokenKLineDataPoint[];
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
  const priceRecorder = Skia.PictureRecorder();
  const priceCanvas = priceRecorder.beginRecording(
    Skia.XYWHRect(candleCullLeft, 0, width - candleCullLeft, height),
  );
  const volumeRecorder = Skia.PictureRecorder();
  const volumeCanvas = volumeRecorder.beginRecording(
    Skia.XYWHRect(candleCullLeft, 0, width - candleCullLeft, height),
  );
  const backgroundPaint = Skia.Paint();
  backgroundPaint.setColor(Skia.Color(colors.background));
  gridCanvas.drawRect(Skia.XYWHRect(0, 0, width, height), backgroundPaint);
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds,
    height,
    minimumTimeTickIndexSpacing: Number.MAX_SAFE_INTEGER,
    points,
    visiblePointRange: { endIndex: points.length, startIndex: 0 },
    width,
  });

  if (layout) {
    const {
      maxVolume,
      priceAxisX,
      priceTicks,
      timeAxisY,
      volumeBottom,
      volumeHeight,
    } = layout;
    const gridPaint = Skia.Paint();
    gridPaint.setAntiAlias(true);
    gridPaint.setColor(Skia.Color(colors.grid));
    gridPaint.setStrokeWidth(1);

    const candlePaint = Skia.Paint();
    candlePaint.setAntiAlias(true);

    const volumePaint = Skia.Paint();
    volumePaint.setAntiAlias(true);

    gridCanvas.drawLine(
      priceAxisX,
      CHART_VERTICAL_PADDING,
      priceAxisX,
      timeAxisY,
      gridPaint,
    );
    gridCanvas.drawLine(
      CHART_HORIZONTAL_PADDING,
      timeAxisY,
      priceAxisX,
      timeAxisY,
      gridPaint,
    );

    for (const { y } of priceTicks) {
      gridCanvas.drawLine(
        CHART_HORIZONTAL_PADDING,
        y,
        priceAxisX + 4,
        y,
        gridPaint,
      );
    }

    const toY = (price: number) => getTradingViewNativePriceY(price, layout);

    points.forEach((point, index) => {
      const color = point.c >= point.o ? colors.up : colors.down;
      const skColor = Skia.Color(color);
      const x = getTradingViewNativeCandleX({
        candleGap: NATIVE_CANDLE_GAP,
        index,
        offset: 0,
        pointCount: points.length,
        priceAxisX,
        zoomScale: 1,
      });
      const openY = toY(point.o);
      const highY = toY(point.h);
      const lowY = toY(point.l);
      const closeY = toY(point.c);

      candlePaint.setColor(skColor);
      candlePaint.setStrokeWidth(TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH);
      priceCanvas.drawLine(x, highY, x, Math.max(lowY, highY + 1), candlePaint);
      priceCanvas.drawRect(
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
        volumeCanvas.drawRect(
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

  const gridPicture = gridRecorder.finishRecordingAsPicture();
  const pricePicture = priceRecorder.finishRecordingAsPicture();
  const volumePicture = volumeRecorder.finishRecordingAsPicture();
  gridRecorder.dispose();
  priceRecorder.dispose();
  volumeRecorder.dispose();
  backgroundPaint.dispose();

  return {
    baseMaxPrice: layout?.maxPrice ?? 0,
    basePriceRange: layout?.priceRange ?? 0,
    gridPicture,
    priceChartHeight: layout?.priceChartHeight ?? 0,
    pricePicture,
    volumePicture,
  };
}

function TradingViewNativeTimeTick({
  font,
  gridColor,
  panOffset,
  pointCount,
  priceAxisX,
  textColor,
  tick,
  timeAxisY,
  zoomScale,
}: {
  font: SkFont;
  gridColor: string;
  panOffset: SharedValue<number>;
  pointCount: number;
  priceAxisX: number;
  textColor: string;
  tick: ITradingViewNativeTimeTick;
  timeAxisY: number;
  zoomScale: SharedValue<number>;
}) {
  const labelWidth = font.measureText(tick.label).width;
  const transform = useDerivedValue(() => [
    {
      translateX: getTradingViewNativeCandleX({
        candleGap: NATIVE_CANDLE_GAP,
        index: tick.index,
        offset: panOffset.value,
        pointCount,
        priceAxisX,
        zoomScale: zoomScale.value,
      }),
    },
  ]);

  return (
    <Group transform={transform}>
      <Line
        color={gridColor}
        p1={{ x: 0, y: CHART_VERTICAL_PADDING }}
        p2={{ x: 0, y: timeAxisY }}
        strokeWidth={1}
      />
      <Text
        color={textColor}
        font={font}
        text={tick.label}
        x={-labelWidth / 2}
        y={timeAxisY + TIME_AXIS_TEXT_BASELINE_OFFSET}
      />
    </Group>
  );
}

function TradingViewNativePriceTick({
  chartOpacity,
  font,
  maxPrice,
  minPrice,
  priceChartHeight,
  progress,
  textColor,
  width,
}: {
  chartOpacity: number;
  font: SkFont;
  maxPrice: SharedValue<number>;
  minPrice: SharedValue<number>;
  priceChartHeight: number;
  progress: number;
  textColor: string;
  width: number;
}) {
  const text = useDerivedValue(() => {
    if (!Number.isFinite(maxPrice.value) || !Number.isFinite(minPrice.value)) {
      return '';
    }
    return formatTradingViewNativePriceTick(
      maxPrice.value - (maxPrice.value - minPrice.value) * progress,
    );
  });
  const x = useDerivedValue(() => width - font.measureText(text.value).width);
  const opacity = useDerivedValue(() => {
    if (!Number.isFinite(maxPrice.value) || !Number.isFinite(minPrice.value)) {
      return 0;
    }
    return maxPrice.value === minPrice.value && progress !== 0.5
      ? 0
      : chartOpacity;
  });

  return (
    <Text
      color={textColor}
      font={font}
      opacity={opacity}
      text={text}
      x={x}
      y={
        CHART_VERTICAL_PADDING +
        priceChartHeight * progress +
        PRICE_AXIS_TEXT_BASELINE_OFFSET
      }
    />
  );
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    isSwitchingInterval,
    points,
    testID,
  }: ITradingViewNativeChartProps) => {
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
    const priceScaleY = useSharedValue(1);
    const priceTranslateY = useSharedValue(0);
    const visibleMaxPrice = useSharedValue(Number.NaN);
    const visibleMinPrice = useSharedValue(Number.NaN);
    const previousPointsRef = useRef(points);
    const theme = useTheme();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;
    const timeAxisFont = useMemo(
      () =>
        matchFont({
          fontFamily: 'System',
          fontSize: TIME_AXIS_FONT_SIZE,
          fontWeight: '400',
        }),
      [],
    );
    const chartOpacity = isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1;
    const priceAxisX = chartSize.width - PRICE_AXIS_WIDTH;
    const chartWidth = getTradingViewNativeChartWidth(chartSize.width);
    const pointCount = points.length;
    const chartPictureData = useMemo(
      () =>
        createKLineChartPictures({
          ...chartSize,
          candleIntervalSeconds,
          colors: {
            background,
            grid,
            up: CHART_UP_COLOR,
            down: CHART_DOWN_COLOR,
          },
          points,
        }),
      [background, candleIntervalSeconds, chartSize, grid, points],
    );
    const [visiblePointRangeState, setVisiblePointRangeState] =
      useState<IVisiblePointRangeState>(() => ({
        chartWidth: 0,
        endIndex: points.length,
        minimumTimeTickIndexSpacing:
          getTradingViewNativeTimeTickMinimumIndexSpacing(
            NATIVE_CANDLE_STEP * TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
          ),
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
    const defaultVisiblePriceRange = useMemo(
      () =>
        getTradingViewNativePriceRange({
          ...defaultVisiblePointRange,
          points,
        }),
      [defaultVisiblePointRange, points],
    );
    const hasCurrentVisiblePointRange =
      visiblePointRangeState.points === points &&
      visiblePointRangeState.chartWidth === chartWidth;
    const visiblePointRange: ITradingViewNativeVisiblePointRange =
      hasCurrentVisiblePointRange
        ? visiblePointRangeState
        : defaultVisiblePointRange;
    const minimumTimeTickIndexSpacing = hasCurrentVisiblePointRange
      ? visiblePointRangeState.minimumTimeTickIndexSpacing
      : getTradingViewNativeTimeTickMinimumIndexSpacing(
          NATIVE_CANDLE_STEP * TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
        );
    const timeTicks = useMemo(
      () =>
        getTradingViewNativeTimeAxisLayout({
          candleIntervalSeconds,
          chartWidth,
          ...visiblePointRange,
          minimumIndexSpacing: minimumTimeTickIndexSpacing,
          points,
        }).ticks,
      [
        candleIntervalSeconds,
        chartWidth,
        minimumTimeTickIndexSpacing,
        points,
        visiblePointRange,
      ],
    );
    const defaultPriceTransform = useMemo(() => {
      if (!chartPictureData || !defaultVisiblePriceRange) {
        return { scaleY: 1, translateY: 0 };
      }
      return getTradingViewNativePriceTransform({
        baseMaxPrice: chartPictureData.baseMaxPrice,
        basePriceRange: chartPictureData.basePriceRange,
        priceChartHeight: chartPictureData.priceChartHeight,
        targetMaxPrice: defaultVisiblePriceRange.maxPrice,
        targetPriceRange:
          defaultVisiblePriceRange.maxPrice - defaultVisiblePriceRange.minPrice,
      });
    }, [chartPictureData, defaultVisiblePriceRange]);

    const handleVisiblePointRangeChange = useCallback(
      (
        startIndex: number,
        endIndex: number,
        nextMinimumTimeTickIndexSpacing: number,
      ) => {
        setVisiblePointRangeState((currentState) =>
          currentState.points === points &&
          currentState.chartWidth === chartWidth &&
          currentState.startIndex === startIndex &&
          currentState.endIndex === endIndex &&
          currentState.minimumTimeTickIndexSpacing ===
            nextMinimumTimeTickIndexSpacing
            ? currentState
            : {
                chartWidth,
                endIndex,
                minimumTimeTickIndexSpacing: nextMinimumTimeTickIndexSpacing,
                points,
                startIndex,
              },
        );
      },
      [chartWidth, points],
    );

    const baseMaxPrice = chartPictureData?.baseMaxPrice ?? 0;
    const basePriceRange = chartPictureData?.basePriceRange ?? 0;
    const priceChartHeight = chartPictureData?.priceChartHeight ?? 0;

    useAnimatedReaction(
      () => {
        const range = getTradingViewNativeVisiblePointRange({
          candleGap: NATIVE_CANDLE_GAP,
          chartWidth,
          offset: panOffset.value,
          pointCount,
          zoomScale: zoomScale.value,
        });
        const visiblePriceRange = getTradingViewNativePriceRange({
          ...range,
          points,
        });
        const targetTransform = visiblePriceRange
          ? getTradingViewNativePriceTransform({
              baseMaxPrice,
              basePriceRange,
              priceChartHeight,
              targetMaxPrice: visiblePriceRange.maxPrice,
              targetPriceRange:
                visiblePriceRange.maxPrice - visiblePriceRange.minPrice,
            })
          : { scaleY: 1, translateY: 0 };
        return {
          chartWidth,
          maxPrice: visiblePriceRange?.maxPrice ?? null,
          minPrice: visiblePriceRange?.minPrice ?? null,
          minimumTimeTickIndexSpacing:
            getTradingViewNativeTimeTickMinimumIndexSpacing(
              NATIVE_CANDLE_STEP * zoomScale.value,
            ),
          targetScaleY: targetTransform.scaleY,
          targetTranslateY: targetTransform.translateY,
          ...range,
        };
      },
      (currentRange, previousRange) => {
        'worklet';

        if (
          currentRange.chartWidth !== previousRange?.chartWidth ||
          currentRange.startIndex !== previousRange?.startIndex ||
          currentRange.endIndex !== previousRange?.endIndex ||
          currentRange.minimumTimeTickIndexSpacing !==
            previousRange?.minimumTimeTickIndexSpacing
        ) {
          scheduleOnRN(
            handleVisiblePointRangeChange,
            currentRange.startIndex,
            currentRange.endIndex,
            currentRange.minimumTimeTickIndexSpacing,
          );
        }

        if (
          currentRange.targetScaleY !== previousRange?.targetScaleY ||
          currentRange.targetTranslateY !== previousRange?.targetTranslateY
        ) {
          priceScaleY.value = currentRange.targetScaleY;
          priceTranslateY.value = currentRange.targetTranslateY;
        }
        if (
          currentRange.maxPrice !== previousRange?.maxPrice ||
          currentRange.minPrice !== previousRange?.minPrice
        ) {
          visibleMaxPrice.value = currentRange.maxPrice ?? Number.NaN;
          visibleMinPrice.value = currentRange.minPrice ?? Number.NaN;
        }
      },
    );

    useLayoutEffect(() => {
      const shouldResetViewport = previousPointsRef.current !== points;
      previousPointsRef.current = points;
      scheduleOnUI(() => {
        'worklet';

        cancelAnimation(panOffset);
        if (shouldResetViewport) {
          panOffset.value = 0;
          priceScaleY.value = defaultPriceTransform.scaleY;
          priceTranslateY.value = defaultPriceTransform.translateY;
          visibleMaxPrice.value =
            defaultVisiblePriceRange?.maxPrice ?? Number.NaN;
          visibleMinPrice.value =
            defaultVisiblePriceRange?.minPrice ?? Number.NaN;
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
    }, [
      chartWidth,
      defaultPriceTransform.scaleY,
      defaultPriceTransform.translateY,
      defaultVisiblePriceRange?.maxPrice,
      defaultVisiblePriceRange?.minPrice,
      panOffset,
      pointCount,
      points,
      priceScaleY,
      priceTranslateY,
      visibleMaxPrice,
      visibleMinPrice,
      zoomScale,
    ]);

    const chartTransform = useDerivedValue(() => [
      { translateX: panOffset.value },
      { scaleX: zoomScale.value },
    ]);
    const priceTransform = useDerivedValue(() => [
      { translateY: priceTranslateY.value },
      { scaleY: priceScaleY.value },
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
          pinchAnchorX.value = event.focalX - CHART_HORIZONTAL_PADDING;
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
                    CHART_HORIZONTAL_PADDING,
                    0,
                    chartWidth,
                    chartSize.height,
                  )}
                >
                  {timeTicks.map((tick) => (
                    <TradingViewNativeTimeTick
                      key={`${tick.timestamp}-${tick.index}`}
                      font={timeAxisFont}
                      gridColor={grid}
                      panOffset={panOffset}
                      pointCount={pointCount}
                      priceAxisX={priceAxisX}
                      textColor={axisText}
                      tick={tick}
                      timeAxisY={chartSize.height - TIME_AXIS_HEIGHT}
                      zoomScale={zoomScale}
                    />
                  ))}
                  <Group
                    origin={{ x: priceAxisX, y: 0 }}
                    transform={chartTransform}
                  >
                    <Group transform={priceTransform}>
                      <Picture picture={chartPictureData.pricePicture} />
                    </Group>
                    <Picture picture={chartPictureData.volumePicture} />
                  </Group>
                </Group>
              </Group>
              {PRICE_AXIS_TICK_PROGRESS.map((progress) => (
                <TradingViewNativePriceTick
                  key={progress}
                  chartOpacity={chartOpacity}
                  font={timeAxisFont}
                  maxPrice={visibleMaxPrice}
                  minPrice={visibleMinPrice}
                  priceChartHeight={chartPictureData.priceChartHeight}
                  progress={progress}
                  textColor={axisText}
                  width={chartSize.width}
                />
              ))}
            </Canvas>
          </GestureDetector>
        ) : null}
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
