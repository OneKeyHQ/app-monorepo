/**
 * @jest-environment jsdom
 */
// cspell:ignore Skia

import { createElement } from 'react';
import type { PropsWithChildren } from 'react';

import { strict as assert } from 'assert';

import { act, render } from '@testing-library/react';
import { makeMutable } from 'react-native-reanimated';

import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { TradingViewNativeChartActiveContext } from '../TradingViewNativeChartActiveContext';
import { getTradingViewNativeCandleX } from '../utils/chartViewport';

import {
  createTradingViewNativeChartRuntime,
  resizeTradingViewNativeChartRuntime,
  shouldHoldTradingViewNativeSubIndicatorResize,
} from './chartRuntime';
import {
  applyTradingViewNativeSubIndicatorLatestPaneValues,
  getTradingViewNativeSubIndicatorPanesStructureKey,
  getTradingViewNativeSubIndicatorPanesUpdate,
  shouldReplaceTradingViewNativeChartPoints,
  shouldReplaceTradingViewNativeIndicatorSeries,
} from './chartRuntimeData';
import { TradingViewNativeChart } from './TradingViewNativeChart';

import type { ITradingViewNativeChartProps } from '../TradingViewNativeChart.types';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';
import type { SharedValue } from 'react-native-reanimated';

// Preserve the component's layout effects and runtime updates; stub only native
// rendering/gestures. Queue UI worklets in dispatch order like the native runtime.
const mockUIQueue: (() => void)[] = [];
function mockSharedValue<T>(value: T): SharedValue<T> {
  const shared = {
    value,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
    get: () => shared.value,
    set: jest.fn(),
  };
  return shared;
}
jest.mock('react-native-reanimated', () => ({
  cancelAnimation: jest.fn(),
  makeMutable: <T>(value: T) => mockSharedValue(value),
  useSharedValue: <T>(value: T) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useRef(mockSharedValue(value)).current,
  useDerivedValue: () =>
    jest.requireActual<typeof import('react')>('react').useRef({ value: 0 })
      .current,
  useAnimatedReaction: jest.fn(),
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnUI: (callback: () => void) => mockUIQueue.push(callback),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: PropsWithChildren) => children,
  Picture: () => null,
  FontWeight: { SemiBold: 600 },
  useTypeface: () => null,
}));
jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'test-font' }) },
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Simultaneous: jest.fn() },
  GestureDetector: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => children,
  useTheme: () => ({
    border: { val: '#ddd' },
    text: { val: '#111' },
    textSubdued: { val: '#777' },
  }),
  useThemeName: () => 'light',
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/react-native-fs', () => ({
  default: null,
}));
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  getDateFormatTemplate: () => 'yyyy-MM-dd',
}));
jest.mock('../indicatorPanes/useIndicatorPanes', () => ({
  useIndicatorPanes: (
    panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
  ) => ({ panes }),
}));
jest.mock('./chartSkiaRenderer', () => ({
  createTradingViewNativeSkiaFontForText: () => null,
  getTradingViewNativeSkiaLegendText: () => '',
}));
jest.mock('./chartSkiaText', () => ({}));
jest.mock('./NativeDrawingToolbar', () => ({
  NativeDrawingToolbar: () => null,
}));
jest.mock('./TradingViewNativeNavigationControls', () => ({
  TradingViewNativeNavigationControls: () => null,
}));
jest.mock('./TradingViewNativePriceScaleControls', () => ({
  TradingViewNativePriceScaleControls: () => null,
}));
jest.mock('./useNativeChartDrawings', () => ({
  useNativeChartDrawings: () => ({
    controller: { state: { tool: 'cursor' } },
    pointerId: { value: null },
  }),
}));
jest.mock('./useTradingViewNativeChartGestures', () => ({
  useTradingViewNativeChartGestures: () => null,
}));
jest.mock('./useTradingViewNativeNavigationVisibility', () => ({
  useTradingViewNativeNavigationVisibility: () => ({
    handleChartDragStart: jest.fn(),
    handleControlPress: jest.fn(),
    isVisible: false,
    tapGesture: null,
  }),
}));
jest.mock('./useTradingViewNativePriceScale', () => ({
  useTradingViewNativePriceScale: () => ({ priceAxisControlWidth: 0 }),
}));

