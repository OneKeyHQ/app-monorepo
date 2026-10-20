/**
 * @jest-environment jsdom
 */
// cspell:ignore macd

import { act, renderHook } from '@testing-library/react';

import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeIndicatorPriceRange } from '../utils/chartIndicators';
import {
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
} from '../utils/chartLayout';
import {
  clampTradingViewNativePanOffset,
  getTradingViewNativeVisiblePointRange,
} from '../utils/chartViewport';
import {
  applyTradingViewNativeSubIndicatorPriceScales,
  getTradingViewNativeSubIndicatorPriceAxisLayouts,
} from '../utils/subIndicatorPriceScale';
import {
  createTradingViewNativeSubIndicatorRenderSnapshots,
  getTradingViewNativeSubIndicatorValueRange,
} from '../utils/subIndicatorRender';

import { createTradingViewNativeChartRuntime } from './chartRuntime';
import { useTradingViewNativePriceScale } from './useTradingViewNativePriceScale';

import type { GestureResponderEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

type IMockGestureHandler = (...args: unknown[]) => void;

const mockPanGestureHandlers: Record<string, IMockGestureHandler>[] = [];
const mockTapGestureHandlers: Record<string, IMockGestureHandler>[] = [];

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
    Pan: jest.fn(() => {
      const handlers: Record<string, IMockGestureHandler> = {};
      mockPanGestureHandlers.push(handlers);
      return mockCreateGestureBuilder(handlers);
    }),
    Tap: jest.fn(() => {
      const handlers: Record<string, IMockGestureHandler> = {};
      mockTapGestureHandlers.push(handlers);
      return mockCreateGestureBuilder(handlers);
    }),
  },
}));

jest.mock('react-native-reanimated', () => ({
  cancelAnimation: jest.fn(),
  useSharedValue: <T>(value: T) =>
    jest.requireActual<typeof import('react')>('react').useRef({ value })
      .current,
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((callback: IMockGestureHandler, ...args: unknown[]) =>
    callback(...args),
  ),
  scheduleOnUI: jest.fn((callback: IMockGestureHandler, ...args: unknown[]) =>
    callback(...args),
  ),
}));

function renderPriceScaleAtOffset(offset: number, withIndicators = false) {
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
  if (withIndicators) {
    runtime.subIndicatorPanes =
      createTradingViewNativeSubIndicatorRenderSnapshots({
        configs: [
          { id: 'rsi', indicator: 'RSI' },
          { id: 'macd', indicator: 'MACD' },
        ],
        points: runtime.points,
      }).map(({ pane }, index) => ({
        ...pane,
        scale: {
          kind: 'fixed',
          minValue: index === 0 ? 1 : -10,
          maxValue: 100,
        },
      }));
  }
  const chartWidth = getTradingViewNativeChartWidth(runtime.size.width, 52);
  runtime.viewport.offset = clampTradingViewNativePanOffset({
    ...runtime.viewport,
    chartWidth,
    offset,
    pointCount: runtime.points.length,
  });
  const chartRuntime = createMockSharedValue(runtime);
  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    ...runtime.viewport,
    chartWidth,
    pointCount: runtime.points.length,
  });
  expect(visiblePointRange.endIndex - visiblePointRange.startIndex).toBe(1);
  const layout = getTradingViewNativeChartLayout({
    additionalPriceRange: getTradingViewNativeIndicatorPriceRange({
      ...visiblePointRange,
      series: runtime.indicatorSeries,
    }),
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
      subIndicatorPanes: runtime.subIndicatorPanes,
      timeAxisHeight: 20,
    }),
  );
  return { chartRuntime, layout, result };
}

