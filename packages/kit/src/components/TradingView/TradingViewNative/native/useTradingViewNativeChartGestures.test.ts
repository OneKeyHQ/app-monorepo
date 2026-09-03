/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { scheduleOnRN } from 'react-native-worklets';

import { TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE } from '../chartConstants';
import {
  getTradingViewNativeSubIndicatorLegendHitRegions,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
} from '../utils/subIndicatorRender';

import { useTradingViewNativeChartGestures } from './useTradingViewNativeChartGestures';

type IMockGestureHandler = (...args: unknown[]) => void;

interface IMockGestureBuilder {
  [key: string]: unknown;
  handlers: Record<string, IMockGestureHandler>;
  maxDistance: jest.Mock;
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

function mockCreateGestureBuilder(): IMockGestureBuilder {
  const handlers: Record<string, IMockGestureHandler> = {};
  const builder = { handlers } as IMockGestureBuilder;
  const methods = [
    'activateAfterLongPress',
    'activeOffsetX',
    'enabled',
    'failOffsetY',
    'maxDistance',
    'maxPointers',
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

function renderChartGestures() {
  const chartRuntime = {
    value: {
      crosshair: { visible: true, x: 0, y: 0 },
      panGesture: { startOffset: 0, translationX: 0 },
      pinchGesture: {
        anchorX: 0,
        currentScale: 1,
        isActive: false,
        scaleBaseline: 1,
        startOffset: 0,
        startZoomScale: 1,
      },
      points: Array.from({ length: 100 }, () => ({})),
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

  renderHook(() => useTradingViewNativeChartGestures(props));
  return { chartRuntime, decayOffset };
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
