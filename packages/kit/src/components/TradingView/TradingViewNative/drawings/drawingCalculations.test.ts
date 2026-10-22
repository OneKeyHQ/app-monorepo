import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getTradingViewNativeChartLayout } from '../utils/chartLayout';
import { createTradingViewNativeChartRuntimeState } from '../utils/chartRuntime';

import { getDrawingAxisGeometry } from './axisGeometry';
import { createDrawingHistoryLoader } from './drawingHistory';
import { getDrawingGeometry } from './geometry';
import { getGhostFeedCandles } from './ghostFeed';
import {
  DEFAULT_DRAWING_STYLE,
  moveDrawing,
  parseDrawings,
  screenToDrawingPoint,
} from './model';
import {
  getPositionStatistics,
  getVolumeProfile,
  prepareDrawing,
} from './projectionGeometry';

import type { IDrawing, IDrawingProjection, IDrawingTool } from './model';
import type { ITradingViewNativeHistoryDataProvider } from '../data/providers/types';

const points = Array.from({ length: 20 }, (_, index) => ({
  t: 1_700_000_040 + index * 60,
  o: 100 + index,
  h: 102 + index,
  l: 99 + index,
  c: 101 + index,
  v: 10 * (index + 1),
}));
function projection(): IDrawingProjection {
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds: 60,
    chartType: 'candlestick',
    hasVolume: false,
    height: 400,
    width: 800,
    minimumTimeTickIndexSpacing: 1,
    points,
    priceAxisWidth: 70,
    priceRangeScale: 1,
    priceScaleMode: 'linear',
    visiblePointRange: { startIndex: 0, endIndex: points.length },
  });
  if (!layout) throw new OneKeyLocalError('Missing test layout');
  return {
    layout,
    points,
    interval: 60,
    viewport: createTradingViewNativeChartRuntimeState({}).viewport,
    priceDecimalPlaces: 2,
    size: { width: 800, height: 400 },
  };
}
function drawing(tool: IDrawingTool, chart = projection()): IDrawing {
  return {
    ...DEFAULT_DRAWING_STYLE,
    id: tool,
    tool,
    locked: false,
    points: [
      { x: 250, y: 220 },
      { x: 450, y: 120 },
      { x: 350, y: 280 },
    ].map((point) => screenToDrawingPoint(point, chart)),
  };
}

it('sizes positions by stop risk and resolves an ambiguous candle conservatively', () => {
  const chart = projection();
  const position: IDrawing = {
    ...drawing('longPosition'),
    accountSize: 1000,
    riskPercent: 2,
    points: [
      { time: points[0].t, price: 100 },
      { time: points[4].t, price: 110 },
      { time: points[0].t, price: 95 },
    ],
  };
  expect(getPositionStatistics(position, chart)).toMatchObject({
    quantity: 4,
    riskAmount: 20,
    ratio: 2,
    closed: false,
    pnl: 20,
  });
  const both = { ...chart, points: [{ ...points[0], h: 115, l: 90 }] };
  expect(getPositionStatistics(position, both)).toMatchObject({
    closed: true,
    pnl: -20,
  });
  const prepared = prepareDrawing(
    { ...position, points: position.points.slice(0, 1) },
    chart,
  );
  expect(prepared.points).toHaveLength(3);
  expect(prepared.points[1].price).toBeGreaterThan(prepared.points[0].price);
  expect(prepared.points[2].price).toBeLessThan(prepared.points[0].price);
  const resized = moveDrawing(prepared, { x: 0, y: -1000 }, chart, 3, false);
  expect(resized.points[2].price).toBeLessThan(resized.points[0].price);
  expect(resized.points[1]).toEqual(prepared.points[1]);
});

it('conserves up and down volume across bins, including flat candles and invalid volume', () => {
  const bins = getVolumeProfile(
    [
      { ...points[0], o: 1, c: 3, h: 4, l: 0, v: 80 },
      { ...points[1], o: 3, c: 1, h: 4, l: 0, v: 40 },
      { ...points[2], o: 2, c: 2, h: 2, l: 2, v: 10 },
      { ...points[3], v: -100 },
    ],
    4,
  );
  expect(bins).toHaveLength(4);
  expect(bins?.reduce((sum, bin) => sum + bin.up, 0)).toBeCloseTo(80);
  expect(bins?.reduce((sum, bin) => sum + bin.down, 0)).toBeCloseTo(50);
  expect(bins?.[2]).toMatchObject({ low: 2, high: 3, up: 20, down: 20 });
});