function flushUIQueue() {
  act(() => {
    while (mockUIQueue.length) mockUIQueue.shift()?.();
  });
}

describe('TradingViewNativeChart interval lifecycle', () => {
  function propsForInterval(
    candleIntervalSeconds: number,
  ): ITradingViewNativeChartProps {
    return {
      candleIntervalSeconds,
      chartComponents: [],
      chartSettings: createTradingViewNativeChartSettings(),
      chartType: 'candlestick',
      chartPictureVersion: candleIntervalSeconds,
      currentPriceLabel: '12',
      hasVolume: false,
      indicatorSeries: [],
      indicatorSeriesSettingsKey: '',
      isSwitchingInterval: false,
      locale: 'en-US',
      onSubIndicatorSettingsPress: jest.fn(),
      candleLabels: { open: 'O', high: 'H', low: 'L', close: 'C' },
      points: Array.from({ length: 200 }, (_, index) => ({
        c: 12,
        h: 15,
        l: 10,
        o: 11,
        t: index * candleIntervalSeconds,
        v: 1,
      })),
      subIndicatorPanes: [],
    };
  }

  beforeEach(() => {
    mockUIQueue.length = 0;
  });

  it('replaces candles and resets the viewport on an ordinary interval change without remounting', () => {
    const runtimeRef: NonNullable<ITradingViewNativeChartProps['runtimeRef']> =
      { current: null };
    const initial = propsForInterval(60);
    const { rerender } = render(
      createElement(TradingViewNativeChart, { ...initial, runtimeRef }),
    );
    flushUIQueue();
    const session = runtimeRef.current;
    assert.ok(session, 'Chart session was not created');
    session.runtime.value = {
      ...session.runtime.value,
      size: { width: 390, height: 320 },
      viewport: { initialRightOffsetResolved: true, offset: 100, zoomScale: 2 },
      pinnedPriceRange: { minPrice: 9, maxPrice: 16 },
      priceRangeScale: 1.5,
      priceScaleMode: 'logarithmic',
    };
    const next = propsForInterval(3600);
    rerender(createElement(TradingViewNativeChart, { ...next, runtimeRef }));
    flushUIQueue();
    const expected = resizeTradingViewNativeChartRuntime(
      createTradingViewNativeChartRuntime({ ...next, subIndicatorPanes: [] }),
      { width: 390, height: 320 },
      0,
    );
    expect(runtimeRef.current).toBe(session);
    expect(session.runtime.value.points).toEqual(next.points);
    expect(session.runtime.value.candleIntervalSeconds).toBe(3600);
    expect(session.runtime.value.viewport).toEqual(expected.viewport);
    expect(session.runtime.value.pinnedPriceRange).toBeNull();
    expect(session.runtime.value.priceRangeScale).toBe(1);
    expect(session.runtime.value.priceScaleMode).toBe('linear');
    expect(session.decayOffset.value).toBe(expected.viewport.offset);
  });

  it('retains the fullscreen interval, viewport and price scale when the frozen inline canvas resumes', () => {
    const runtimeRef: NonNullable<ITradingViewNativeChartProps['runtimeRef']> =
      { current: null };
    const initial = propsForInterval(60);
    const chart = (props: ITradingViewNativeChartProps, active: boolean) =>
      createElement(
        TradingViewNativeChartActiveContext.Provider,
        { value: active },
        createElement(TradingViewNativeChart, { ...props, runtimeRef }),
      );
    const { rerender } = render(chart(initial, true));
    flushUIQueue();
    const inline = runtimeRef.current;
    assert.ok(inline, 'Chart session was not created');
    inline.runtime.value = {
      ...inline.runtime.value,
      size: { width: 390, height: 320 },
    };
    rerender(chart(initial, false));
    flushUIQueue();
    const next = propsForInterval(3600);
    const fullscreen = createTradingViewNativeChartRuntime({
      ...next,
      subIndicatorPanes: [],
    });
    fullscreen.size = { width: 760, height: 300 };
    fullscreen.viewport = {
      initialRightOffsetResolved: true,
      offset: 100,
      zoomScale: 2,
    };
    fullscreen.priceScaleMode = 'logarithmic';
    fullscreen.priceRangeScale = 1.5;
    fullscreen.pinnedPriceRange = { minPrice: 9, maxPrice: 16 };
    runtimeRef.current = {
      runtime: makeMutable(fullscreen),
      decayOffset: makeMutable(100),
    };
    rerender(chart(next, true));
    flushUIQueue();
    expect(runtimeRef.current).toBe(inline);
    expect(inline.runtime.value.candleIntervalSeconds).toBe(3600);
    expect(inline.runtime.value.points).toEqual(next.points);
    expect(inline.runtime.value.size).toEqual({ width: 390, height: 320 });
    expect(inline.runtime.value.viewport).toEqual(fullscreen.viewport);
    expect(inline.runtime.value.priceScaleMode).toBe('logarithmic');
    expect(inline.runtime.value.priceRangeScale).toBe(1.5);
    expect(inline.runtime.value.pinnedPriceRange).toEqual(
      fullscreen.pinnedPriceRange,
    );
    expect(inline.decayOffset.value).toBe(100);
  });
});

