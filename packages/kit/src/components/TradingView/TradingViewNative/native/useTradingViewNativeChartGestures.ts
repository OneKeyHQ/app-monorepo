import { useMemo } from 'react';

import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, withDecay } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION,
  TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE,
} from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import { reduceTradingViewNativeChartRuntime } from '../utils/chartRuntime';
import {
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativeRelativePinchScale,
} from '../utils/chartViewport';
import { isTradingViewNativeMainPriceAxisTouch } from '../utils/priceAxisScale';
import {
  getTradingViewNativeSubIndicatorLegendHitRegions,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
  getTradingViewNativeVisibleSubIndicatorPaneCount,
} from '../utils/subIndicatorRender';

import type { ITradingViewNativeChartRuntime } from './chartRuntime';
import type { ITradingViewNativeSkiaResources } from './chartSkiaRenderer';
import type { ITradingViewNativeSubIndicator } from '../utils/chartIndicators';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

const PAN_DECELERATION = 0.9982;
const MIN_FLING_VELOCITY = 100;

export function useTradingViewNativeChartGestures({
  chartRuntime,
  decayOffset,
  isClickInteractionEnabled,
  isCrosshairEnabled,
  onSubIndicatorSettingsPress,
  priceAxisResetGesture,
  priceAxisScaleGesture,
  priceAxisWidth,
  resources,
}: {
  chartRuntime: SharedValue<ITradingViewNativeChartRuntime>;
  decayOffset: SharedValue<number>;
  isClickInteractionEnabled: boolean;
  isCrosshairEnabled: boolean;
  onSubIndicatorSettingsPress: (
    indicator: ITradingViewNativeSubIndicator,
  ) => void;
  priceAxisResetGesture: GestureType;
  priceAxisScaleGesture: GestureType;
  priceAxisWidth: SharedValue<number>;
  resources: SharedValue<ITradingViewNativeSkiaResources>;
}) {
  return useMemo(() => {
    const isMainPriceAxisTouch = (x: number, y: number) => {
      'worklet';

      const runtime = chartRuntime.value;
      const paneCount = getTradingViewNativeVisibleSubIndicatorPaneCount(
        runtime.subIndicatorPanes,
      );
      return isTradingViewNativeMainPriceAxisTouch({
        height: runtime.size.height,
        paneCount,
        priceAxisWidth: priceAxisWidth.value,
        width: runtime.size.width,
        x,
        y,
      });
    };

    const updateCrosshair = (x: number, y: number) => {
      'worklet';

      const runtime = chartRuntime.value;
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
        chartWidth: getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        ),
        height: runtime.size.height,
        pointCount: runtime.points.length,
        type: 'crosshairMoved',
        x,
        y,
      });
      chartRuntime.value = {
        ...runtime,
        ...nextRuntimeState,
      };
    };

    const getSubIndicatorSettingsTarget = (x: number, y: number) => {
      'worklet';

      const runtime = chartRuntime.value;
      const chartWidth = getTradingViewNativeChartWidth(
        runtime.size.width,
        priceAxisWidth.value,
      );
      const priceAxisX =
        TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
      const crosshairPointIndex =
        runtime.crosshair.visible && isCrosshairEnabled
          ? getTradingViewNativePointIndexAtX({
              initialRightOffset: runtime.viewport.initialRightOffset,
              offset: runtime.viewport.offset,
              pointCount: runtime.points.length,
              priceAxisX,
              x: runtime.crosshair.x,
              zoomScale: runtime.viewport.zoomScale,
            })
          : null;
      const pointIndex = crosshairPointIndex ?? runtime.points.length - 1;
      const regions = getTradingViewNativeSubIndicatorLegendHitRegions({
        height: runtime.size.height,
        measureTextWidth: (text) =>
          resources.value.fonts.legend.measureText(text).width,
        panes: runtime.subIndicatorPanes,
        pointIndex,
        priceAxisX,
      });
      return getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x,
        y,
      });
    };

    const crosshairGesture = Gesture.Pan()
      .enabled(isCrosshairEnabled)
      .activateAfterLongPress(TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION)
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
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          type: 'crosshairHidden',
        });
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
        };
      });

    const tapCrosshairGesture = Gesture.Tap()
      .enabled(isCrosshairEnabled && isClickInteractionEnabled)
      .onEnd((event, success) => {
        'worklet';

        if (success) {
          cancelAnimation(decayOffset);
          updateCrosshair(event.x, event.y);
        }
      });

    const subIndicatorSettingsGesture = Gesture.Tap()
      .maxDistance(TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (
          !touch ||
          getSubIndicatorSettingsTarget(touch.x, touch.y) === null
        ) {
          stateManager.fail();
        }
      })
      .onEnd((event, success) => {
        'worklet';

        if (!success) {
          return;
        }
        const indicator = getSubIndicatorSettingsTarget(event.x, event.y);
        if (indicator) {
          scheduleOnRN(onSubIndicatorSettingsPress, indicator);
        }
      });

    const panGesture = Gesture.Pan()
      .activeOffsetX([-4, 4])
      .failOffsetY([-12, 12])
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (touch && isMainPriceAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
      .onBegin(() => {
        'worklet';

        cancelAnimation(decayOffset);
      })
      .onStart(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextChartWidth = getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: nextChartWidth,
          hideCrosshair: true,
          offset: runtime.viewport.offset,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
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
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          ),
          hideCrosshair: true,
          offset:
            runtime.panGesture.startOffset +
            event.translationX * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
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
          chartWidth: getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          ),
          initialRightOffset: runtime.viewport.initialRightOffset,
          pointCount: runtime.points.length,
          zoomScale: runtime.viewport.zoomScale,
        });
        if (maxOffset <= 0) {
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: getTradingViewNativeChartWidth(
                runtime.size.width,
                priceAxisWidth.value,
              ),
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
            velocity: event.velocityX * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
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
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          ),
          hideCrosshair: true,
          offset: runtime.viewport.offset,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
        const startOffset = nextRuntimeState.viewport.offset;
        decayOffset.value = startOffset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          pinchGesture: {
            anchorX:
              event.focalX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
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
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          anchorX: runtime.pinchGesture.anchorX,
          baseViewport: {
            offset: runtime.pinchGesture.startOffset,
            zoomScale: runtime.pinchGesture.startZoomScale,
          },
          chartWidth: getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          ),
          hideCrosshair: true,
          nextZoomScale: runtime.pinchGesture.startZoomScale * relativeScale,
          pointCount: runtime.points.length,
          type: 'zoomed',
        });
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
      subIndicatorSettingsGesture,
      crosshairGesture,
      priceAxisResetGesture,
      tapCrosshairGesture,
      Gesture.Race(priceAxisScaleGesture, panGesture, pinchGesture),
    );
  }, [
    chartRuntime,
    decayOffset,
    isClickInteractionEnabled,
    isCrosshairEnabled,
    onSubIndicatorSettingsPress,
    priceAxisResetGesture,
    priceAxisScaleGesture,
    priceAxisWidth,
    resources,
  ]);
}
