import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING } from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import { reduceTradingViewNativeChartRuntime } from '../utils/chartRuntime';
import { getTradingViewNativeVisiblePointRange } from '../utils/chartViewport';
import { getTradingViewNativeMainPriceRange } from '../utils/mainPriceRange';
import {
  getTradingViewNativeMainPriceAxisLayout,
  getTradingViewNativePriceRangeScaleAfterDrag,
  isTradingViewNativeMainPriceAxisTouch,
} from '../utils/priceAxisScale';
import { getTradingViewNativeVisibleSubIndicatorPaneCount } from '../utils/subIndicatorRender';

import type {
  ITradingViewNativeChartRuntime,
  ITradingViewNativeChartSize,
} from './chartRuntime';
import type { ITradingViewNativePriceScaleMode } from '../types';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';
import type {
  GestureResponderEvent,
  PointerEvent as RNPointerEvent,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const PRICE_AXIS_DOUBLE_TAP_MAX_DISTANCE = 8;
const PRICE_SCALE_CONTROLS_TOUCH_VISIBLE_DURATION = 3000;

function getTradingViewNativeMainPriceAxisLayoutForPanes({
  height,
  subIndicatorPanes,
  timeAxisHeight,
}: {
  height: number;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisHeight: number;
}) {
  'worklet';

  const paneCount =
    getTradingViewNativeVisibleSubIndicatorPaneCount(subIndicatorPanes);
  return getTradingViewNativeMainPriceAxisLayout({
    height,
    paneCount,
    timeAxisHeight,
  });
}

function getRuntimeWithCrosshairHidden(
  runtime: ITradingViewNativeChartRuntime,
): ITradingViewNativeChartRuntime {
  'worklet';

  return {
    ...runtime,
    ...reduceTradingViewNativeChartRuntime(runtime, {
      type: 'crosshairHidden',
    }),
  };
}

function getTradingViewNativeRuntimeAutoPriceRange({
  chartWidth,
  runtime,
}: {
  chartWidth: number;
  runtime: ITradingViewNativeChartRuntime;
}) {
  'worklet';

  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    chartWidth,
    initialRightOffset: runtime.viewport.initialRightOffset,
    offset: runtime.viewport.offset,
    pointCount: runtime.points.length,
    zoomScale: runtime.viewport.zoomScale,
  });
  return getTradingViewNativeMainPriceRange({
    chartType: runtime.chartType,
    indicatorSeries: runtime.indicatorSeries,
    points: runtime.points,
    ...visiblePointRange,
  });
}