it.each([
  { tool: 'longPosition', direction: 1 },
  { tool: 'shortPosition', direction: -1 },
] as const)(
  'waits for entry candles before reporting $tool profit or loss',
  ({ tool, direction }) => {
    const chart = projection();
    const latestTime = points[points.length - 1].t;
    const entryTime = latestTime + chart.interval / 4;
    const position: IDrawing = {
      ...drawing(tool),
      accountSize: 1000,
      riskPercent: 2,
      points: [
        { time: entryTime, price: 150 },
        { time: entryTime + 600, price: 150 + direction * 20 },
        { time: entryTime, price: 150 - direction * 20 },
      ],
    };
    expect(getPositionStatistics(position, chart)).toMatchObject({
      pnl: 0,
      closed: false,
    });
    expect(
      getPositionStatistics(position, {
        ...chart,
        points: [
          ...points,
          {
            t: latestTime + chart.interval,
            o: 150,
            h: 152,
            l: 148,
            c: 150 + direction,
            v: 100,
          },
        ],
      }),
    ).toMatchObject({ pnl: 1, closed: false });
  },
);

it('renders all nine default Gann fan rays with finite labels and coordinates', () => {
  const geometry = getDrawingGeometry(drawing('gannFan'), projection());
  const rays = geometry.paths.filter((path) => path.stroke !== false);
  expect(rays).toHaveLength(9);
  expect(geometry.labels).toHaveLength(9);
  expect(new Set(geometry.labels.map((label) => label.text)).size).toBe(9);
  expect(geometry.labels.map((label) => label.text)).toEqual(
    expect.arrayContaining(['1/8', '1/1', '8/1']),
  );
  expect(geometry.labels.some((label) => /Infinity|NaN/.test(label.text))).toBe(
    false,
  );
  for (const ray of rays)
    for (const point of ray.points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
});

it('anchors VWAP to the selected bar and weights typical price by volume', () => {
  const chart = projection();
  const item = {
    ...drawing('anchoredVwap'),
    points: [{ time: points[5].t, price: 999 }],
  };
  const path = getDrawingGeometry(item, chart).paths[0].points;
  expect(path).toHaveLength(15);
  const first = (points[5].h + points[5].l + points[5].c) / 3;
  const second = (points[6].h + points[6].l + points[6].c) / 3;
  expect(screenToDrawingPoint(path[0], chart).price).toBeCloseTo(first);
  expect(screenToDrawingPoint(path[1], chart).price).toBeCloseTo(
    (first * 60 + second * 70) / 130,
  );
});

it('fits a linear price series independently of anchor prices', () => {
  const chart = projection();
  const item = {
    ...drawing('regression'),
    points: [
      { time: points[2].t, price: 999 },
      { time: points[8].t, price: -999 },
    ],
  };
  const geometry = getDrawingGeometry(item, chart);
  const median = geometry.paths.find((path) => path.dashed);
  expect(median?.points).toHaveLength(2);
  expect(screenToDrawingPoint(median!.points[0], chart).price).toBeCloseTo(103);
  expect(screenToDrawingPoint(median!.points[1], chart).price).toBeCloseTo(109);
  expect(geometry.handles).toEqual(median?.points);
});

it('exposes six parallel-channel handles and keeps both boundaries parallel while resizing', () => {
  const chart = projection();
  const item = drawing('channel', chart);
  const before = getDrawingGeometry(item, chart).handles;
  expect(before).toHaveLength(6);
  const changed = moveDrawing(item, { x: 0, y: 30 }, chart, 5, false);
  const after = getDrawingGeometry(changed, chart).handles;
  expect(after[0].y).toBeCloseTo(before[0].y);
  expect(after[2].y).toBeCloseTo(before[2].y + 30);
  expect(after[3].y - after[2].y).toBeCloseTo(after[1].y - after[0].y);
});

it('draws projection as a circular sector and keeps its third handle on the arc', () => {
  const chart = projection();
  const item = drawing('projection', chart);
  const geometry = getDrawingGeometry(item, chart);
  const [center, second, third] = geometry.handles;
  const radius = Math.hypot(second.x - center.x, second.y - center.y);
  expect(Math.hypot(third.x - center.x, third.y - center.y)).toBeCloseTo(
    radius,
  );
  expect(geometry.paths[0].fill).toBe(true);
  for (const point of geometry.paths[0].points.slice(1, -1))
    expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(
      radius,
    );
});

it('keeps ghost candles stable across zoom and timeframe changes and applies tick-based range', () => {
  const chart = projection();
  const item = prepareDrawing(
    {
      ...drawing('ghostFeed'),
      points: [
        { time: points[0].t, price: 110 },
        { time: points[10].t, price: 120 },
      ],
      candleRange: 100,
      candleVariance: 0,
    },
    chart,
  );
  const candles = getGhostFeedCandles(item, chart);
  expect(candles).toHaveLength(10);
  const changed = {
    ...chart,
    interval: 300,
    layout: {
      ...chart.layout,
      priceChartHeight: chart.layout.priceChartHeight * 2,
    },
    viewport: { ...chart.viewport, zoomScale: chart.viewport.zoomScale * 2 },
  };
  expect(getGhostFeedCandles(item, changed)).toEqual(candles);
  for (const candle of candles) {
    expect(candle.h - candle.l).toBeGreaterThanOrEqual(0.75);
    expect(candle.h - candle.l).toBeLessThanOrEqual(1.25);
    expect(candle.h).toBeGreaterThanOrEqual(Math.max(candle.o, candle.c));
    expect(candle.l).toBeLessThanOrEqual(Math.min(candle.o, candle.c));
  }
  expect(parseDrawings(JSON.stringify([item]))).toEqual([item]);
});

it('keeps anchored text fixed during pan, and persists a copied bars pattern', () => {
  const chart = projection();
  const text = prepareDrawing(
    { ...drawing('anchoredText'), points: [{ time: points[3].t, price: 110 }] },
    chart,
  );
  const panned = {
    ...chart,
    viewport: { ...chart.viewport, offset: chart.viewport.offset + 200 },
  };
  expect(getDrawingGeometry(text, panned).labels).toEqual(
    getDrawingGeometry(text, chart).labels,
  );
  const pattern = prepareDrawing(
    {
      ...drawing('barsPattern'),
      points: [
        { time: points[2].t, price: 110 },
        { time: points[5].t, price: 110 },
      ],
    },
    chart,
  );
  expect(pattern.source).toEqual(points.slice(2, 6));
  expect(parseDrawings(JSON.stringify([pattern]))).toEqual([pattern]);
  expect(
    getDrawingGeometry(pattern, {
      ...chart,
      points: chart.points.map((point) => ({ ...point, c: 1000 })),
    }).paths,
  ).toEqual(getDrawingGeometry(pattern, chart).paths);
});

it('highlights ruler time and price axes without leaving the canvas', () => {
  const chart = projection();
  const item = {
    ...drawing('measure'),
    points: drawing('measure').points.slice(0, 2),
  };
  const axes = getDrawingAxisGeometry(
    { drawings: [item], selectedId: null, selectedIds: [] },
    chart,
  );
  expect(axes.labels).toHaveLength(4);
  expect(axes.rectangles.filter((rect) => rect.opacity < 1)).toHaveLength(2);
  for (const rect of axes.rectangles) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(800);
    expect(rect.y + rect.height).toBeLessThanOrEqual(400);
  }
  const geometry = getDrawingAxisGeometry(
    { drawings: [item], selectedId: null, selectedIds: [] },
    { ...chart, showPriceAxis: false },
  );
  expect(geometry.labels).toHaveLength(2);
});