describe('useTradingViewNativePriceScale', () => {
  beforeEach(() => {
    mockPanGestureHandlers.length = 0;
    mockTapGestureHandlers.length = 0;
  });

  describe.each([
    {
      viewport: 'history',
      offset: 1000,
      expectedOffset: 7,
      expectedRange: { minPrice: 1, maxPrice: 15 },
    },
    {
      viewport: 'future',
      offset: -1000,
      expectedOffset: -302,
      expectedRange: { minPrice: 14, maxPrice: 1000 },
    },
  ])(
    'at the $viewport boundary',
    ({ offset, expectedOffset, expectedRange }) => {
      it('pins the displayed price range when switching to manual scale', () => {
        const { chartRuntime, layout, result } =
          renderPriceScaleAtOffset(offset);
        expect(layout?.autoPriceRange).toEqual(expectedRange);

        act(() => {
          result.current.handleAutoScalePress();
        });

        expect(result.current.isAutoScale).toBe(false);
        expect(chartRuntime.value.pinnedPriceRange).toEqual(
          layout?.autoPriceRange,
        );
        expect(chartRuntime.value.viewport.offset).toBe(expectedOffset);

        act(() => {
          result.current.handleAutoScalePress();
        });
        expect(result.current.isAutoScale).toBe(true);
        expect(chartRuntime.value.pinnedPriceRange).toBeNull();
      });

      it('scales the displayed price range when dragging the price axis', () => {
        const { chartRuntime, layout, result } =
          renderPriceScaleAtOffset(offset);
        expect(layout?.autoPriceRange).toEqual(expectedRange);

        act(() => {
          mockPanGestureHandlers[0].onTouchesDown(
            { changedTouches: [{ x: 340, y: 100 }] },
            { fail: jest.fn() },
          );
          mockPanGestureHandlers[0].onStart({ y: 100 });
          mockPanGestureHandlers[0].onUpdate({ y: 150 });
        });

        expect(result.current.isAutoScale).toBe(false);
        expect(chartRuntime.value.pinnedPriceRange).toEqual(
          layout?.autoPriceRange,
        );
        expect(chartRuntime.value.priceRangeScale).not.toBe(1);
        expect(Number.isFinite(chartRuntime.value.priceRangeScale)).toBe(true);
        expect(chartRuntime.value.viewport.offset).toBe(expectedOffset);
      });
    },
  );

  it('scales the touched indicator independently across pane boundaries and resets only that pane', () => {
    const { chartRuntime, result } = renderPriceScaleAtOffset(1000);
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'rsi', indicator: 'RSI' },
        { id: 'macd', indicator: 'MACD' },
      ],
      points: chartRuntime.value.points,
    }).map(({ pane }, index) => ({
      ...pane,
      preferredHeight: index === 0 ? 80 : 100,
    }));
    chartRuntime.value.subIndicatorPanes = panes;
    chartRuntime.value.pinnedPriceRange = { minPrice: 1, maxPrice: 1000 };
    chartRuntime.value.priceRangeScale = 2;
    chartRuntime.value.subIndicatorPriceScales.macd = {
      mode: 'linear',
      pinnedPriceRange: { minPrice: -10, maxPrice: 10 },
      rangeScale: 2,
    };
    const viewport = chartRuntime.value.viewport;
    const [rsi, macd] = getTradingViewNativeSubIndicatorPriceAxisLayouts({
      height: 300,
      panes,
      timeAxisHeight: 20,
    });
    const startY = rsi.top + rsi.height / 2;
    const pan = mockPanGestureHandlers[0];
    const fail = jest.fn();
    act(() => {
      pan.onTouchesDown({ changedTouches: [{ x: 340, y: startY }] }, { fail });
      pan.onStart({ y: startY + 5 });
      pan.onUpdate({ y: macd.bottom - 1 });
      pan.onFinalize();
    });
    expect(fail).not.toHaveBeenCalled();
    const scale = chartRuntime.value.subIndicatorPriceScales.rsi;
    expect(scale?.rangeScale).toBeGreaterThan(1);
    const scaled = applyTradingViewNativeSubIndicatorPriceScales(
      panes,
      chartRuntime.value.subIndicatorPriceScales,
    );
    expect(
      getTradingViewNativeSubIndicatorValueRange({
        pane: scaled[0],
        startIndex: 0,
        endIndex: 2,
      }),
    ).not.toEqual(
      getTradingViewNativeSubIndicatorValueRange({
        pane: panes[0],
        startIndex: 0,
        endIndex: 2,
      }),
    );
    expect(chartRuntime.value.subIndicatorPriceScales.macd?.rangeScale).toBe(2);
    expect(chartRuntime.value.pinnedPriceRange).toEqual({
      minPrice: 1,
      maxPrice: 1000,
    });
    expect(chartRuntime.value.priceRangeScale).toBe(2);
    expect(chartRuntime.value.viewport).toBe(viewport);
    expect(result.current.isAutoScale).toBe(false);

    const tap = mockTapGestureHandlers[0];
    act(() => {
      tap.onTouchesDown({ changedTouches: [{ x: 340, y: startY }] }, { fail });
      tap.onTouchesDown({ changedTouches: [{ x: 340, y: startY }] }, { fail });
      tap.onEnd({}, true);
      tap.onFinalize();
    });
    expect(
      chartRuntime.value.subIndicatorPriceScales.rsi?.pinnedPriceRange,
    ).toBeNull();
    expect(chartRuntime.value.subIndicatorPriceScales.macd?.rangeScale).toBe(2);
    expect(chartRuntime.value.priceRangeScale).toBe(2);
    expect(
      applyTradingViewNativeSubIndicatorPriceScales(
        panes,
        chartRuntime.value.subIndicatorPriceScales,
      )[0],
    ).toBe(panes[0]);
  });

  it('rejects plot and time-axis touches and cancels indicator dragging', () => {
    const { chartRuntime } = renderPriceScaleAtOffset(1000);
    const [snapshot] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'rsi', indicator: 'RSI' }],
      points: chartRuntime.value.points,
    });
    chartRuntime.value.subIndicatorPanes = [snapshot.pane];
    const pan = mockPanGestureHandlers[0];
    const fail = jest.fn();
    act(() => {
      pan.onTouchesDown({ changedTouches: [{ x: 100, y: 260 }] }, { fail });
      pan.onTouchesDown({ changedTouches: [{ x: 340, y: 290 }] }, { fail });
    });
    expect(fail).toHaveBeenCalledTimes(2);
    act(() => {
      pan.onTouchesDown({ changedTouches: [{ x: 340, y: 250 }] }, { fail });
      pan.onStart({ y: 255 });
      pan.onUpdate({ y: 265 });
      pan.onFinalize();
    });
    const scale = chartRuntime.value.subIndicatorPriceScales.rsi;
    act(() => pan.onUpdate({ y: 270 }));
    expect(chartRuntime.value.subIndicatorPriceScales.rsi).toBe(scale);
  });

  it('targets touch A/L controls to each indicator and restores their own states when switching axes', () => {
    const { chartRuntime, result } = renderPriceScaleAtOffset(1000, true);
    const touch = (y: number) =>
      act(() =>
        result.current.handleTouchStart({
          nativeEvent: { locationX: 340, locationY: y },
        } as GestureResponderEvent),
      );
    touch(190);
    expect(result.current.activePaneId).toBe('rsi');
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isLogScaleAvailable).toBe(true);
    act(() => result.current.handleLogScalePress());
    act(() => result.current.handleAutoScalePress());
    expect(chartRuntime.value.subIndicatorPriceScales.rsi).toEqual({
      mode: 'logarithmic',
      pinnedPriceRange: { minPrice: 1, maxPrice: 100 },
      rangeScale: 1,
    });
    expect(chartRuntime.value.priceScaleMode).toBe('linear');
    expect(chartRuntime.value.pinnedPriceRange).toBeNull();
    touch(250);
    expect(result.current.activePaneId).toBe('macd');
    expect(result.current.isAutoScale).toBe(true);
    expect(result.current.isLogScaleAvailable).toBe(false);
    act(() => result.current.handleLogScalePress());
    expect(chartRuntime.value.subIndicatorPriceScales.macd).toBeUndefined();
    touch(190);
    expect(result.current.isAutoScale).toBe(false);
    expect(result.current.mode).toBe('logarithmic');
    const tap = mockTapGestureHandlers[mockTapGestureHandlers.length - 1];
    act(() => {
      tap.onTouchesDown(
        { changedTouches: [{ x: 340, y: 190 }] },
        { fail: jest.fn() },
      );
      tap.onEnd({}, true);
      tap.onFinalize();
    });
    expect(result.current.isAutoScale).toBe(true);
    expect(chartRuntime.value.subIndicatorPriceScales.rsi).toEqual({
      mode: 'logarithmic',
      pinnedPriceRange: null,
      rangeScale: 1,
    });
    touch(100);
    expect(result.current.activePaneId).toBeNull();
    expect(result.current.mode).toBe('linear');
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