describe('TradingViewNativeChart resizing', () => {
  function createRuntime() {
    const runtime = createTradingViewNativeChartRuntime({
      candleIntervalSeconds: 60,
      chartComponents: [],
      chartSettings: createTradingViewNativeChartSettings(),
      chartType: 'candlestick',
      currentPriceLabel: '12',
      hasVolume: false,
      indicatorSeries: [
        {
          indicator: 'MA',
          key: 'ma',
          kind: 'line',
          paint: 'indicatorCyanStroke',
          values: Array.from({ length: 200 }, () => 12),
        },
      ],
      points: Array.from({ length: 200 }, (_, index) => ({
        c: 12,
        h: 15,
        l: 10,
        o: 11,
        t: index * 60,
        v: 1,
      })),
      subIndicatorPanes: [createPane()],
    });
    runtime.size = { width: 390, height: 320 };
    runtime.viewport = {
      initialRightOffsetResolved: true,
      offset: 100,
      zoomScale: 2,
    };
    runtime.panGesture.startOffset = 100;
    runtime.priceRangeScale = 1.5;
    return runtime;
  }

  it('preserves data, zoom and historical position through fullscreen and back', () => {
    const runtime = createRuntime();
    const landscape = resizeTradingViewNativeChartRuntime(
      runtime,
      { width: 760, height: 300 },
      60,
    );
    const portrait = resizeTradingViewNativeChartRuntime(
      landscape,
      runtime.size,
      60,
    );
    for (const resized of [landscape, portrait]) {
      expect(resized.points).toBe(runtime.points);
      expect(resized.indicatorSeries).toBe(runtime.indicatorSeries);
      expect(resized.indicatorSeries[0].values).toBe(
        runtime.indicatorSeries[0].values,
      );
      expect(resized.subIndicatorPanes).toBe(runtime.subIndicatorPanes);
      expect(resized.viewport).toEqual(runtime.viewport);
      expect(resized.priceRangeScale).toBe(1.5);
    }
    expect(landscape.size).toEqual({ width: 760, height: 300 });
    expect(portrait.size).toEqual(runtime.size);
  });

  it('ignores transient zero bounds and unchanged measurements', () => {
    const runtime = createRuntime();
    expect(
      resizeTradingViewNativeChartRuntime(runtime, { width: 0, height: 0 }, 60),
    ).toBe(runtime);
    expect(resizeTradingViewNativeChartRuntime(runtime, runtime.size, 60)).toBe(
      runtime,
    );
  });

  it.each([
    { offset: -10_000, expectedOffset: -688, edgeIndex: 199, edgeX: 5 },
    { offset: 10_000, expectedOffset: 2390, edgeIndex: 0, edgeX: 695 },
  ])(
    'keeps a candle and the gesture origin in bounds on resize from $offset',
    ({ offset, expectedOffset, edgeIndex, edgeX }) => {
      const runtime = createRuntime();
      runtime.viewport.offset = offset;
      runtime.panGesture.startOffset = offset;
      runtime.crosshair = { visible: true, x: 120, y: 200 };
      const resized = resizeTradingViewNativeChartRuntime(
        runtime,
        { width: 760, height: 300 },
        60,
      );
      expect(resized.viewport.offset).toBe(expectedOffset);
      expect(
        getTradingViewNativeCandleX({
          ...resized.viewport,
          index: edgeIndex,
          pointCount: resized.points.length,
          priceAxisX: 700,
        }),
      ).toBe(edgeX);
      expect(resized.panGesture.startOffset).toBe(resized.viewport.offset);
      expect(resized.crosshair.visible).toBe(false);
      expect(runtime.crosshair.visible).toBe(true);
    },
  );
});

