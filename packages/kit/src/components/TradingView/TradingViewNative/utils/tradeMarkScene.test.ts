import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { buildTradingViewNativeChartScene } from './chartScene';
import {
  appendTradingViewNativeTradeMarkCommands,
  getTradingViewNativeTradeMarkPointIndex,
} from './tradeMarkScene';

import type { ITradingViewNativeChartRuntimeCrosshair } from './chartRuntime';
import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaintStyle,
} from './chartScene';
import type { ITradingViewNativeTradeMark } from '../types';

const START = 1_700_000_000;
const POINTS: IMarketTokenKLineDataPoint[] = [
  { c: 101, h: 103, l: 98, o: 100, t: START, v: 10 },
  { c: 99, h: 102, l: 97, o: 101, t: START + 3600, v: 20 },
  { c: 104, h: 105, l: 98, o: 99, t: START + 10_800, v: 15 },
];

function renderMarks(
  marks: readonly ITradingViewNativeTradeMark[],
  crosshair: ITradingViewNativeChartRuntimeCrosshair = {
    visible: false,
    x: 0,
    y: 0,
  },
  points: readonly IMarketTokenKLineDataPoint[] = POINTS,
) {
  const commands: ITradingViewNativeChartSceneCommand[] = [];
  const customPaintStyles: Record<
    string,
    ITradingViewNativeChartScenePaintStyle
  > = {};
  const layouts = appendTradingViewNativeTradeMarkCommands({
    candleIntervalSeconds: 3600,
    commands,
    components: [{ id: 'trades', type: 'tradeMarks', props: { marks } }],
    crosshair,
    customPaintStyles,
    getPointX: (index) => 50 + index * 50,
    maxPrice: 120,
    measureTextWidth: (text) => text.length * 6,
    minPrice: 90,
    points,
    priceAxisX: 300,
    priceChartHeight: 500,
    priceScaleMode: 'linear',
    priceSource: 'ohlc',
  });
  return { commands, customPaintStyles, layouts };
}

