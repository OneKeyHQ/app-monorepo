import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Canvas, Picture, useSVG } from '@shopify/react-native-skia';
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

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION as CROSSHAIR_LONG_PRESS_DURATION,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  type ITradingViewNativeViewportRequest,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeGestureStartOffsetAfterDataUpdate,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePanStartOffsetAfterViewportPreservation,
  getTradingViewNativeRelativePinchScale,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';

import {
  createTradingViewNativeSkiaPicture,
  createTradingViewNativeSkiaResources,
} from './chartSkiaRenderer';

import type { ITradingViewNativeChartType } from '../types';

const PAN_DRAG_RATIO = 1.1;
const PAN_DECELERATION = 0.9982;
const MIN_FLING_VELOCITY = 100;
const SYSTEM_FONT_FAMILY = platformEnv.isNativeAndroid
  ? 'sans-serif'
  : 'System';
const ONEKEY_WATERMARK_SOURCE =
  require('@onekeyhq/components/svg/illus/logo.svg') as number;

interface IChartSize {
  height: number;
  width: number;
}

interface ITradingViewNativeChartRuntime extends ITradingViewNativeChartRuntimeState {
  candleIntervalSeconds: number;
  chartType: ITradingViewNativeChartType;
  panGesture: {
    startOffset: number;
    translationX: number;
  };
  pinchGesture: {
    anchorX: number;
    currentScale: number;
    isActive: boolean;
    scaleBaseline: number;
    startOffset: number;
    startZoomScale: number;
  };
  points: IMarketTokenKLineDataPoint[];
  size: IChartSize;
}

interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  isSwitchingInterval: boolean;
  onChartWidthChange?: (width: number) => void;
  onViewportRequestApplied?: (requestId: number) => void;
  onVisiblePointRangeChange?: (
    range: ITradingViewNativeVisiblePointRange,
  ) => void;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
  viewportRequest?: ITradingViewNativeViewportRequest | null;
}