export function useTradingViewNativePriceScale({
  chartRuntime,
  chartSize,
  chartWidth,
  decayOffset,
  isEnabled,
  isLogScaleAvailable,
  priceAxisWidth,
  subIndicatorPanes,
  timeAxisHeight,
}: {
  chartRuntime: SharedValue<ITradingViewNativeChartRuntime>;
  chartSize: ITradingViewNativeChartSize;
  chartWidth: number;
  decayOffset: SharedValue<number>;
  isEnabled: boolean;
  isLogScaleAvailable: boolean;
  priceAxisWidth: SharedValue<number>;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisHeight: number;
}) {
  const [isAutoScale, setIsAutoScale] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchVisible, setIsTouchVisible] = useState(false);
  const [mode, setMode] = useState<ITradingViewNativePriceScaleMode>('linear');
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);

  const hideForTouch = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    setIsTouchVisible(false);
  }, []);

  const showForTouch = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    setIsTouchVisible(true);
    touchTimerRef.current = setTimeout(() => {
      touchTimerRef.current = null;
      setIsTouchVisible(false);
    }, PRICE_SCALE_CONTROLS_TOUCH_VISIBLE_DURATION);
  }, []);

  useEffect(
    () => () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
    },
    [],
  );

  const handleAutoScaleStateChange = useCallback((nextIsAuto: boolean) => {
    setIsAutoScale(nextIsAuto);
  }, []);

  useEffect(() => {
    if (isLogScaleAvailable || mode === 'linear') {
      return;
    }
    setMode('linear');
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      chartRuntime.value = {
        ...runtime,
        priceScaleMode: 'linear',
      };
    });
  }, [chartRuntime, decayOffset, isLogScaleAvailable, mode]);

  const handleAutoScalePress = useCallback(() => {
    if (isTouchVisible) {
      showForTouch();
    }
    const nextIsAutoScale = !isAutoScale;
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      if (nextIsAutoScale) {
        chartRuntime.value = {
          ...runtime,
          pinnedPriceRange: null,
          priceRangeScale: 1,
        };
        scheduleOnRN(handleAutoScaleStateChange, true);
        return;
      }
      const pinnedPriceRange = getTradingViewNativeRuntimeAutoPriceRange({
        chartWidth: getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        ),
        runtime,
      });
      if (!pinnedPriceRange) {
        return;
      }
      chartRuntime.value = {
        ...runtime,
        pinnedPriceRange,
      };
      scheduleOnRN(handleAutoScaleStateChange, false);
    });
  }, [
    chartRuntime,
    decayOffset,
    handleAutoScaleStateChange,
    isAutoScale,
    isTouchVisible,
    priceAxisWidth,
    showForTouch,
  ]);

  const handleLogScalePress = useCallback(() => {
    if (!isLogScaleAvailable) {
      return;
    }
    if (isTouchVisible) {
      showForTouch();
    }
    const nextMode = mode === 'linear' ? 'logarithmic' : 'linear';
    setMode(nextMode);
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      chartRuntime.value = {
        ...runtime,
        priceScaleMode: nextMode,
      };
    });
  }, [
    chartRuntime,
    decayOffset,
    isLogScaleAvailable,
    isTouchVisible,
    mode,
    showForTouch,
  ]);

  const gestures = useMemo(() => {
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
        timeAxisHeight,
        width: runtime.size.width,
        x,
        y,
      });
    };

    const resetGesture = Gesture.Tap()
      .enabled(isEnabled)
      .numberOfTaps(2)
      .maxDistance(PRICE_AXIS_DOUBLE_TAP_MAX_DISTANCE)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (!touch || !isMainPriceAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
      .onEnd((_event, success) => {
        'worklet';

        if (!success) {
          return;
        }
        cancelAnimation(decayOffset);
        const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
        chartRuntime.value = {
          ...runtime,
          pinnedPriceRange: null,
          priceRangeScale: 1,
        };
        scheduleOnRN(handleAutoScaleStateChange, true);
      });

    const scaleGesture = Gesture.Pan()
      .enabled(isEnabled)
      .activeOffsetY([-4, 4])
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        if (!touch || !isMainPriceAxisTouch(touch.x, touch.y)) {
          stateManager.fail();
        }
      })
      .onStart((event) => {
        'worklet';

        cancelAnimation(decayOffset);
        const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
        const pinnedPriceRange =
          runtime.pinnedPriceRange ??
          getTradingViewNativeRuntimeAutoPriceRange({
            chartWidth: getTradingViewNativeChartWidth(
              runtime.size.width,
              priceAxisWidth.value,
            ),
            runtime,
          });
        if (!pinnedPriceRange) {
          return;
        }
        scheduleOnRN(handleAutoScaleStateChange, false);
        chartRuntime.value = {
          ...runtime,
          pinnedPriceRange,
          priceAxisScaleGesture: {
            chartHeight: getTradingViewNativeMainPriceAxisLayoutForPanes({
              height: runtime.size.height,
              subIndicatorPanes: runtime.subIndicatorPanes,
              timeAxisHeight,
            }).height,
            startScale: runtime.priceRangeScale,
            startY: event.y,
          },
        };
      })
      .onUpdate((event) => {
        'worklet';

        const runtime = chartRuntime.value;
        if (!runtime.pinnedPriceRange) {
          return;
        }
        chartRuntime.value = {
          ...runtime,
          priceRangeScale: getTradingViewNativePriceRangeScaleAfterDrag({
            chartHeight: runtime.priceAxisScaleGesture.chartHeight,
            currentY: event.y,
            startScale: runtime.priceAxisScaleGesture.startScale,
            startY: runtime.priceAxisScaleGesture.startY,
          }),
        };
      });

    return { resetGesture, scaleGesture };
  }, [
    chartRuntime,
    decayOffset,
    handleAutoScaleStateChange,
    isEnabled,
    priceAxisWidth,
    timeAxisHeight,
  ]);

  const priceAxisControlWidth = Math.max(
    chartSize.width - chartWidth - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
    0,
  );
  const mainPriceAxisLayout = useMemo(
    () =>
      getTradingViewNativeMainPriceAxisLayoutForPanes({
        height: chartSize.height,
        subIndicatorPanes,
        timeAxisHeight,
      }),
    [chartSize.height, subIndicatorPanes, timeAxisHeight],
  );
  const isPriceAxisPointer = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      isTradingViewNativeMainPriceAxisTouch({
        height: chartSize.height,
        paneCount:
          getTradingViewNativeVisibleSubIndicatorPaneCount(subIndicatorPanes),
        priceAxisWidth: priceAxisControlWidth,
        timeAxisHeight,
        width: chartSize.width,
        x,
        y,
      }),
    [
      chartSize.height,
      chartSize.width,
      priceAxisControlWidth,
      subIndicatorPanes,
      timeAxisHeight,
    ],
  );
  const updateHovered = useCallback((nextIsHovered: boolean) => {
    if (isHoveredRef.current === nextIsHovered) {
      return;
    }
    isHoveredRef.current = nextIsHovered;
    setIsHovered(nextIsHovered);
  }, []);
  const handlePointerMove = useCallback(
    (event: RNPointerEvent) => {
      if (event.nativeEvent.pointerType === 'touch') {
        return;
      }
      updateHovered(
        isPriceAxisPointer({
          x: event.nativeEvent.offsetX,
          y: event.nativeEvent.offsetY,
        }),
      );
    },
    [isPriceAxisPointer, updateHovered],
  );
  const handlePointerLeave = useCallback(() => {
    updateHovered(false);
  }, [updateHovered]);
  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (
        isPriceAxisPointer({
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
        })
      ) {
        showForTouch();
      } else {
        hideForTouch();
      }
    },
    [hideForTouch, isPriceAxisPointer, showForTouch],
  );

  return {
    handleAutoScalePress,
    handleLogScalePress,
    handlePointerLeave,
    handlePointerMove,
    handleTouchStart,
    isAutoScale,
    isVisible: isHovered || isTouchVisible,
    mainPriceAxisLayout,
    mode,
    priceAxisControlWidth,
    resetGesture: gestures.resetGesture,
    scaleGesture: gestures.scaleGesture,
  };
}