function createPane({
  inputLength = 14,
  key = 'subIndicator.rsi.pane',
  latestPaletteIndex = 0,
  latestValue = 50,
  lineWidth = 1,
}: {
  inputLength?: number;
  key?: string;
  latestPaletteIndex?: number | null;
  latestValue?: number | null;
  lineWidth?: number;
} = {}): ITradingViewNativeSubIndicatorRenderPane {
  return {
    bands: [
      {
        id: 'middle',
        key: `${key}.band.middle`,
        style: {
          color: '#666666',
          lineStyle: 'dashed',
          lineWidth: 1,
          transparency: 20,
          value: 50,
          visible: true,
        },
        title: 'Middle',
        zOrder: 1,
      },
    ],
    fills: [],
    format: { precision: 2, type: 'inherit' },
    indicator: 'RSI',
    inputValues: { length: inputLength, source: 'close' },
    instanceId: 'rsi',
    isVisible: true,
    key,
    scale: { kind: 'fixed', maxValue: 100, minValue: 0 },
    series: [
      {
        id: 'rsi',
        key: `${key}.series.rsi`,
        palette: {
          colors: ['#00ff00', '#ff0000'],
          indexes: [null, 1, latestPaletteIndex],
        },
        style: {
          baseline: 0,
          color: '#7c3aed',
          joinPoints: false,
          lineStyle: 'solid',
          lineWidth,
          transparency: 0,
          type: 'line',
          visible: true,
        },
        title: 'RSI',
        values: [null, 45, latestValue],
        zOrder: 2,
      },
    ],
    shortTitle: 'RSI',
    title: 'Relative Strength Index',
  };
}

function createPictureInput({
  panes,
  pointCount = 3,
  renderDataRevision = '1:identity',
}: {
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  pointCount?: number;
  renderDataRevision?: string;
}) {
  return {
    pointCount,
    renderDataRevision,
    structureKey: getTradingViewNativeSubIndicatorPanesStructureKey(panes),
  };
}

describe('TradingViewNativeChart point-derived data updates', () => {
  const previous = {
    pointCount: 100,
    renderDataRevision: '1:identity',
  };

  it('keeps the constant-time latest-point path for unchanged data semantics', () => {
    expect(
      shouldReplaceTradingViewNativeChartPoints({
        current: previous,
        previous,
      }),
    ).toBe(false);
  });

  it('fully replaces points and indicators after a point transform change', () => {
    const current = {
      ...previous,
      renderDataRevision: '1:heikinAshi',
    };
    expect(
      shouldReplaceTradingViewNativeChartPoints({ current, previous }),
    ).toBe(true);
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: {
          ...current,
          seriesKey: 'ma-1',
          settingsKey: 'ma-settings',
        },
        previous: {
          ...previous,
          seriesKey: 'ma-1',
          settingsKey: 'ma-settings',
        },
      }),
    ).toBe(true);

    const panes = [createPane()];
    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({
          panes,
          renderDataRevision: current.renderDataRevision,
        }),
        panes,
        previous: createPictureInput({
          panes,
          renderDataRevision: previous.renderDataRevision,
        }),
      }).replacementPanes,
    ).toBe(panes);
  });
});

