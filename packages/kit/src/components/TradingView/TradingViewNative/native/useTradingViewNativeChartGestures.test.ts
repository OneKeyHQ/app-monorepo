/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import type { PropsWithChildren } from 'react';

import { renderHook } from '@testing-library/react';
import { Gesture } from 'react-native-gesture-handler';
import { withDecay } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { HeaderScrollGestureContext } from '@onekeyhq/components/src/composite/Tabs/HeaderScrollGestureContext';

import {
  TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE,
} from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import { reduceTradingViewNativeChartRuntime } from '../utils/chartRuntime';
import {
  getTradingViewNativeCandleX,
  getTradingViewNativePanStartOffsetAfterViewportPreservation,
} from '../utils/chartViewport';
import {
  getTradingViewNativeSubIndicatorLegendHitRegions,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
} from '../utils/subIndicatorRender';

import { useTradingViewNativeChartGestures } from './useTradingViewNativeChartGestures';

import type { ITradingViewNativePriceRange } from '../utils/chartViewport';
import type { GestureType } from 'react-native-gesture-handler';

type IMockGestureHandler = (...args: unknown[]) => void;

interface IMockGestureBuilder {
  [key: string]: unknown;
  handlers: Record<string, IMockGestureHandler>;
  maxDistance: jest.Mock;
  activeOffsetX: jest.Mock;
  failOffsetY: jest.Mock;
  requireExternalGestureToFail: jest.Mock;
}

const mockTapGestures: IMockGestureBuilder[] = [];
const mockPanGestures: IMockGestureBuilder[] = [];
const mockScheduleOnRN = jest.mocked(scheduleOnRN);
const mockGetSubIndicatorAtPoint = jest.mocked(
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
);
const mockGetSubIndicatorLegendHitRegions = jest.mocked(
  getTradingViewNativeSubIndicatorLegendHitRegions,
);

jest.mock(
  '@onekeyhq/components/src/composite/Tabs/HeaderScrollGestureContext',
  () => ({
    HeaderScrollGestureContext: jest
      .requireActual<typeof import('react')>('react')
      .createContext<GestureType[]>([]),
  }),
);

function mockCreateGestureBuilder(): IMockGestureBuilder {
  const handlers: Record<string, IMockGestureHandler> = {};
  const builder = { handlers } as IMockGestureBuilder;
  const methods = [
    'activateAfterLongPress',
    'activeOffsetX',
    'enabled',
    'failOffsetY',
    'maxDistance',
    'minDistance',
    'maxPointers',
    'requireExternalGestureToFail',
    'onBegin',
    'onEnd',
    'onFinalize',
    'onStart',
    'onTouchesDown',
    'onUpdate',
  ];
  methods.forEach((method) => {
    builder[method] = jest.fn((argument: unknown) => {
      if (method.startsWith('on') && typeof argument === 'function') {
        handlers[method] = argument as IMockGestureHandler;
      }
      return builder;
    });
  });
  return builder;
}

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Exclusive: jest.fn((...gestures: unknown[]) => gestures[0]),
    Pan: jest.fn(() => {
      const gesture = mockCreateGestureBuilder();
      mockPanGestures.push(gesture);
      return gesture;
    }),
    Pinch: jest.fn(() => mockCreateGestureBuilder()),
    Race: jest.fn((...gestures: unknown[]) => gestures[0]),
    Tap: jest.fn(() => {
      const gesture = mockCreateGestureBuilder();
      mockTapGestures.push(gesture);
      return gesture;
    }),
  },
}));

jest.mock('react-native-reanimated', () => ({
  cancelAnimation: jest.fn(),
  useSharedValue: <T>(value: T) => ({ value }),
  withDecay: jest.fn((config: unknown) => config),
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((callback: IMockGestureHandler, ...args: unknown[]) =>
    callback(...args),
  ),
}));

jest.mock('../utils/subIndicatorRender', () => ({
  getTradingViewNativeSubIndicatorLegendHitRegions: jest.fn(() => []),
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint: jest.fn(
    ({ y }: { y: number }): 'RSI' | null => (y === 100 ? 'RSI' : null),
  ),
  getTradingViewNativeVisibleSubIndicatorPaneCount: jest.fn(() => 1),
}));

