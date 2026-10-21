import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { I18nManager, useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { HeaderScrollGestureContext } from '@onekeyhq/components/src/composite/Tabs/HeaderScrollGestureContext';

import { TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING } from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import { reduceTradingViewNativeChartRuntime } from '../utils/chartRuntime';
import { getTradingViewNativeVisiblePointRange } from '../utils/chartViewport';
import { getTradingViewNativeMainPriceRange } from '../utils/mainPriceRange';
import {
  getTradingViewNativeMainPriceAxisLayout,
  getTradingViewNativePriceRangeScaleAfterDrag,
  isTradingViewNativePriceAxisTouch,
} from '../utils/priceAxisScale';
import { isTradingViewNativeLogPriceScaleAvailable } from '../utils/priceScale';
import {
  getTradingViewNativeSubIndicatorAutoPriceRange,
  getTradingViewNativeSubIndicatorPriceAxisLayouts,
} from '../utils/subIndicatorPriceScale';
import {
  getTradingViewNativeSubIndicatorValueRange,
  getTradingViewNativeVisibleSubIndicatorPaneCount,
} from '../utils/subIndicatorRender';

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

interface IPriceAxisTarget {
  height: number;
  paneId: string | null;
  top: number;
}

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
    panes: subIndicatorPanes,
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
  onInteractionChange,
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
  onInteractionChange?: (active: boolean) => void;
  priceAxisWidth: SharedValue<number>;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisHeight: number;
}) {
  const [isAutoScale, setIsAutoScale] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchVisible, setIsTouchVisible] = useState(false);
  const [mode, setMode] = useState<ITradingViewNativePriceScaleMode>('linear');
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);
  const scaleTarget = useSharedValue<IPriceAxisTarget | null>(null);
  const resetTarget = useSharedValue<IPriceAxisTarget | null>(null);

  const hideForTouch = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    setIsTouchVisible(false);
  }, []);

  const showForTouch = useCallback((paneId: string | null = null) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    setIsTouchVisible(true);
    setActivePaneId(paneId);
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

  const restoreControls = useCallback(
    (isAuto: boolean, priceScaleMode: ITradingViewNativePriceScaleMode) => {
      setIsAutoScale(isAuto);
      setMode(priceScaleMode);
    },
    [],
  );

  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      const runtime = chartRuntime.value;
      const scale =
        activePaneId === null
          ? undefined
          : runtime.subIndicatorPriceScales[activePaneId];
      scheduleOnRN(
        restoreControls,
        activePaneId === null
          ? runtime.pinnedPriceRange === null
          : !scale?.pinnedPriceRange,
        activePaneId === null
          ? runtime.priceScaleMode
          : (scale?.mode ?? 'linear'),
      );
    });
  }, [activePaneId, chartRuntime, restoreControls]);

  const activePane = subIndicatorPanes.find(
    (pane) => pane.instanceId === activePaneId && pane.isVisible,
  );
  const activeIsLogScaleAvailable = useMemo(() => {
    if (activePaneId === null) return isLogScaleAvailable;
    if (!activePane) return false;
    return isTradingViewNativeLogPriceScaleAvailable(
      getTradingViewNativeSubIndicatorAutoPriceRange({
        pane: activePane,
        startIndex: 0,
        endIndex: Math.max(
          0,
          ...activePane.series.map((series) => series.values.length),
        ),
      }),
    );
  }, [activePane, activePaneId, isLogScaleAvailable]);

  useEffect(() => {
    if (activeIsLogScaleAvailable || mode === 'linear') {
      return;
    }
    setMode('linear');
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      if (activePaneId !== null) {
        const scale = runtime.subIndicatorPriceScales[activePaneId];
        if (scale)
          chartRuntime.value = {
            ...runtime,
            subIndicatorPriceScales: {
              ...runtime.subIndicatorPriceScales,
              [activePaneId]: { ...scale, mode: 'linear' },
            },
          };
        return;
      }
      chartRuntime.value = {
        ...runtime,
        priceScaleMode: 'linear',
      };
    });
  }, [
    activePaneId,
    activeIsLogScaleAvailable,
    chartRuntime,
    decayOffset,
    mode,
  ]);

  const handleAutoScalePress = useCallback(() => {
    if (isTouchVisible) {
      showForTouch(activePaneId);
    }
    const nextIsAutoScale = !isAutoScale;
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      if (activePaneId !== null) {
        const pane = runtime.subIndicatorPanes.find(
          (item) => item.instanceId === activePaneId && item.isVisible,
        );
        if (!pane) return;
        const previous = runtime.subIndicatorPriceScales[activePaneId];
        const range = getTradingViewNativeSubIndicatorAutoPriceRange({
          pane,
          ...getTradingViewNativeVisiblePointRange({
            chartWidth: getTradingViewNativeChartWidth(
              runtime.size.width,
              priceAxisWidth.value,
            ),
            ...runtime.viewport,
            pointCount: runtime.points.length,
          }),
        });
        if (!nextIsAutoScale && !range) return;
        chartRuntime.value = {
          ...runtime,
          subIndicatorPriceScales: {
            ...runtime.subIndicatorPriceScales,
            [activePaneId]: {
              mode: previous?.mode ?? 'linear',
              pinnedPriceRange: nextIsAutoScale ? null : range,
              rangeScale: 1,
            },
          },
        };
        scheduleOnRN(handleAutoScaleStateChange, nextIsAutoScale);
        return;
      }
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
    activePaneId,
    chartRuntime,
    decayOffset,
    handleAutoScaleStateChange,
    isAutoScale,
    isTouchVisible,
    priceAxisWidth,
    showForTouch,
  ]);

  const handleLogScalePress = useCallback(() => {
    if (!activeIsLogScaleAvailable) {
      return;
    }
    if (isTouchVisible) {
      showForTouch(activePaneId);
    }
    const nextMode = mode === 'linear' ? 'logarithmic' : 'linear';
    setMode(nextMode);
    scheduleOnUI(() => {
      'worklet';

      cancelAnimation(decayOffset);
      const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
      if (activePaneId !== null) {
        const previous = runtime.subIndicatorPriceScales[activePaneId];
        chartRuntime.value = {
          ...runtime,
          subIndicatorPriceScales: {
            ...runtime.subIndicatorPriceScales,
            [activePaneId]: {
              pinnedPriceRange: previous?.pinnedPriceRange ?? null,
              rangeScale: previous?.rangeScale ?? 1,
              mode: nextMode,
            },
          },
        };
        return;
      }
      chartRuntime.value = {
        ...runtime,
        priceScaleMode: nextMode,
      };
    });
  }, [
    activePaneId,
    activeIsLogScaleAvailable,
    chartRuntime,
    decayOffset,
    isTouchVisible,
    mode,
    showForTouch,
  ]);

  const { excludeStartEdgeWidth } = useContext(HeaderScrollGestureContext);
  const { width: windowWidth } = useWindowDimensions();
  const isRTL = I18nManager.isRTL;

  const gestures = useMemo(() => {
    const isNavigationEdgeTouch = (absoluteX: number) => {
      'worklet';
      return (
        excludeStartEdgeWidth > 0 &&
        (isRTL
          ? windowWidth - absoluteX < excludeStartEdgeWidth
          : absoluteX < excludeStartEdgeWidth)
      );
    };
    const getPriceAxisTarget = (
      x: number,
      y: number,
    ): IPriceAxisTarget | null => {
      'worklet';

      const runtime = chartRuntime.value;
      if (
        !isTradingViewNativePriceAxisTouch({
          priceAxisHeight: runtime.size.height - timeAxisHeight,
          priceAxisWidth: priceAxisWidth.value,
          width: runtime.size.width,
          x,
          y,
        })
      )
        return null;
      const main = getTradingViewNativeMainPriceAxisLayoutForPanes({
        height: runtime.size.height,
        subIndicatorPanes: runtime.subIndicatorPanes,
        timeAxisHeight,
      });
      if (y < main.height) return { height: main.height, paneId: null, top: 0 };
      const pane = getTradingViewNativeSubIndicatorPriceAxisLayouts({
        height: runtime.size.height,
        panes: runtime.subIndicatorPanes,
        timeAxisHeight,
      }).find((layout) => y >= layout.top && y < layout.bottom);
      return pane
        ? { height: pane.height, paneId: pane.pane.instanceId, top: pane.top }
        : null;
    };

    const resetGesture = Gesture.Tap()
      .enabled(isEnabled)
      .numberOfTaps(2)
      .maxDistance(PRICE_AXIS_DOUBLE_TAP_MAX_DISTANCE)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        const target =
          touch && !isNavigationEdgeTouch(touch.absoluteX)
            ? getPriceAxisTarget(touch.x, touch.y)
            : null;
        if (
          !target ||
          (resetTarget.value && resetTarget.value.paneId !== target.paneId)
        ) {
          stateManager.fail();
          return;
        }
        resetTarget.value = target;
      })
      .onEnd((_event, success) => {
        'worklet';

        const target = resetTarget.value;
        if (!success || !target) {
          return;
        }
        cancelAnimation(decayOffset);
        const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
        if (target.paneId !== null) {
          const previous = runtime.subIndicatorPriceScales[target.paneId];
          chartRuntime.value = {
            ...runtime,
            subIndicatorPriceScales: {
              ...runtime.subIndicatorPriceScales,
              [target.paneId]: {
                mode: previous?.mode ?? 'linear',
                pinnedPriceRange: null,
                rangeScale: 1,
              },
            },
          };
          scheduleOnRN(restoreControls, true, previous?.mode ?? 'linear');
          return;
        }
        chartRuntime.value = {
          ...runtime,
          pinnedPriceRange: null,
          priceRangeScale: 1,
        };
        scheduleOnRN(handleAutoScaleStateChange, true);
      })
      .onFinalize(() => {
        'worklet';
        resetTarget.value = null;
      });

    const scaleGesture = Gesture.Pan()
      .enabled(isEnabled)
      .activeOffsetY([-4, 4])
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        'worklet';

        const touch = event.changedTouches[0];
        scaleTarget.value =
          touch && !isNavigationEdgeTouch(touch.absoluteX)
            ? getPriceAxisTarget(touch.x, touch.y)
            : null;
        if (!scaleTarget.value) {
          stateManager.fail();
        }
      })
      .onStart((event) => {
        'worklet';
        const target = scaleTarget.value;
        if (!target) return;
        if (onInteractionChange) scheduleOnRN(onInteractionChange, true);

        cancelAnimation(decayOffset);
        const runtime = getRuntimeWithCrosshairHidden(chartRuntime.value);
        if (target.paneId !== null) {
          const pane = runtime.subIndicatorPanes.find(
            (item) => item.instanceId === target.paneId && item.isVisible,
          );
          if (!pane) return;
          const previous = runtime.subIndicatorPriceScales[target.paneId];
          const visibleRange = getTradingViewNativeVisiblePointRange({
            chartWidth: getTradingViewNativeChartWidth(
              runtime.size.width,
              priceAxisWidth.value,
            ),
            ...runtime.viewport,
            pointCount: runtime.points.length,
          });
          const range = getTradingViewNativeSubIndicatorValueRange({
            pane,
            ...visibleRange,
          });
          const pinnedPriceRange =
            previous?.pinnedPriceRange ??
            (range
              ? { minPrice: range.minValue, maxPrice: range.maxValue }
              : null);
          if (!pinnedPriceRange) return;
          const startScale = previous?.rangeScale ?? 1;
          chartRuntime.value = {
            ...runtime,
            subIndicatorPriceScales: {
              ...runtime.subIndicatorPriceScales,
              [target.paneId]: {
                mode: previous?.mode ?? 'linear',
                pinnedPriceRange,
                rangeScale: startScale,
              },
            },
            priceAxisScaleGesture: {
              chartHeight: target.height,
              paneId: target.paneId,
              startScale,
              startY: event.y - target.top,
              top: target.top,
            },
          };
          scheduleOnRN(restoreControls, false, previous?.mode ?? 'linear');
          return;
        }
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
            chartHeight: target.height,
            paneId: null,
            startScale: runtime.priceRangeScale,
            startY: event.y,
            top: 0,
          },
        };
      })
      .onUpdate((event) => {
        'worklet';

        const runtime = chartRuntime.value;
        const { paneId, top } = runtime.priceAxisScaleGesture;
        if (!scaleTarget.value || scaleTarget.value.paneId !== paneId) return;
        if (paneId !== null) {
          const scale = runtime.subIndicatorPriceScales[paneId];
          if (!scale?.pinnedPriceRange) return;
          chartRuntime.value = {
            ...runtime,
            subIndicatorPriceScales: {
              ...runtime.subIndicatorPriceScales,
              [paneId]: {
                ...scale,
                rangeScale: getTradingViewNativePriceRangeScaleAfterDrag({
                  chartHeight: runtime.priceAxisScaleGesture.chartHeight,
                  currentY: event.y - top,
                  startScale: runtime.priceAxisScaleGesture.startScale,
                  startY: runtime.priceAxisScaleGesture.startY,
                }),
              },
            },
          };
          return;
        }
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
      })
      .onFinalize(() => {
        'worklet';
        scaleTarget.value = null;
        if (onInteractionChange) scheduleOnRN(onInteractionChange, false);
      });

    return { resetGesture, scaleGesture };
  }, [
    chartRuntime,
    decayOffset,
    handleAutoScaleStateChange,
    onInteractionChange,
    isEnabled,
    priceAxisWidth,
    resetTarget,
    excludeStartEdgeWidth,
    isRTL,
    windowWidth,
    restoreControls,
    scaleTarget,
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
  const subIndicatorAxisLayouts = useMemo(
    () =>
      getTradingViewNativeSubIndicatorPriceAxisLayouts({
        height: chartSize.height,
        panes: subIndicatorPanes,
        timeAxisHeight,
      }),
    [chartSize.height, subIndicatorPanes, timeAxisHeight],
  );
  const activePaneLayout = subIndicatorAxisLayouts.find(
    (layout) => layout.pane.instanceId === activePaneId,
  );
  useEffect(() => {
    if (activePaneId !== null && !activePaneLayout) setActivePaneId(null);
  }, [activePaneId, activePaneLayout]);
  const getPriceAxisPointerTarget = useCallback(
    ({ x, y }: { x: number; y: number }): string | null | undefined => {
      if (
        !isTradingViewNativePriceAxisTouch({
          priceAxisHeight: chartSize.height - timeAxisHeight,
          priceAxisWidth: priceAxisControlWidth,
          width: chartSize.width,
          x,
          y,
        })
      )
        return undefined;
      if (y < mainPriceAxisLayout.height) return null;
      return subIndicatorAxisLayouts.find(
        (layout) => y >= layout.top && y < layout.bottom,
      )?.pane.instanceId;
    },
    [
      chartSize.height,
      chartSize.width,
      priceAxisControlWidth,
      mainPriceAxisLayout.height,
      subIndicatorAxisLayouts,
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
      const target = getPriceAxisPointerTarget({
        x: event.nativeEvent.offsetX,
        y: event.nativeEvent.offsetY,
      });
      updateHovered(target !== undefined);
      if (target !== undefined) setActivePaneId(target);
    },
    [getPriceAxisPointerTarget, updateHovered],
  );
  const handlePointerLeave = useCallback(() => {
    updateHovered(false);
  }, [updateHovered]);
  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const target = getPriceAxisPointerTarget({
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      });
      if (target !== undefined) {
        showForTouch(target);
      } else {
        hideForTouch();
      }
    },
    [hideForTouch, getPriceAxisPointerTarget, showForTouch],
  );

  return {
    activePaneId,
    handleAutoScalePress,
    handleLogScalePress,
    handlePointerLeave,
    handlePointerMove,
    handleTouchStart,
    isAutoScale,
    isLogScaleAvailable: activeIsLogScaleAvailable,
    isVisible: isHovered || isTouchVisible,
    mainPriceAxisLayout,
    controlsBottomInset: activePaneLayout
      ? chartSize.height - activePaneLayout.bottom
      : mainPriceAxisLayout.bottomInset,
    mode,
    priceAxisControlWidth,
    resetGesture: gestures.resetGesture,
    scaleGesture: gestures.scaleGesture,
  };
}