describe('TradingViewNativeChart sub-indicator realtime updates', () => {
  it('transfers and applies only latest values for an unchanged structure', () => {
    const runtimePanes = [
      createPane({ latestPaletteIndex: 0, latestValue: 50 }),
    ];
    const currentPanes = [
      createPane({ latestPaletteIndex: 1, latestValue: 51 }),
    ];
    const update = getTradingViewNativeSubIndicatorPanesUpdate({
      current: createPictureInput({ panes: currentPanes }),
      panes: currentPanes,
      previous: createPictureInput({ panes: runtimePanes }),
    });

    expect(update.replacementPanes).toBeNull();
    expect(update.latestPaneValues).toEqual([
      {
        key: 'subIndicator.rsi.pane',
        series: [
          {
            key: 'subIndicator.rsi.pane.series.rsi',
            paletteIndex: 1,
            value: 51,
          },
        ],
      },
    ]);

    const previousValues = runtimePanes[0].series[0].values;
    const previousPaletteIndexes = runtimePanes[0].series[0].palette?.indexes;
    const nextPanes = applyTradingViewNativeSubIndicatorLatestPaneValues({
      hasLatestPoint: true,
      latestPaneValues: update.latestPaneValues,
      panes: runtimePanes,
    });
    expect(nextPanes).toBe(runtimePanes);
    expect(nextPanes[0].series[0].values).toBe(previousValues);
    expect(nextPanes[0].series[0].palette?.indexes).toBe(
      previousPaletteIndexes,
    );
    expect(nextPanes[0].series[0].values).toEqual([null, 45, 51]);
    expect(nextPanes[0].series[0].palette?.indexes).toEqual([null, 1, 1]);
  });

  it('fully replaces panes after a style or input change', () => {
    const previousPanes = [createPane()];
    const previous = createPictureInput({ panes: previousPanes });
    const styleChangedPanes = [createPane({ lineWidth: 2 })];
    const inputChangedPanes = [createPane({ inputLength: 21 })];

    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({ panes: styleChangedPanes }),
        panes: styleChangedPanes,
        previous,
      }).replacementPanes,
    ).toBe(styleChangedPanes);
    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({ panes: inputChangedPanes }),
        panes: inputChangedPanes,
        previous,
      }).replacementPanes,
    ).toBe(inputChangedPanes);
  });

  it('keeps runtime panes unchanged when pane keys do not match', () => {
    const runtimePanes = [createPane()];
    const latestPaneValues = [
      {
        key: 'subIndicator.other.pane',
        series: [
          {
            key: 'subIndicator.other.pane.series.rsi',
            paletteIndex: 1,
            value: 60,
          },
        ],
      },
    ];

    expect(
      applyTradingViewNativeSubIndicatorLatestPaneValues({
        hasLatestPoint: true,
        latestPaneValues,
        panes: runtimePanes,
      }),
    ).toBe(runtimePanes);
    expect(runtimePanes[0].series[0].values).toEqual([null, 45, 50]);
  });
});

describe('TradingViewNativeChart main-indicator updates', () => {
  const previous = {
    pointCount: 100,
    renderDataRevision: '1:identity',
    seriesKey: 'ma-1|ma-2',
    settingsKey: '{"MA":{"period":5}}',
  };

  it('replaces the full series when indicator settings change', () => {
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: {
          ...previous,
          settingsKey: '{"MA":{"period":7}}',
        },
        previous,
      }),
    ).toBe(true);
  });

  it('keeps the realtime latest-value update when settings are unchanged', () => {
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: previous,
        previous,
      }),
    ).toBe(false);
  });
});

describe('shouldHoldTradingViewNativeSubIndicatorResize', () => {
  const runtimeSize = { width: 402, height: 370 };

  it('holds a pane-sized canvas change until the panes arrive', () => {
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 426 },
        enabled: true,
        runtimeSize,
      }),
    ).toBe(true);
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 314 },
        enabled: true,
        runtimeSize,
      }),
    ).toBe(true);
  });

  it('follows the canvas for other size changes', () => {
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 400 },
        enabled: true,
        runtimeSize,
      }),
    ).toBe(false);
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 874, height: 426 },
        enabled: true,
        runtimeSize,
      }),
    ).toBe(false);
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 370 },
        enabled: true,
        runtimeSize,
      }),
    ).toBe(false);
  });

  it('follows the canvas when disabled or before the first measure', () => {
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 426 },
        enabled: false,
        runtimeSize,
      }),
    ).toBe(false);
    expect(
      shouldHoldTradingViewNativeSubIndicatorResize({
        canvasSize: { width: 402, height: 426 },
        enabled: true,
        runtimeSize: { width: 0, height: 0 },
      }),
    ).toBe(false);
  });
});