function renderSettingsGesture(
  onSubIndicatorSettingsPress: jest.Mock,
): IMockGestureBuilder {
  const props = {
    chartRuntime: {
      value: {
        crosshair: { visible: false, x: 0 },
        points: [{}],
        size: { height: 320, width: 400 },
        subIndicatorPanes: [],
        viewport: { initialRightOffset: 0, offset: 0, zoomScale: 1 },
      },
    },
    decayOffset: { value: 0 },
    isClickInteractionEnabled: true,
    isCrosshairEnabled: true,
    onSubIndicatorSettingsPress,
    priceAxisResetGesture: {},
    priceAxisScaleGesture: {},
    priceAxisWidth: { value: 48 },
    resources: {
      value: {
        fonts: {
          legend: {
            measureText: () => ({ width: 0 }),
          },
        },
      },
    },
    timeAxisHeight: 20,
  } as unknown as Parameters<typeof useTradingViewNativeChartGestures>[0];

  renderHook(() => useTradingViewNativeChartGestures(props));
  const settingsGesture = mockTapGestures.find(
    (gesture) => gesture.maxDistance.mock.calls.length > 0,
  );
  expect(settingsGesture).toBeDefined();
  return settingsGesture as IMockGestureBuilder;
}

function renderChartGestures({
  headerScrollGestures = [],
  prioritizePageScroll = false,
}: {
  headerScrollGestures?: GestureType[];
  prioritizePageScroll?: boolean;
} = {}) {
  const chartRuntime = {
    value: {
      crosshair: { visible: true, x: 0, y: 0 },
      indicatorSeries: [],
      panGesture: { startOffset: 0, translationX: 0 },
      pinchGesture: {
        anchorX: 0,
        currentScale: 1,
        isActive: false,
        scaleBaseline: 1,
        startOffset: 0,
        startZoomScale: 1,
      },
      candleIntervalSeconds: 60,
      hasVolume: false,
      pinnedPriceRange: null as ITradingViewNativePriceRange | null,
      priceRangeScale: 1,
      priceScaleMode: 'linear',
      points: Array.from({ length: 100 }, (_, index) => ({
        o: 100,
        h: 120,
        l: 80,
        c: 100,
        v: 1,
        t: 1_700_000_000 + index * 60,
      })),
      size: { height: 300, width: 320 },
      subIndicatorPanes: [],
      timeAxisScaleGesture: {
        chartWidth: 0,
        currentX: 0,
        isActive: false,
        startOffset: 0,
        startX: 0,
        startZoomScale: 1,
      },
      viewport: { offset: 0, zoomScale: 1 },
    },
  };
  const decayOffset = { value: 0 };
  const props = {
    chartRuntime,
    decayOffset,
    prioritizePageScroll,
    isClickInteractionEnabled: true,
    isCrosshairEnabled: true,
    onSubIndicatorSettingsPress: jest.fn(),
    priceAxisResetGesture: {},
    priceAxisScaleGesture: {},
    priceAxisWidth: { value: 44 },
    resources: {
      value: {
        fonts: {
          legend: {
            measureText: () => ({ width: 0 }),
          },
        },
      },
    },
    timeAxisHeight: 20,
  } as unknown as Parameters<typeof useTradingViewNativeChartGestures>[0];

  const initialPanGestureCount = mockPanGestures.length;
  renderHook(() => useTradingViewNativeChartGestures(props), {
    wrapper: ({ children }: PropsWithChildren) =>
      createElement(
        HeaderScrollGestureContext.Provider,
        { value: headerScrollGestures },
        children,
      ),
  });
  return {
    chartRuntime,
    decayOffset,
    contentPanGesture: mockPanGestures[initialPanGestureCount + 1],
  };
}