it('discards transient volume results and rejects out-of-range persisted settings', () => {
  const item = drawing('volumeProfile');
  const [restored] = parseDrawings(
    JSON.stringify([{ ...item, volumeProfile: { bins: 'invalid' } }]),
  );
  expect(restored).toEqual(item);
  for (const patch of [
    { profileRows: 0 },
    { profileRows: 101 },
    { valueAreaPercent: 150 },
    { riskPercent: 101 },
    { sourceInterval: 0 },
  ])
    expect(parseDrawings(JSON.stringify([{ ...item, ...patch }]))).toEqual([]);
});

it('paginates finer candle history without duplicating boundary candles', async () => {
  const fetchHistory: jest.MockedFunction<
    ITradingViewNativeHistoryDataProvider['fetchHistory']
  > = jest
    .fn()
    .mockResolvedValueOnce({ points: points.slice(10), total: 10 })
    .mockResolvedValueOnce({ points: points.slice(0, 11), total: 11 });
  const provider: ITradingViewNativeHistoryDataProvider = {
    fetchHistory,
    hasMoreHistory: () => true,
    getHistoryRequestCandleCount: () => 10,
  };
  const data = await createDrawingHistoryLoader(provider)(
    points[0].t,
    points[19].t,
    new AbortController().signal,
  );
  expect(data?.points).toEqual(points);
  expect(data?.interval).toBe(60);
  expect(fetchHistory).toHaveBeenCalledTimes(2);
  expect(fetchHistory.mock.calls[1][0].timeTo).toBe(points[10].t - 1);
});

