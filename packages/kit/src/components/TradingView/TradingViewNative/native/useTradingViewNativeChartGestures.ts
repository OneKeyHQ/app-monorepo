import { useMemo } from 'react';

import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION,
  TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE,
} from '../chartConstants';
import { getTradingViewNativeIndicatorPriceRange } from '../utils/chartIndicators';
import {
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
} from '../utils/chartLayout';
import { reduceTradingViewNativeChartRuntime } from '../utils/chartRuntime';
import {
  getTradingViewNativePointIndexAtX,
  getTradingViewNativeRelativePinchScale,
  getTradingViewNativeVisiblePointRange,
} from '../utils/chartViewport';
import {
  getTradingViewNativeMainPriceAxisLayout,
  isTradingViewNativeMainPriceAxisTouch,
} from '../utils/priceAxisScale';
import { panTradingViewNativePriceRange } from '../utils/priceScale';
import {
  getTradingViewNativeSubIndicatorLegendHitRegions,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
  getTradingViewNativeVisibleSubIndicatorPaneCount,
} from '../utils/subIndicatorRender';
import {
  getTradingViewNativeTimeAxisZoomScaleAfterDrag,
  isTradingViewNativeTimeAxisTouch,
} from '../utils/timeAxisScale';

import { getTradingViewNativeSkiaTextFont } from './chartSkiaText';