describe('TradingViewNative trade marks', () => {
  it('matches seconds and milliseconds to the containing candle', () => {
    for (const timestamp of [START + 3601, (START + 3601) * 1000]) {
      expect(
        getTradingViewNativeTradeMarkPointIndex({
          candleIntervalSeconds: 3600,
          points: POINTS,
          timestamp,
        }),
      ).toBe(1);
    }
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: 3600,
        points: POINTS,
        timestamp: START + 3600,
      }),
    ).toBe(1);
  });

  it('omits trades outside loaded candles and in candle gaps', () => {
    for (const timestamp of [START - 1, START + 7200, START + 14_400, NaN]) {
      expect(
        getTradingViewNativeTradeMarkPointIndex({
          candleIntervalSeconds: 3600,
          points: POINTS,
          timestamp,
        }),
      ).toBeNull();
    }
  });

  it('uses calendar boundaries for monthly candles', () => {
    const points = [{ ...POINTS[0], t: Date.UTC(2024, 1, 1) / 1000 }];
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: 30 * 24 * 60 * 60,
        points,
        timestamp: Date.UTC(2024, 1, 29, 23, 59, 59) / 1000,
      }),
    ).toBe(0);
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: 30 * 24 * 60 * 60,
        points,
        timestamp: Date.UTC(2024, 2, 1) / 1000,
      }),
    ).toBeNull();
  });

  it('draws nothing without transaction marks', () => {
    expect(renderMarks([])).toEqual({
      commands: [],
      customPaintStyles: {},
      layouts: [],
    });
  });

  it('keeps the full fixed 30-day CoinGecko bucket across month boundaries', () => {
    const interval = 30 * 24 * 60 * 60;
    const first = { ...POINTS[0], t: 658 * interval };
    for (const points of [
      [first],
      [first, { ...POINTS[1], t: first.t + interval }],
    ]) {
      expect(
        getTradingViewNativeTradeMarkPointIndex({
          candleIntervalSeconds: interval,
          points,
          timestamp: Date.UTC(2024, 1, 10) / 1000,
        }),
      ).toBe(0);
    }
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: interval,
        points: [first],
        timestamp: first.t + interval,
      }),
    ).toBeNull();
  });

  it('includes the last day of a 31-day calendar candle without filling a missing month', () => {
    const points = [
      { ...POINTS[0], t: Date.UTC(2024, 2, 1) / 1000 },
      { ...POINTS[1], t: Date.UTC(2024, 4, 1) / 1000 },
    ];
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: 30 * 24 * 60 * 60,
        points,
        timestamp: Date.UTC(2024, 2, 31, 23, 59, 59) / 1000,
      }),
    ).toBe(0);
    expect(
      getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds: 30 * 24 * 60 * 60,
        points,
        timestamp: Date.UTC(2024, 3, 1) / 1000,
      }),
    ).toBeNull();
  });

  it('keeps bottom-edge marks and their tooltip inside the padded plot', () => {
    const points = [{ ...POINTS[0], c: 90, h: 90.01, l: 90, o: 90 }];
    const marks: ITradingViewNativeTradeMark[] = [
      { id: 'bottom', label: 'B', text: 'Buy 100 TOKEN', time: START },
    ];
    const initial = renderMarks(marks, undefined, points);
    expect(initial.layouts).toHaveLength(1);
    const { x, y } = initial.layouts[0];
    const hovered = renderMarks(marks, { visible: true, x, y }, points);
    expect(hovered.commands).toContainEqual(
      expect.objectContaining({ kind: 'text', text: 'Buy 100 TOKEN' }),
    );
    expect(y).toBeGreaterThan(500);
    expect(y + 7).toBeLessThan(524);
  });

  it.each(['line', 'area'] as const)(
    'anchors marks to the visible close in a %s chart with a large wick',
    (chartType) => {
      const scene = buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
        candleLabels: { open: 'O', high: 'H', low: 'L', close: 'C' },
        chartComponents: [
          {
            id: 'trades',
            type: 'tradeMarks',
            props: {
              marks: [{ id: 'buy', label: 'B', text: 'Buy', time: START }],
            },
          },
        ],
        chartType,
        crosshair: { visible: false, x: 0, y: 0 },
        hasVolume: false,
        height: 300,
        measureTextWidth: (text) => text.length * 6,
        points: POINTS.map((point) => ({ ...point, h: 1000 })),
        viewport: { offset: 0, zoomScale: 1 },
        watermarkOpacity: 0,
        width: 400,
      });
      expect(scene.commands).toContainEqual(
        expect.objectContaining({ kind: 'text', text: 'B' }),
      );
      expect(scene.autoPriceRange?.maxPrice).toBeLessThan(1000);
    },
  );

  it('deduplicates and stacks at most ten marks per candle', () => {
    const marks: ITradingViewNativeTradeMark[] = Array.from(
      { length: 11 },
      (_, index) => ({
        id: `trade-${index}`,
        label: index % 2 === 0 ? 'B' : 'S',
        text: `Trade ${index}`,
        time: START + 1,
      }),
    );
    const { commands, customPaintStyles, layouts } = renderMarks([
      marks[0],
      ...marks,
    ]);
    expect(layouts).toHaveLength(10);
    expect(layouts.map((layout) => layout.id)).toEqual(
      marks.slice(0, 10).map((mark) => mark.id),
    );
    expect(
      commands.filter((command) => command.kind === 'circle'),
    ).toHaveLength(10);
    layouts.slice(1).forEach((layout, index) => {
      expect(layout.x).toBe(layouts[index].x);
      expect(layout.y + 14).toBeLessThan(layouts[index].y);
    });
    expect(customPaintStyles['chart.tradeMarks.buy'].color).toBe('#26a69a');
    expect(customPaintStyles['chart.tradeMarks.sell'].color).toBe('#ef5350');
  });

  it('shows transaction text only when the crosshair reaches a mark', () => {
    const marks: ITradingViewNativeTradeMark[] = [
      { id: 'buy', label: 'B', text: 'Buy 100 TOKEN', time: START + 1 },
    ];
    const initial = renderMarks(marks);
    const { x, y } = initial.layouts[0];
    const hovered = renderMarks(marks, { visible: true, x, y });
    const hidden = renderMarks(marks, { visible: false, x, y });
    const tooltip = { kind: 'text', text: 'Buy 100 TOKEN' };
    expect(hovered.commands).toContainEqual(expect.objectContaining(tooltip));
    expect(initial.commands).not.toContainEqual(
      expect.objectContaining(tooltip),
    );
    expect(hidden.commands).not.toContainEqual(
      expect.objectContaining(tooltip),
    );
  });
});
