/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { scheduleOnRN } from 'react-native-worklets';

import { TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE } from '../chartConstants';
import { getTradingViewNativeSubIndicatorLegendIndicatorAtPoint } from '../utils/subIndicatorRender';

import { useTradingViewNativeChartGestures } from './useTradingViewNativeChartGestures';

type IMockGestureHandler = (...args: unknown[]) => void;

interface IMockGestureBuilder {
  [key: string]: unknown;
  handlers: Record<string, IMockGestureHandler>;
  maxDistance: jest.Mock;
}

const mockTapGestures: IMockGestureBuilder[] = [];
const mockScheduleOnRN = jest.mocked(scheduleOnRN);
const mockGetSubIndicatorAtPoint = jest.mocked(
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
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
    Pan: jest.fn(() => mockCreateGestureBuilder()),
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
  } as unknown as Parameters<typeof useTradingViewNativeChartGestures>[0];

  renderHook(() => useTradingViewNativeChartGestures(props));
  const settingsGesture = mockTapGestures.find(
    (gesture) => gesture.maxDistance.mock.calls.length > 0,
  );
  expect(settingsGesture).toBeDefined();
  return settingsGesture as IMockGestureBuilder;
}

describe('useTradingViewNativeChartGestures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
