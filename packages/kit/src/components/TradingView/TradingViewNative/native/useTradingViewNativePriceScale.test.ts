/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
} from '../utils/chartLayout';
import { getTradingViewNativeVisiblePointRange } from '../utils/chartViewport';

import { createTradingViewNativeChartRuntime } from './chartRuntime';
import { useTradingViewNativePriceScale } from './useTradingViewNativePriceScale';

import type { SharedValue } from 'react-native-reanimated';

type IMockGestureHandler = (...args: unknown[]) => void;

const mockPanGestureHandlers: Record<string, IMockGestureHandler>[] = [];

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

function mockCreateGestureBuilder(
  handlers: Record<string, IMockGestureHandler> = {},
) {
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
    Pan: jest.fn(() => {
      const handlers: Record<string, IMockGestureHandler> = {};
      mockPanGestureHandlers.push(handlers);
      return mockCreateGestureBuilder(handlers);
    }),
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

function renderPriceScaleAtOffset(offset: number) {
  const runtime = createTradingViewNativeChartRuntime({
    candleIntervalSeconds: 60,
    chartComponents: [],
    chartSettings: createTradingViewNativeChartSettings(),
    chartType: 'candlestick',
    currentPriceLabel: '',
    hasVolume: false,
    indicatorSeries: [
      {
        indicator: 'MA',
        key: 'ma-5',
        kind: 'line',
        paint: 'indicatorCyanStroke',
        values: [1, 1000],
      },
    ],
    points: [
      { c: 12, h: 15, l: 10, o: 11, t: 1, v: 1 },
      { c: 18, h: 20, l: 14, o: 15, t: 61, v: 1 },
    ],
    subIndicatorPanes: [],
  });
  runtime.size = { height: 300, width: 360 };
  runtime.viewport.offset = offset;
  const chartRuntime = createMockSharedValue(runtime);
  const chartWidth = getTradingViewNativeChartWidth(runtime.size.width, 52);
  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    ...runtime.viewport,
    chartWidth,
    pointCount: runtime.points.length,
  });
  expect(visiblePointRange.startIndex).toBe(visiblePointRange.endIndex);
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds: 60,
    hasVolume: false,
    height: runtime.size.height,
    minimumTimeTickIndexSpacing: 1,
    points: runtime.points,
    priceAxisWidth: 52,
    visiblePointRange,
    width: runtime.size.width,
  });
  const { result } = renderHook(() =>
    useTradingViewNativePriceScale({
      chartRuntime,
      chartSize: runtime.size,
      chartWidth,
      decayOffset: createMockSharedValue(0),
      isEnabled: true,
      isLogScaleAvailable: true,
      priceAxisWidth: createMockSharedValue(52),
      subIndicatorPanes: [],
      timeAxisHeight: 20,
    }),
  );
  return { chartRuntime, layout, result };
}

describe('useTradingViewNativePriceScale', () => {
  beforeEach(() => {
    mockPanGestureHandlers.length = 0;
  });

  describe.each([
    {
      viewport: 'history',
      offset: 1000,
      expectedRange: { minPrice: 10, maxPrice: 15 },
    },
    {
      viewport: 'future',
      offset: -1000,
      expectedRange: { minPrice: 14, maxPrice: 20 },
    },
  ])('in an empty $viewport viewport', ({ offset, expectedRange }) => {
    it('pins the displayed price range when switching to manual scale', () => {
      const { chartRuntime, layout, result } = renderPriceScaleAtOffset(offset);
      expect(layout?.autoPriceRange).toEqual(expectedRange);

      act(() => {
        result.current.handleAutoScalePress();
      });

      expect(result.current.isAutoScale).toBe(false);
      expect(chartRuntime.value.pinnedPriceRange).toEqual(
        layout?.autoPriceRange,
      );
      expect(chartRuntime.value.viewport.offset).toBe(offset);

      act(() => {
        result.current.handleAutoScalePress();
      });
      expect(result.current.isAutoScale).toBe(true);
      expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    });

    it('scales the displayed price range when dragging the price axis', () => {
      const { chartRuntime, layout, result } = renderPriceScaleAtOffset(offset);
      expect(layout?.autoPriceRange).toEqual(expectedRange);

      act(() => {
        mockPanGestureHandlers[0].onStart({ y: 100 });
        mockPanGestureHandlers[0].onUpdate({ y: 150 });
      });

      expect(result.current.isAutoScale).toBe(false);
      expect(chartRuntime.value.pinnedPriceRange).toEqual(
        layout?.autoPriceRange,
      );
      expect(chartRuntime.value.priceRangeScale).not.toBe(1);
      expect(Number.isFinite(chartRuntime.value.priceRangeScale)).toBe(true);
      expect(chartRuntime.value.viewport.offset).toBe(offset);
    });
  });

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
  it('restores manual and logarithmic price controls when the canvas is remounted', () => {
    const runtime = createTradingViewNativeChartRuntime({
      candleIntervalSeconds: 60,
      chartComponents: [],
      chartSettings: createTradingViewNativeChartSettings(),
      chartType: 'candlestick',
      currentPriceLabel: '',
      hasVolume: false,
      indicatorSeries: [],
      points: [],
      subIndicatorPanes: [],
    });
    runtime.pinnedPriceRange = { minPrice: 10, maxPrice: 20 };
    runtime.priceRangeScale = 2;
    runtime.priceScaleMode = 'logarithmic';
    const chartRuntime = createMockSharedValue(runtime);
    const { result } = renderHook(() =>
      useTradingViewNativePriceScale({
        chartRuntime,
        chartSize: { height: 300, width: 760 },
        chartWidth: 700,
        decayOffset: createMockSharedValue(0),
        isEnabled: true,
        isLogScaleAvailable: true,
        priceAxisWidth: createMockSharedValue(52),
        subIndicatorPanes: [],
        timeAxisHeight: 20,
      }),
    );
    expect(result.current.isAutoScale).toBe(false);
    expect(result.current.mode).toBe('logarithmic');
    act(() => {
      result.current.handleAutoScalePress();
      result.current.handleLogScalePress();
    });
    expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    expect(chartRuntime.value.priceRangeScale).toBe(1);
    expect(chartRuntime.value.priceScaleMode).toBe('linear');
  });
});