describe('useTradingViewNativeChartGestures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPanGestures.length = 0;
    mockTapGestures.length = 0;
    mockGetSubIndicatorAtPoint.mockImplementation(
      ({ y }: { y: number }): 'RSI' | null => (y === 100 ? 'RSI' : null),
    );
  });

  it('opens the indicator pressed at touch-down after an allowed drift', () => {
    const onSubIndicatorSettingsPress = jest.fn();
    const gesture = renderSettingsGesture(onSubIndicatorSettingsPress);
    const fail = jest.fn();

    gesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 24, y: 100 }] },
      { fail },
    );
    gesture.handlers.onEnd?.({ x: 24, y: 107 }, true);
    gesture.handlers.onFinalize?.();

    expect(fail).not.toHaveBeenCalled();
    expect(mockGetSubIndicatorLegendHitRegions).toHaveBeenCalledWith(
      expect.objectContaining({ timeAxisHeight: 20 }),
    );
    expect(mockGetSubIndicatorAtPoint).toHaveBeenCalledTimes(1);
    expect(mockScheduleOnRN).toHaveBeenCalledWith(
      onSubIndicatorSettingsPress,
      'RSI',
    );
    expect(onSubIndicatorSettingsPress).toHaveBeenCalledWith('RSI');
  });

  it('does not open settings after the tap recognizer rejects the gesture', () => {
    const onSubIndicatorSettingsPress = jest.fn();
    const gesture = renderSettingsGesture(onSubIndicatorSettingsPress);

    gesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 24, y: 100 }] },
      { fail: jest.fn() },
    );
    gesture.handlers.onEnd?.({ x: 24, y: 109 }, false);
    gesture.handlers.onFinalize?.();

    expect(gesture.maxDistance).toHaveBeenCalledWith(
      TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE,
    );
    expect(mockScheduleOnRN).not.toHaveBeenCalled();
    expect(onSubIndicatorSettingsPress).not.toHaveBeenCalled();
  });

  it('scales the time range only when a horizontal drag starts on the time axis', () => {
    const { chartRuntime, decayOffset } = renderChartGestures();
    const contentPanGesture = mockPanGestures[1];
    const timeAxisScaleGesture = mockPanGestures[2];
    const failContentPan = jest.fn();
    const failTimeAxisScale = jest.fn();

    contentPanGesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 280 }] },
      { fail: failContentPan },
    );
    timeAxisScaleGesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 280 }] },
      { fail: failTimeAxisScale },
    );
    timeAxisScaleGesture.handlers.onStart?.({ x: 100 });
    timeAxisScaleGesture.handlers.onUpdate?.({ x: 150 });

    expect(failContentPan).toHaveBeenCalledTimes(1);
    expect(failTimeAxisScale).not.toHaveBeenCalled();
    expect(chartRuntime.value.crosshair.visible).toBe(false);
    expect(chartRuntime.value.viewport.zoomScale).toBeLessThan(1);
    expect(decayOffset.value).toBe(chartRuntime.value.viewport.offset);
    expect(chartRuntime.value.timeAxisScaleGesture).toMatchObject({
      currentX: 150,
      isActive: true,
      startX: 100,
      startZoomScale: 1,
    });

    timeAxisScaleGesture.handlers.onFinalize?.();
    expect(chartRuntime.value.timeAxisScaleGesture.isActive).toBe(false);
  });

  it('keeps crosshair gestures from claiming time-axis touches', () => {
    renderChartGestures();
    const crosshairGesture = mockPanGestures[0];
    const tapCrosshairGesture = mockTapGestures.find(
      (gesture) => gesture.maxDistance.mock.calls.length === 0,
    );
    const failCrosshair = jest.fn();
    const failTapCrosshair = jest.fn();
    const failMainChartCrosshair = jest.fn();
    const failMainChartTapCrosshair = jest.fn();

    expect(tapCrosshairGesture).toBeDefined();
    crosshairGesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 280 }] },
      { fail: failCrosshair },
    );
    tapCrosshairGesture?.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 280 }] },
      { fail: failTapCrosshair },
    );
    crosshairGesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 278 }] },
      { fail: failMainChartCrosshair },
    );
    tapCrosshairGesture?.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 278 }] },
      { fail: failMainChartTapCrosshair },
    );

    expect(failCrosshair).toHaveBeenCalledTimes(1);
    expect(failTapCrosshair).toHaveBeenCalledTimes(1);
    expect(failMainChartCrosshair).not.toHaveBeenCalled();
    expect(failMainChartTapCrosshair).not.toHaveBeenCalled();
  });

  it('keeps the crosshair visible after the long press ends', () => {
    const { chartRuntime } = renderChartGestures();
    const crosshairGesture = mockPanGestures[0];

    crosshairGesture.handlers.onStart?.({ x: 100, y: 120 });
    crosshairGesture.handlers.onFinalize?.({}, true);

    expect(chartRuntime.value.crosshair).toMatchObject({
      visible: true,
      x: 100,
      y: 120,
    });
  });

  it('hides the crosshair when the long press is interrupted', () => {
    const { chartRuntime } = renderChartGestures();
    const crosshairGesture = mockPanGestures[0];

    crosshairGesture.handlers.onStart?.({ x: 100, y: 120 });
    crosshairGesture.handlers.onFinalize?.({}, false);

    expect(chartRuntime.value.crosshair.visible).toBe(false);
  });

  it('rejects time-scale dragging outside the time axis', () => {
    renderChartGestures();
    const timeAxisScaleGesture = mockPanGestures[2];
    const fail = jest.fn();

    timeAxisScaleGesture.handlers.onTouchesDown?.(
      { changedTouches: [{ x: 100, y: 200 }] },
      { fail },
    );

    expect(fail).toHaveBeenCalledTimes(1);
  });
});