import type { ITradingViewNativeChartRuntime } from './chartRuntime';
import type { ITradingViewNativeSkiaResources } from './chartSkiaRenderer';
import type { ITradingViewNativeSubIndicator } from '../utils/chartIndicators';
import type { ITradingViewNativePriceRange } from '../utils/chartViewport';
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
  onInteractionChange,
  onPriceRangePan,
  priceAxisResetGesture,
  priceAxisScaleGesture,
  priceAxisWidth,
  resources,
  timeAxisHeight,
}: {
  chartRuntime: SharedValue<ITradingViewNativeChartRuntime>;
  decayOffset: SharedValue<number>;
  isClickInteractionEnabled: boolean;
  isCrosshairEnabled: boolean;
  onInteractionChange?: (isInteracting: boolean) => void;
  onPriceRangePan?: () => void;
  onSubIndicatorSettingsPress: (
    indicator: ITradingViewNativeSubIndicator,
  ) => void;
  priceAxisResetGesture: GestureType;
  priceAxisScaleGesture: GestureType;
  priceAxisWidth: SharedValue<number>;
  resources: SharedValue<ITradingViewNativeSkiaResources>;
  timeAxisHeight: number;
}) {
  const pressedSubIndicatorSettingsTarget =
    useSharedValue<ITradingViewNativeSubIndicator | null>(null);

  const panPriceRange = useSharedValue<ITradingViewNativePriceRange | null>(
    null,
  );
  const panPriceHeight = useSharedValue(0);
  const isPricePanActive = useSharedValue(false);
  const activeGestures = useSharedValue(0);
  return useMemo(() => {
    const setInteraction = (bit: number, active: boolean) => {
      'worklet';
      const previous = activeGestures.value;
      const next = active ? previous | bit : previous & ~bit;
      activeGestures.value = next;
      if (onInteractionChange && Boolean(previous) !== Boolean(next))
        scheduleOnRN(onInteractionChange, Boolean(next));
    };
    const isMainPriceAxisTouch = (x: number, y: number) => {
      'worklet';

      const runtime = chartRuntime.value;
      const paneCount = getTradingViewNativeVisibleSubIndicatorPaneCount(
        runtime.subIndicatorPanes,
      );
      return isTradingViewNativeMainPriceAxisTouch({
        height: runtime.size.height,
        paneCount,
        panes: runtime.subIndicatorPanes,
        priceAxisWidth: priceAxisWidth.value,
        timeAxisHeight,
        width: runtime.size.width,
        x,
        y,
      });
    };

    const isTimeAxisTouch = (x: number, y: number) => {
      'worklet';

      const runtime = chartRuntime.value;
      return isTradingViewNativeTimeAxisTouch({
        height: runtime.size.height,
        priceAxisWidth: priceAxisWidth.value,
        timeAxisHeight,
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
        timeAxisHeight,
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
          getTradingViewNativeSkiaTextFont(
            text,
            resources.value.fonts.legend,
            resources.value.legendSubscriptFont,
          ).measureText(text).width,
        panes: runtime.subIndicatorPanes,
        pointIndex,
        priceAxisX,
        timeAxisHeight,
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
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (touch && isTimeAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
      .onStart((event) => {
        'worklet';
        setInteraction(1, true);

        cancelAnimation(decayOffset);
        updateCrosshair(event.x, event.y);
      })
      .onUpdate((event) => {
        'worklet';

        updateCrosshair(event.x, event.y);
      })
      .onFinalize((_event, success) => {
        'worklet';
        setInteraction(1, false);

        if (success) {
          return;
        }
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
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (touch && isTimeAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
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
        pressedSubIndicatorSettingsTarget.value = touch
          ? getSubIndicatorSettingsTarget(touch.x, touch.y)
          : null;
        if (pressedSubIndicatorSettingsTarget.value === null) {
          stateManager.fail();
        }
      })
      .onEnd((_event, success) => {
        'worklet';

        const indicator = pressedSubIndicatorSettingsTarget.value;
        if (success && indicator) {
          scheduleOnRN(onSubIndicatorSettingsPress, indicator);
        }
      })
      .onFinalize(() => {
        'worklet';

        pressedSubIndicatorSettingsTarget.value = null;
      });

    const panGesture = Gesture.Pan()
      .minDistance(4)
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (
          touch &&
          (isMainPriceAxisTouch(touch.x, touch.y) ||
            isTimeAxisTouch(touch.x, touch.y))
        ) {
          stateManager.fail();
        }
      })
      .onBegin(() => {
        'worklet';

        cancelAnimation(decayOffset);
      })
      .onStart(() => {
        'worklet';
        setInteraction(2, true);

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
        const visiblePointRange = getTradingViewNativeVisiblePointRange({
          ...runtime.viewport,
          chartWidth: nextChartWidth,
          pointCount: runtime.points.length,
        });
        const layout = getTradingViewNativeChartLayout({
          additionalPriceRange: getTradingViewNativeIndicatorPriceRange({
            ...visiblePointRange,
            series: runtime.indicatorSeries,
          }),
          candleIntervalSeconds: runtime.candleIntervalSeconds,
          chartType: runtime.chartType,
          contentBottomInset: Math.max(
            0,
            getTradingViewNativeMainPriceAxisLayout({
              height: runtime.size.height,
              paneCount: getTradingViewNativeVisibleSubIndicatorPaneCount(
                runtime.subIndicatorPanes,
              ),
              panes: runtime.subIndicatorPanes,
              timeAxisHeight,
            }).bottomInset - timeAxisHeight,
          ),
          hasVolume: runtime.hasVolume,
          height: runtime.size.height,
          width: runtime.size.width,
          minimumTimeTickIndexSpacing: 1,
          points: runtime.points,
          pinnedPriceRange: runtime.pinnedPriceRange,
          priceAxisWidth: priceAxisWidth.value,
          priceRangeScale: runtime.priceRangeScale,
          priceScaleMode: runtime.priceScaleMode,
          timeAxisHeight,
          visiblePointRange,
        });
        isPricePanActive.value = false;
        panPriceRange.value =
          runtime.pinnedPriceRange ?? layout?.autoPriceRange ?? null;
        panPriceHeight.value = layout?.priceChartHeight ?? 0;
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
        const priceRange = panPriceRange.value;
        isPricePanActive.value =
          isPricePanActive.value || Math.abs(event.translationY) > 4;
        const pinnedPriceRange =
          priceRange && isPricePanActive.value
            ? panTradingViewNativePriceRange({
                priceRange,
                rangeScale: runtime.priceRangeScale,
                mode: runtime.priceScaleMode,
                chartHeight: panPriceHeight.value,
                translationY: event.translationY,
              })
            : runtime.pinnedPriceRange;
        if (pinnedPriceRange && !runtime.pinnedPriceRange && onPriceRangePan) {
          scheduleOnRN(onPriceRangePan);
        }
        const nextOffset = nextRuntimeState.viewport.offset;
        decayOffset.value = nextOffset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          pinnedPriceRange,
          panGesture: {
            ...runtime.panGesture,
            translationX: event.translationX,
          },
        };
      })
      .onEnd((event) => {
        'worklet';

        if (Math.abs(event.velocityX) >= MIN_FLING_VELOCITY) {
          decayOffset.value = withDecay({
            deceleration: PAN_DECELERATION,
            velocity: event.velocityX * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
          });
        }
      })
      .onFinalize(() => {
        'worklet';
        setInteraction(2, false);

        const runtime = chartRuntime.value;
        chartRuntime.value = {
          ...runtime,
          panGesture: {
            ...runtime.panGesture,
            translationX: 0,
          },
        };
      });

    const timeAxisScaleGesture = Gesture.Pan()
      .activeOffsetX([-4, 4])
      .failOffsetY([-12, 12])
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (!touch || !isTimeAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
      .onStart((event) => {
        'worklet';
        setInteraction(4, true);

        cancelAnimation(decayOffset);
        const runtime = chartRuntime.value;
        const chartWidth = getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth,
          hideCrosshair: true,
          offset: runtime.viewport.offset,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
        const startOffset = nextRuntimeState.viewport.offset;
        const startX = event.x - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING;
        decayOffset.value = startOffset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          timeAxisScaleGesture: {
            chartWidth,
            currentX: startX,
            isActive: true,
            startOffset,
            startX,
            startZoomScale: nextRuntimeState.viewport.zoomScale,
          },
        };
      })
      .onUpdate((event) => {
        'worklet';

        const runtime = chartRuntime.value;
        const gesture = runtime.timeAxisScaleGesture;
        const chartWidth = getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        );
        const currentX = event.x - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          anchorX: chartWidth,
          baseViewport: {
            offset: gesture.startOffset,
            zoomScale: gesture.startZoomScale,
          },
          chartWidth,
          hideCrosshair: true,
          nextZoomScale: getTradingViewNativeTimeAxisZoomScaleAfterDrag({
            chartWidth: gesture.chartWidth,
            currentX,
            startX: gesture.startX,
            startZoomScale: gesture.startZoomScale,
          }),
          pointCount: runtime.points.length,
          type: 'zoomed',
        });
        decayOffset.value = nextRuntimeState.viewport.offset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          timeAxisScaleGesture: {
            ...gesture,
            currentX,
          },
        };
      })
      .onFinalize(() => {
        'worklet';
        setInteraction(4, false);

        const runtime = chartRuntime.value;
        chartRuntime.value = {
          ...runtime,
          timeAxisScaleGesture: {
            ...runtime.timeAxisScaleGesture,
            isActive: false,
          },
        };
      });

    const pinchGesture = Gesture.Pinch()
      .onStart((event) => {
        'worklet';
        setInteraction(8, true);

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
        setInteraction(8, false);

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
      Gesture.Race(
        priceAxisScaleGesture,
        timeAxisScaleGesture,
        panGesture,
        pinchGesture,
      ),
    );
  }, [
    activeGestures,
    panPriceRange,
    panPriceHeight,
    isPricePanActive,
    chartRuntime,
    decayOffset,
    isClickInteractionEnabled,
    isCrosshairEnabled,
    onSubIndicatorSettingsPress,
    onInteractionChange,
    onPriceRangePan,
    pressedSubIndicatorSettingsTarget,
    priceAxisResetGesture,
    priceAxisScaleGesture,
    priceAxisWidth,
    resources,
    timeAxisHeight,
  ]);
}