function getInitialRuntime({
  candleIntervalSeconds,
  chartType,
  points,
}: {
  candleIntervalSeconds: number;
  chartType: ITradingViewNativeChartType;
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativeChartRuntime {
  return {
    ...createTradingViewNativeChartRuntimeState(),
    candleIntervalSeconds,
    chartType,
    panGesture: {
      startOffset: 0,
      translationX: 0,
    },
    pinchGesture: {
      anchorX: 0,
      currentScale: 1,
      isActive: false,
      scaleBaseline: 1,
      startOffset: 0,
      startZoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    },
    points,
    size: { height: 0, width: 0 },
  };
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartType,
    chartPictureVersion,
    isSwitchingInterval,
    onChartWidthChange,
    onViewportRequestApplied,
    onVisiblePointRangeChange,
    points,
    testID,
    viewportRequest,
  }: ITradingViewNativeChartProps) => {
    const [chartSize, setChartSize] = useState<IChartSize>({
      height: 0,
      width: 0,
    });
    const chartRuntime = useSharedValue(
      getInitialRuntime({ candleIntervalSeconds, chartType, points }),
    );
    const decayOffset = useSharedValue(0);
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[points.length - 1]?.t,
    );
    const previousPictureInputRef = useRef({
      chartPictureVersion,
      pointCount: points.length,
    });
    const appliedViewportRequestRef = useRef({
      chartWidth: 0,
      requestId: 0,
    });
    const theme = useTheme();
    const themeName = useThemeName();
    const watermarkSvg = useSVG(ONEKEY_WATERMARK_SOURCE);
    const background = theme.transparent.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;
    const line = theme.text.val;
    const chartWidth = getTradingViewNativeChartWidth(chartSize.width);
    const pointCount = points.length;
    const watermarkOpacity =
      themeName === 'dark' ? WATERMARK_DARK_OPACITY : WATERMARK_LIGHT_OPACITY;
    const resources = useDerivedValue(
      () =>
        createTradingViewNativeSkiaResources({
          colors: {
            axisText,
            background,
            down: CHART_DOWN_COLOR,
            grid,
            line,
            up: CHART_UP_COLOR,
          },
          fontFamily: SYSTEM_FONT_FAMILY,
          watermarkSvg,
        }),
      [axisText, background, grid, line, watermarkSvg],
    );

    const picture = useDerivedValue(() => {
      const runtime = chartRuntime.value;
      return createTradingViewNativeSkiaPicture({
        candleIntervalSeconds: runtime.candleIntervalSeconds,
        chartType: runtime.chartType,
        crosshair: runtime.crosshair,
        height: runtime.size.height,
        points: runtime.points,
        resources: resources.value,
        viewport: runtime.viewport,
        watermarkOpacity,
        width: runtime.size.width,
      });
    }, [resources, watermarkOpacity]);

    const handleVisiblePointRangeChange = useCallback(
      (startIndex: number, endIndex: number) => {
        onVisiblePointRangeChange?.({ endIndex, startIndex });
      },
      [onVisiblePointRangeChange],
    );

    useAnimatedReaction(
      () => {
        const runtime = chartRuntime.value;
        const nextChartWidth = getTradingViewNativeChartWidth(
          runtime.size.width,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: nextChartWidth,
          offset: decayOffset.value,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
        const range = getTradingViewNativeChartRuntimeVisiblePointRange({
          chartWidth: nextChartWidth,
          pointCount: runtime.points.length,
          state: nextRuntimeState,
        });
        return {
          chartWidth: nextChartWidth,
          offset: nextRuntimeState.viewport.offset,
          pointCount: runtime.points.length,
          ...range,
        };
      },
      (current, previous) => {
        'worklet';

        const runtime = chartRuntime.value;
        if (runtime.viewport.offset !== current.offset) {
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: current.chartWidth,
              offset: current.offset,
              pointCount: current.pointCount,
              type: 'panMoved',
            },
          );
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
          };
        }
        if (
          current.chartWidth > 0 &&
          current.pointCount > 0 &&
          (current.chartWidth !== previous?.chartWidth ||
            current.startIndex !== previous?.startIndex ||
            current.endIndex !== previous?.endIndex)
        ) {
          scheduleOnRN(
            handleVisiblePointRangeChange,
            current.startIndex,
            current.endIndex,
          );
        }
      },
    );

    useLayoutEffect(() => {
      onChartWidthChange?.(chartWidth);
    }, [chartWidth, onChartWidthChange]);

    useLayoutEffect(() => {
      const dataUpdateMetadata = getTradingViewNativeDataUpdateMetadata({
        points,
        previousLatestTimestamp: previousLatestTimestampRef.current,
      });
      const previousPictureInput = previousPictureInputRef.current;
      const shouldReplaceAllPoints =
        previousPictureInput.chartPictureVersion !== chartPictureVersion ||
        previousPictureInput.pointCount !== points.length;
      previousLatestTimestampRef.current = dataUpdateMetadata.latestTimestamp;
      previousPictureInputRef.current = {
        chartPictureVersion,
        pointCount: points.length,
      };
      const nextSize = chartSize;
      const replacementPoints = shouldReplaceAllPoints ? points : null;
      const latestPoint = points[points.length - 1] ?? null;

      scheduleOnUI(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextPoints =
          replacementPoints ??
          (latestPoint ? [...runtime.points.slice(0, -1), latestPoint] : []);
        const nextChartWidth = getTradingViewNativeChartWidth(nextSize.width);
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          appendedPointCount: dataUpdateMetadata.appendedPointCount,
          chartWidth: nextChartWidth,
          pointCount: nextPoints.length,
          type: 'dataUpdated',
        });
        const nextOffset = nextRuntimeState.viewport.offset;
        const offsetDelta = nextOffset - runtime.viewport.offset;
        decayOffset.value = nextOffset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          candleIntervalSeconds,
          chartType,
          panGesture: {
            ...runtime.panGesture,
            startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
              currentZoomScale: runtime.viewport.zoomScale,
              offsetDelta,
              startOffset: runtime.panGesture.startOffset,
              startZoomScale: runtime.viewport.zoomScale,
            }),
          },
          pinchGesture: {
            ...runtime.pinchGesture,
            startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
              currentZoomScale: runtime.viewport.zoomScale,
              offsetDelta,
              startOffset: runtime.pinchGesture.startOffset,
              startZoomScale: runtime.pinchGesture.startZoomScale,
            }),
          },
          points: nextPoints,
          size: nextSize,
        };
      });
    }, [
      candleIntervalSeconds,
      chartType,
      chartPictureVersion,
      chartRuntime,
      chartSize,
      decayOffset,
      points,
    ]);

    useLayoutEffect(() => {
      if (
        !viewportRequest ||
        (viewportRequest.requestId ===
          appliedViewportRequestRef.current.requestId &&
          chartWidth === appliedViewportRequestRef.current.chartWidth) ||
        chartWidth <= 0 ||
        pointCount <= 0
      ) {
        return;
      }
      const pointRange = getTradingViewNativeViewportPointRange({
        points,
        target: viewportRequest.target,
      });
      if (!pointRange) {
        return;
      }

      const preserveVisibleAnchor = Boolean(
        viewportRequest.preserveVisibleAnchor,
      );
      const requestId = viewportRequest.requestId;
      appliedViewportRequestRef.current = { chartWidth, requestId };

      scheduleOnUI(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth,
          pointCount,
          pointRange,
          type: 'viewportRequested',
        });
        const nextViewport = nextRuntimeState.viewport;

        cancelAnimation(decayOffset);
        decayOffset.value = nextViewport.offset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          panGesture: {
            startOffset: preserveVisibleAnchor
              ? getTradingViewNativePanStartOffsetAfterViewportPreservation({
                  currentTranslationX: runtime.panGesture.translationX,
                  dragRatio: PAN_DRAG_RATIO,
                  preservedOffset: nextViewport.offset,
                })
              : nextViewport.offset,
            translationX: preserveVisibleAnchor
              ? runtime.panGesture.translationX
              : 0,
          },
          pinchGesture: {
            ...runtime.pinchGesture,
            currentScale: runtime.pinchGesture.isActive
              ? runtime.pinchGesture.currentScale
              : 1,
            scaleBaseline: runtime.pinchGesture.isActive
              ? runtime.pinchGesture.currentScale
              : 1,
            startOffset: nextViewport.offset,
            startZoomScale: nextViewport.zoomScale,
          },
        };
        if (onViewportRequestApplied) {
          scheduleOnRN(onViewportRequestApplied, requestId);
        }
      });
    }, [
      chartRuntime,
      chartWidth,
      decayOffset,
      onViewportRequestApplied,
      pointCount,
      points,
      viewportRequest,
    ]);

    const chartGestures = useMemo(() => {
      const updateCrosshair = (x: number, y: number) => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          height: runtime.size.height,
          pointCount: runtime.points.length,
          type: 'crosshairMoved',
          width: runtime.size.width,
          x,
          y,
        });
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
        };
      };

      const crosshairGesture = Gesture.Pan()
        .activateAfterLongPress(CROSSHAIR_LONG_PRESS_DURATION)
        .maxPointers(1)
        .onStart((event) => {
          'worklet';

          cancelAnimation(decayOffset);
          updateCrosshair(event.x, event.y);
        })
        .onUpdate((event) => {
          'worklet';

          updateCrosshair(event.x, event.y);
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              type: 'crosshairHidden',
            },
          );
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
          };
        });

      const panGesture = Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .maxPointers(1)
        .onBegin(() => {
          'worklet';

          cancelAnimation(decayOffset);
        })
        .onStart(() => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextChartWidth = getTradingViewNativeChartWidth(
            runtime.size.width,
          );
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: nextChartWidth,
              hideCrosshair: true,
              offset: runtime.viewport.offset,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const startOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = startOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            panGesture: {
              startOffset,
              translationX: 0,
            },
          };
        })
        .onUpdate((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: getTradingViewNativeChartWidth(runtime.size.width),
              hideCrosshair: true,
              offset:
                runtime.panGesture.startOffset +
                event.translationX * PAN_DRAG_RATIO,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const nextOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = nextOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            panGesture: {
              ...runtime.panGesture,
              translationX: event.translationX,
            },
          };
        })
        .onEnd((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const maxOffset = getTradingViewNativeMaxPanOffset({
            chartWidth: getTradingViewNativeChartWidth(runtime.size.width),
            pointCount: runtime.points.length,
            zoomScale: runtime.viewport.zoomScale,
          });
          if (maxOffset <= 0) {
            const nextRuntimeState = reduceTradingViewNativeChartRuntime(
              runtime,
              {
                chartWidth: getTradingViewNativeChartWidth(runtime.size.width),
                offset: 0,
                pointCount: runtime.points.length,
                type: 'panMoved',
              },
            );
            decayOffset.value = 0;
            chartRuntime.value = {
              ...runtime,
              ...nextRuntimeState,
            };
          } else if (Math.abs(event.velocityX) >= MIN_FLING_VELOCITY) {
            decayOffset.value = withDecay({
              clamp: [0, maxOffset],
              deceleration: PAN_DECELERATION,
              velocity: event.velocityX * PAN_DRAG_RATIO,
            });
          }
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          chartRuntime.value = {
            ...runtime,
            panGesture: {
              ...runtime.panGesture,
              translationX: 0,
            },
          };
        });

      const pinchGesture = Gesture.Pinch()
        .onStart((event) => {
          'worklet';

          cancelAnimation(decayOffset);
          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: getTradingViewNativeChartWidth(runtime.size.width),
              hideCrosshair: true,
              offset: runtime.viewport.offset,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const startOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = startOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            pinchGesture: {
              anchorX: event.focalX - CHART_HORIZONTAL_PADDING,
              currentScale: event.scale,
              isActive: true,
              scaleBaseline: event.scale,
              startOffset,
              startZoomScale: runtime.viewport.zoomScale,
            },
          };
        })
        .onUpdate((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const relativeScale = getTradingViewNativeRelativePinchScale({
            baselineScale: runtime.pinchGesture.scaleBaseline,
            gestureScale: event.scale,
          });
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              anchorX: runtime.pinchGesture.anchorX,
              baseViewport: {
                offset: runtime.pinchGesture.startOffset,
                zoomScale: runtime.pinchGesture.startZoomScale,
              },
              chartWidth: getTradingViewNativeChartWidth(runtime.size.width),
              hideCrosshair: true,
              nextZoomScale:
                runtime.pinchGesture.startZoomScale * relativeScale,
              pointCount: runtime.points.length,
              type: 'zoomed',
            },
          );
          decayOffset.value = nextRuntimeState.viewport.offset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            pinchGesture: {
              ...runtime.pinchGesture,
              currentScale: event.scale,
            },
          };
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          chartRuntime.value = {
            ...runtime,
            pinchGesture: {
              ...runtime.pinchGesture,
              currentScale: 1,
              isActive: false,
              scaleBaseline: 1,
            },
          };
        });

      return Gesture.Exclusive(
        crosshairGesture,
        Gesture.Race(panGesture, pinchGesture),
      );
    }, [chartRuntime, decayOffset]);

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
      <Stack
        flex={1}
        minHeight={0}
        onLayout={handleChartLayout}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <GestureDetector gesture={chartGestures}>
          <Canvas testID={testID} style={{ flex: 1 }}>
            <Picture picture={picture} />
          </Canvas>
        </GestureDetector>
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