describe('horizontal chart panning', () => {
  beforeEach(() => {
    mockPanGestures.length = 0;
    mockTapGestures.length = 0;
  });
  it('keeps other embedded charts independent of parent scroll thresholds', () => {
    const headerScrollGesture = Gesture.Pan();
    const { contentPanGesture } = renderChartGestures({
      headerScrollGestures: [headerScrollGesture],
    });

    expect(
      contentPanGesture.requireExternalGestureToFail,
    ).not.toHaveBeenCalled();
  });

  it('waits for page direction selection without jumping on activation', () => {
    const headerScrollGesture = Gesture.Pan();
    const { chartRuntime, contentPanGesture } = renderChartGestures({
      headerScrollGestures: [headerScrollGesture],
      prioritizePageScroll: true,
    });

    expect(contentPanGesture.requireExternalGestureToFail).toHaveBeenCalledWith(
      headerScrollGesture,
    );
    const startOffset = chartRuntime.value.viewport.offset;
    contentPanGesture.handlers.onStart?.({ translationX: -12 });
    contentPanGesture.handlers.onUpdate?.({
      translationX: -12,
      translationY: 0,
    });
    expect(chartRuntime.value.viewport.offset).toBe(startOffset);

    contentPanGesture.handlers.onUpdate?.({
      translationX: -32,
      translationY: 0,
    });
    expect(chartRuntime.value.viewport.offset).toBeCloseTo(
      startOffset - 20 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
    );
  });

  it('does not wait for a page when no enclosing scroll gesture exists', () => {
    const { contentPanGesture } = renderChartGestures({
      prioritizePageScroll: true,
    });

    expect(
      contentPanGesture.requireExternalGestureToFail,
    ).not.toHaveBeenCalled();
  });

  it.each([-1, 1])(
    'continues a diagonal first move after the page rejects its horizontal direction (%i)',
    (direction) => {
      const headerScrollGesture = Gesture.Pan();
      const { chartRuntime, contentPanGesture } = renderChartGestures({
        headerScrollGestures: [headerScrollGesture],
        prioritizePageScroll: true,
      });

      // Native recognizers check failure before activation. A first move of
      // (30, 13) must not also fail the chart after the page rejects X > 12.
      expect(contentPanGesture.failOffsetY).not.toHaveBeenCalled();
      expect(contentPanGesture.activeOffsetX).toHaveBeenCalledWith([-4, 4]);
      expect(
        contentPanGesture.requireExternalGestureToFail,
      ).toHaveBeenCalledWith(headerScrollGesture);
      contentPanGesture.handlers.onStart?.({ translationX: direction * 30 });
      contentPanGesture.handlers.onUpdate?.({
        translationX: direction * 50,
        translationY: 13,
      });

      expect(chartRuntime.value.viewport.offset).toBeCloseTo(
        direction * 20 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      );
      expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    },
  );

  it.each([-24, 0, 24])(
    'keeps panning continuous after history preserves the viewport (activation at %i px)',
    (activationTranslationX) => {
      const { chartRuntime, contentPanGesture } = renderChartGestures({
        headerScrollGestures: [Gesture.Pan()],
        prioritizePageScroll: activationTranslationX !== 0,
      });
      const direction = Math.sign(activationTranslationX) || 1;
      const translationX = activationTranslationX + direction * 40;
      contentPanGesture.handlers.onStart?.({
        translationX: activationTranslationX,
      });
      contentPanGesture.handlers.onUpdate?.({ translationX, translationY: 0 });

      // Apply the viewport rebase used when history preserves the visible anchor.
      const runtime = chartRuntime.value;
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
        chartWidth: getTradingViewNativeChartWidth(runtime.size.width, 44),
        pointCount: runtime.points.length,
        pointRange: { firstIndex: 40, fitRange: false, lastIndex: 40 },
        type: 'viewportRequested',
      });
      const preservedOffset = nextRuntimeState.viewport.offset;
      chartRuntime.value = {
        ...runtime,
        ...nextRuntimeState,
        panGesture: {
          ...runtime.panGesture,
          startOffset:
            getTradingViewNativePanStartOffsetAfterViewportPreservation({
              currentTranslationX: runtime.panGesture.translationX,
              dragRatio: TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
              preservedOffset,
            }),
        },
      };

      contentPanGesture.handlers.onUpdate?.({ translationX, translationY: 0 });
      expect(chartRuntime.value.viewport.offset).toBeCloseTo(preservedOffset);

      contentPanGesture.handlers.onUpdate?.({
        translationX: translationX + direction * 10,
        translationY: 0,
      });
      expect(chartRuntime.value.viewport.offset).toBeCloseTo(
        preservedOffset + direction * 10 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      );
    },
  );

  it('yields vertical drags before activating horizontal panning', () => {
    const { contentPanGesture } = renderChartGestures();

    expect(contentPanGesture.activeOffsetX).toHaveBeenCalledWith([-4, 4]);
    expect(contentPanGesture.failOffsetY).toHaveBeenCalledWith([-12, 12]);
  });

  it.each([-1, 1])(
    'stops a horizontal drag before the final candle leaves the chart (direction %i)',
    (direction) => {
      const { chartRuntime, contentPanGesture } = renderChartGestures();
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({
        translationX: direction * 100_000,
        translationY: 0,
      });
      const runtime = chartRuntime.value;
      const chartWidth = getTradingViewNativeChartWidth(runtime.size.width, 44);
      const center = getTradingViewNativeCandleX({
        ...runtime.viewport,
        index: direction < 0 ? runtime.points.length - 1 : 0,
        pointCount: runtime.points.length,
        priceAxisX: chartWidth,
      });
      expect(center).toBeGreaterThan(0);
      expect(center).toBeLessThan(chartWidth);
      const boundaryOffset = runtime.viewport.offset;
      contentPanGesture.handlers.onUpdate?.({
        translationX: direction * 200_000,
        translationY: 0,
      });
      expect(chartRuntime.value.viewport.offset).toBe(boundaryOffset);
      contentPanGesture.handlers.onUpdate?.({
        translationX: direction * (200_000 - 20),
        translationY: 0,
      });
      const reversedOffset =
        boundaryOffset - direction * 20 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO;
      expect(chartRuntime.value.viewport.offset).toBeCloseTo(reversedOffset);
      contentPanGesture.handlers.onFinalize?.();
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({
        translationX: -direction * 20,
        translationY: 0,
      });
      expect(chartRuntime.value.viewport.offset).toBeCloseTo(
        reversedOffset - direction * 20 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      );
    },
  );

  it.each([-1000, 1000])(
    'bounds horizontal inertia to the same visible-candle limits (velocity %i)',
    (velocityX) => {
      const { contentPanGesture } = renderChartGestures();
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({
        translationX: -50,
        translationY: 0,
      });
      contentPanGesture.handlers.onEnd?.({ velocityX });
      expect(withDecay).toHaveBeenLastCalledWith({
        clamp: [-270, 595],
        deceleration: 0.9982,
        velocity: velocityX * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      });
    },
  );

  it.each([-80, 80])(
    'does not move or pin the price range for vertical movement (%i px)',
    (translationY) => {
      const { chartRuntime, contentPanGesture } = renderChartGestures();
      const startOffset = chartRuntime.value.viewport.offset;
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({ translationX: 0, translationY });

      expect(chartRuntime.value.pinnedPriceRange).toBeNull();
      expect(chartRuntime.value.viewport.offset).toBe(startOffset);
    },
  );

  it.each([-60, 60])(
    'keeps automatic price scaling during horizontal drags with vertical drift (%i px)',
    (translationY) => {
      const { chartRuntime, contentPanGesture } = renderChartGestures();
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({
        translationX: -100,
        translationY,
      });

      expect(chartRuntime.value.viewport.offset).toBeCloseTo(
        -100 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      );
      expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    },
  );

  it.each([-60, 60])(
    'preserves the range set by price-axis scaling during a drag (%i px vertical drift)',
    (translationY) => {
      const { chartRuntime, contentPanGesture } = renderChartGestures();
      const priceRange = { minPrice: 75, maxPrice: 125 };
      chartRuntime.value.pinnedPriceRange = priceRange;
      chartRuntime.value.priceRangeScale = 1.5;
      contentPanGesture.handlers.onStart?.();
      contentPanGesture.handlers.onUpdate?.({
        translationX: -100,
        translationY,
      });

      expect(chartRuntime.value.viewport.offset).toBeCloseTo(
        -100 * TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
      );
      expect(chartRuntime.value.pinnedPriceRange).toBe(priceRange);
      expect(chartRuntime.value.priceRangeScale).toBe(1.5);
    },
  );
});
