import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

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
    points: POINTS,
    priceAxisX: 300,
    priceChartHeight: 500,
    priceScaleMode: 'linear',
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
