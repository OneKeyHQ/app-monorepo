/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { createTradingViewNativeChartRuntime } from './chartRuntime';
import { useTradingViewNativePriceScale } from './useTradingViewNativePriceScale';

import type { SharedValue } from 'react-native-reanimated';

type IMockGestureHandler = (...args: unknown[]) => void;

function createMockSharedValue<T>(value: T): SharedValue<T> {
  const sharedValue: SharedValue<T> = {
    value,
    addListener: jest.fn(),
    get: () => sharedValue.value,
    modify: jest.fn(),
    removeListener: jest.fn(),
    set: jest.fn(),
  };
  return sharedValue;
}

function mockCreateGestureBuilder() {
  const builder: Record<string, jest.Mock> = {};
  const methods = [
    'activeOffsetY',
    'enabled',
    'maxDistance',
    'maxPointers',
    'numberOfTaps',
    'onEnd',
    'onStart',
    'onTouchesDown',
    'onUpdate',
  ];
  methods.forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  return builder;
}

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: jest.fn(() => mockCreateGestureBuilder()),
    Tap: jest.fn(() => mockCreateGestureBuilder()),
  },
}));

jest.mock('react-native-reanimated', () => ({
  cancelAnimation: jest.fn(),
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((callback: IMockGestureHandler, ...args: unknown[]) =>
    callback(...args),
  ),
  scheduleOnUI: jest.fn((callback: IMockGestureHandler, ...args: unknown[]) =>
    callback(...args),
  ),
}));

jest.mock('../utils/subIndicatorRender', () => ({
  getTradingViewNativeVisibleSubIndicatorPaneCount: jest.fn(() => 0),
}));

describe('useTradingViewNativePriceScale', () => {
  it('toggles Auto and resets the range only when Auto is re-enabled', () => {
    const runtime = createTradingViewNativeChartRuntime({
      candleIntervalSeconds: 60,
      chartComponents: [],
      chartSettings: createTradingViewNativeChartSettings(),
      chartType: 'candlestick',
      currentPriceLabel: '',
      hasVolume: false,
      indicatorSeries: [],
      points: [
        { c: 12, h: 15, l: 10, o: 11, t: 1, v: 1 },
        { c: 18, h: 20, l: 14, o: 15, t: 2, v: 1 },
      ],
      subIndicatorPanes: [],
    });
    runtime.crosshair = { visible: true, x: 10, y: 20 };
    runtime.priceRangeScale = 2;
    runtime.size = { height: 300, width: 360 };
    const chartRuntime = createMockSharedValue(runtime);
    const { result } = renderHook(() =>
      useTradingViewNativePriceScale({
        chartRuntime,
        chartSize: { height: 300, width: 360 },
        chartWidth: 300,
        decayOffset: createMockSharedValue(0),
        isEnabled: true,
        isLogScaleAvailable: true,
        priceAxisWidth: createMockSharedValue(52),
        subIndicatorPanes: [],
        timeAxisHeight: 20,
      }),
    );

    expect(result.current.isAutoScale).toBe(true);

    act(() => {
      result.current.handleAutoScalePress();
    });
    expect(result.current.isAutoScale).toBe(false);
    expect(chartRuntime.value.pinnedPriceRange).toEqual({
      maxPrice: 20,
      minPrice: 10,
    });
    expect(chartRuntime.value.priceRangeScale).toBe(2);
    expect(chartRuntime.value.crosshair.visible).toBe(false);

    act(() => {
      result.current.handleAutoScalePress();
    });
    expect(result.current.isAutoScale).toBe(true);
    expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    expect(chartRuntime.value.priceRangeScale).toBe(1);
  });
});