it('ignores a history response that finishes after cancellation', async () => {
  const abort = new AbortController();
  const provider: ITradingViewNativeHistoryDataProvider = {
    fetchHistory: async () => {
      abort.abort();
      return { points, total: points.length };
    },
    hasMoreHistory: () => true,
    getHistoryRequestCandleCount: () => 100,
  };
  await expect(
    createDrawingHistoryLoader(provider)(
      points[0].t,
      points[19].t,
      abort.signal,
    ),
  ).resolves.toBeNull();
});

it('keeps chart candles when a profile would require coarser history', async () => {
  const fetchHistory: jest.MockedFunction<
    ITradingViewNativeHistoryDataProvider['fetchHistory']
  > = jest.fn().mockResolvedValue({
    points: [{ ...points[0], t: Math.floor(points[0].t / 300) * 300 }],
    total: 1,
  });
  const provider: ITradingViewNativeHistoryDataProvider = {
    fetchHistory,
    hasMoreHistory: () => true,
    getHistoryRequestCandleCount: () => 1000,
  };
  const from = points[0].t;
  const to = from + 5000 * 60;
  await expect(
    createDrawingHistoryLoader(provider, undefined, 60)(
      from,
      to,
      new AbortController().signal,
    ),
  ).resolves.toBeNull();
  expect(fetchHistory).not.toHaveBeenCalled();

  const data = await createDrawingHistoryLoader(provider, undefined, 3600)(
    from,
    to,
    new AbortController().signal,
  );
  expect(data?.interval).toBe(300);
  expect(fetchHistory).toHaveBeenCalledTimes(1);
});

it('separates crowded axis labels and limits long paths to endpoint labels', () => {
  const chart = projection();
  const item = drawing('channel');
  const state = {
    drawings: [item],
    selectedId: item.id,
    selectedIds: [item.id],
  };
  const geometry = getDrawingAxisGeometry(state, chart);
  const timeLabels = geometry.rectangles
    .filter((rect) => rect.opacity === 1 && rect.y === chart.layout.timeAxisY)
    .toSorted((a, b) => a.x - b.x);
  for (let index = 1; index < timeLabels.length; index += 1)
    expect(timeLabels[index].x).toBeGreaterThanOrEqual(
      timeLabels[index - 1].x + timeLabels[index - 1].width,
    );
  const path = {
    ...item,
    tool: 'polyline' as const,
    points: Array.from({ length: 1000 }, (_, index) =>
      screenToDrawingPoint({ x: 100 + index / 2, y: 200 }, chart),
    ),
  };
  expect(
    getDrawingAxisGeometry({ ...state, drawings: [path] }, chart).labels.length,
  ).toBeLessThanOrEqual(4);
});
