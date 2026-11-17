import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getDefaultDrawingLevels } from '../../drawings/fibonacci';
import {
  getDrawingLabelBackground,
  getDrawingLabelLayout,
} from '../../drawings/labelLayout';
import {
  formatDrawingDuration,
  getDrawingMeasurement,
} from '../../drawings/measurement';
import { getTradingViewNativeChartLayout } from '../../utils/chartLayout';
import { createTradingViewNativeChartRuntimeState } from '../../utils/chartRuntime';

import { getDrawingGeometry, hitTestDrawings } from './geometry';
import {
  DEFAULT_DRAWING_STYLE,
  DRAWING_FONT_SIZES,
  DRAWING_TOOLS,
  changeDrawingHistory,
  constrainDrawingPoint,
  drawingPointToScreen,
  moveDrawing,
  parseDrawings,
  screenToDrawingPoint,
} from './model';

import type { IDrawing, IDrawingProjection, IDrawingTool } from './model';

const points = Array.from({ length: 50 }, (_, index) => ({
  t: 1_700_000_000 + index * 60,
  o: 100,
  h: 120,
  l: 90,
  c: 110,
  v: 10,
}));
function projection(
  mode: 'linear' | 'logarithmic' = 'linear',
): IDrawingProjection {
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds: 60,
    chartType: 'candlestick',
    hasVolume: false,
    height: 400,
    minimumTimeTickIndexSpacing: 1,
    points,
    priceAxisWidth: 70,
    priceRangeScale: 1,
    priceScaleMode: mode,
    visiblePointRange: { startIndex: 0, endIndex: points.length },
    width: 800,
  });
  if (!layout) throw new OneKeyLocalError('Missing chart layout');
  return {
    layout,
    interval: 60,
    points,
    viewport: createTradingViewNativeChartRuntimeState({}).viewport,
  };
}
function drawing(tool: IDrawingTool = 'trend', chart = projection()): IDrawing {
  return {
    ...DEFAULT_DRAWING_STYLE,
    id: 'test',
    tool,
    locked: false,
    points: [
      { x: 250, y: 220 },
      { x: 450, y: 120 },
    ].map((point) => screenToDrawingPoint(point, chart)),
  };
}

describe('web chart drawings', () => {
  it('restores every supported font size and keeps legacy text drawings readable', () => {
    const text = { ...drawing('text'), text: 'ASTER' };
    for (const fontSize of DRAWING_FONT_SIZES) {
      const item = { ...text, fontSize };
      expect(parseDrawings(JSON.stringify([item]))).toEqual([item]);
    }
    const legacy = { ...text, fontSize: undefined };
    const [restored] = parseDrawings(JSON.stringify([legacy]));
    expect(getDrawingGeometry(restored, projection()).labels[0].fontSize).toBe(
      12,
    );
    for (const fontSize of [0, -1, 1000, 12.5, '40', null]) {
      expect(parseDrawings(JSON.stringify([{ ...text, fontSize }]))).toEqual(
        [],
      );
    }
  });
  it.each(['text', 'callout', 'priceLabel'] as const)(
    'expands %s selection bounds and line spacing with the font size',
    (tool) => {
      const chart = projection();
      const item = {
        ...drawing(tool, chart),
        text: 'ASTER\nsupport',
        fontSize: 40,
      };
      const { labels } = getDrawingGeometry(item, chart);
      expect(labels[0].fontSize).toBe(40);
      const layout = getDrawingLabelLayout(labels[0], chart);
      expect(layout.lineHeight).toBe(44);
      if (tool !== 'priceLabel')
        expect(layout.lines).toEqual(['ASTER', 'support']);
      const point = {
        x: labels[0].x + 60,
        y: labels[0].y + (tool === 'priceLabel' ? -38 : 30),
      };
      expect(hitTestDrawings([item], point, chart, null)?.drawing.id).toBe(
        item.id,
      );
      expect(
        hitTestDrawings([{ ...item, fontSize: 12 }], point, chart, null),
      ).toBeNull();
    },
  );
  it.each(Object.keys(DRAWING_TOOLS) as IDrawingTool[])(
    'keeps %s geometry finite and its stored anchors editable',
    (tool) => {
      const chart = projection();
      const item = drawing(tool, chart);
      if (DRAWING_TOOLS[tool].points === 1)
        item.points = item.points.slice(0, 1);
      while (item.points.length < DRAWING_TOOLS[tool].points)
        item.points.push(
          screenToDrawingPoint(
            {
              x: 300 + item.points.length * 30,
              y: item.points.length % 2 ? 100 : 280,
            },
            chart,
          ),
        );
      const geometry = getDrawingGeometry(item, chart);
      expect(geometry.paths.length + geometry.labels.length).toBeGreaterThan(0);
      expect(
        geometry.paths
          .flatMap((path) => path.points)
          .every(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          ),
      ).toBe(true);
      expect(parseDrawings(JSON.stringify([item]))).toEqual([item]);
      const moved = moveDrawing(item, { x: 10, y: 15 }, chart, null, false);
      expect(moved.points[0]).not.toEqual(item.points[0]);
    },
  );
  it('excludes hidden objects from selection and preserves their metadata when restoring', () => {
    const chart = projection();
    const hidden = { ...drawing(), hidden: true, name: 'Support' };
    expect(
      hitTestDrawings([hidden], { x: 250, y: 220 }, chart, hidden.id),
    ).toBeNull();
    expect(parseDrawings(JSON.stringify([hidden]))).toEqual([hidden]);
    expect(
      parseDrawings(JSON.stringify([{ ...hidden, hidden: 'true' }])),
    ).toEqual([]);
  });
  it('renders a falling ruler with directional arrows and three lines of statistics', () => {
    const chart = { ...projection(), priceDecimalPlaces: 2 };
    const ruler: IDrawing = {
      ...drawing('measure', chart),
      points: [
        { time: points[5].t, price: 110 },
        { time: points[15].t, price: 100 },
      ],
    };
    const stats = getDrawingMeasurement(ruler, chart);
    expect(stats).toMatchObject({
      delta: -10,
      bars: 10,
      volume: 110,
      priceText: '−10.00 (−9.09%) −1,000',
      timeText: '10 bars, 10m',
      volumeText: 'Vol 110',
    });
    const geometry = getDrawingGeometry(ruler, chart);
    expect(geometry.handles).toEqual([]);
    expect(geometry.paths[0]).toMatchObject({
      color: '#F7525F',
      fill: true,
      stroke: false,
    });
    expect(
      geometry.paths.filter((path) => path.points.length === 3),
    ).toHaveLength(2);
    expect(geometry.labels[0]).toMatchObject({
      text: `${stats.priceText}\n${stats.timeText}\n${stats.volumeText}`,
      background: '#F7525F',
      color: '#FFFFFF',
      verticalAlign: 'top',
      radius: 4,
    });
    const upward = getDrawingGeometry(
      { ...ruler, points: [...ruler.points].toReversed() },
      chart,
    );
    expect(upward.labels[0]).toMatchObject({
      background: '#2962FF',
      verticalAlign: 'bottom',
    });
  });
  it('counts actual bars across missing candles and excludes unavailable volume in future space', () => {
    const chart = projection();
    chart.points = [
      points[0],
      { ...points[1], v: Number.NaN },
      { ...points[2], t: points[0].t + 3600, v: 30 },
    ];
    const range = {
      ...drawing('dateRange'),
      points: [
        { time: chart.points[0].t, price: 100 },
        { time: chart.points[2].t, price: 110 },
      ],
    };
    expect(getDrawingMeasurement(range, chart)).toMatchObject({
      bars: 2,
      volume: 40,
      timeText: '2 bars, 1h',
    });
    range.points[1].time += 120;
    expect(getDrawingMeasurement(range, chart)).toMatchObject({
      bars: 4,
      volume: 40,
      timeText: '4 bars, 1h 2m',
    });
    expect(formatDrawingDuration(102_600)).toBe('1d 4h 30m');
    expect(formatDrawingDuration(-3660)).toBe('−1h 1m');
  });
  it('renders Fibonacci bands and configurable ratios, prices and extensions', () => {
    const chart = projection();
    const fib = drawing('fib', chart);
    const geometry = getDrawingGeometry(fib, chart);
    expect(geometry.paths.filter((path) => path.fill)).toHaveLength(10);
    expect(geometry.labels.map((label) => label.text.split(' ')[0])).toEqual([
      '0',
      '0.236',
      '0.382',
      '0.5',
      '0.618',
      '0.786',
      '1',
      '1.618',
      '2.618',
      '3.618',
      '4.236',
    ]);
    const configured = getDrawingGeometry(
      {
        ...fib,
        levels: [
          { value: 0.5, color: '#112233', visible: true },
          { value: 1, color: '#445566', visible: false },
        ],
        showPrices: false,
        showBackground: false,
        extendLeft: true,
        extendRight: true,
      },
      chart,
    );
    expect(configured.labels).toHaveLength(1);
    expect(configured.labels[0]).toMatchObject({
      text: '0.5',
      color: '#112233',
    });
    expect(configured.paths[0].points).toEqual([
      { x: 0, y: expect.any(Number) },
      { x: chart.layout.priceAxisX, y: expect.any(Number) },
    ]);
    expect(configured.paths.some((path) => path.fill)).toBe(false);
    const reversed = getDrawingGeometry({ ...fib, reverse: true }, chart);
    expect(reversed.labels[0].y).toBeCloseTo(geometry.labels[6].y);
  });
  it('keeps custom Fibonacci styles on reload and rejects malformed settings', () => {
    const fib = {
      ...drawing('fib'),
      fillOpacity: 0.3,
      showPrices: false,
      extendRight: true,
      levels: getDefaultDrawingLevels('fib'),
    };
    expect(parseDrawings(JSON.stringify([fib]))).toEqual([fib]);
    for (const patch of [
      { fillOpacity: 2 },
      { showPrices: 'false' },
      { levels: [{ value: '1', color: '#112233', visible: true }] },
      { levels: [{ value: 1, color: 'invalid', visible: true }] },
    ])
      expect(parseDrawings(JSON.stringify([{ ...fib, ...patch }]))).toEqual([]);
  });
  it('connects callout and price-label bubbles to their anchors with a filled pointer', () => {
    const chart = projection();
    for (const tool of ['callout', 'priceLabel'] as const) {
      const item = drawing(tool, chart);
      const geometry = getDrawingGeometry(item, chart);
      expect(geometry.paths).toEqual([]);
      const label = geometry.labels[0];
      expect(label).toMatchObject({
        color: '#FFFFFF',
        background: item.color,
        pointer: drawingPointToScreen(item.points[0], chart),
      });
      expect(
        getDrawingLabelBackground(label, getDrawingLabelLayout(label, chart)),
      ).toContainEqual(label.pointer);
    }
  });
  it.each([
    'rectangle',
    'ellipse',
    'priceRange',
    'dateRange',
    'datePriceRange',
  ] as const)('resizes all four %s corners', (tool) => {
    const chart = projection();
    const item = drawing(tool, chart);
    for (let handle = 0; handle < 4; handle += 1) {
      const before = getDrawingGeometry(item, chart).handles;
      const moved = getDrawingGeometry(
        moveDrawing(item, { x: 20, y: 10 }, chart, handle, false),
        chart,
      ).handles;
      expect(moved[handle].x - before[handle].x).toBeCloseTo(20);
      expect(moved[handle].y - before[handle].y).toBeCloseTo(10);
    }
  });
  it('resizes a freehand stroke from four bounding handles without exposing its sampled points', () => {
    const chart = projection();
    const brush = drawing('brush', chart);
    brush.points.push(screenToDrawingPoint({ x: 300, y: 160 }, chart));
    const geometry = getDrawingGeometry(brush, chart);
    expect(geometry.handles).toHaveLength(4);
    const resized = moveDrawing(brush, { x: 40, y: -30 }, chart, 1, false);
    const next = getDrawingGeometry(resized, chart);
    expect(next.handles[1].x - geometry.handles[1].x).toBeCloseTo(40);
    expect(next.handles[1].y - geometry.handles[1].y).toBeCloseTo(-30);
    expect(next.handles[3].x).toBeCloseTo(geometry.handles[3].x);
    expect(next.handles[3].y).toBeCloseTo(geometry.handles[3].y);
  });
  it('constrains lines to 45 degree increments and shapes to square bounds', () => {
    const start = { x: 100, y: 100 };
    const line = constrainDrawingPoint(start, { x: 180, y: 170 }, 'trend');
    expect(line.x - start.x).toBeCloseTo(line.y - start.y);
    expect(
      constrainDrawingPoint(start, { x: 180, y: 170 }, 'rectangle'),
    ).toEqual({ x: 180, y: 180 });
  });
  it('selects filled shapes through their interior and edits all four rectangle corners', () => {
    const chart = projection();
    const rectangle = drawing('rectangle');
    expect(
      hitTestDrawings([rectangle], { x: 300, y: 150 }, chart, null)?.drawing.id,
    ).toBe(rectangle.id);
    const geometry = getDrawingGeometry(rectangle, chart);
    expect(geometry.handles).toHaveLength(4);
    const edited = moveDrawing(rectangle, { x: 30, y: 20 }, chart, 2, false);
    const nextGeometry = getDrawingGeometry(edited, chart);
    expect(nextGeometry.handles[2].x - geometry.handles[2].x).toBeCloseTo(30);
    expect(nextGeometry.handles[2].y - geometry.handles[2].y).toBeCloseTo(20);
    expect(nextGeometry.handles[3]).toEqual(geometry.handles[3]);
  });
  it.each(['linear', 'logarithmic'] as const)(
    'round trips time and price in %s scale, including future space',
    (mode) => {
      const chart = projection(mode);
      for (const point of [
        { x: 200, y: 40 },
        { x: 780, y: 250 },
      ]) {
        const actual = drawingPointToScreen(
          screenToDrawingPoint(point, chart),
          chart,
        );
        expect(actual.x).toBeCloseTo(point.x, 5);
        expect(actual.y).toBeCloseTo(point.y, 5);
      }
    },
  );
  it('retains the time anchor when history is prepended and a candle arrives', () => {
    const chart = projection();
    const anchor = { time: points[25].t, price: 110 };
    const previous = drawingPointToScreen(anchor, chart);
    const updated = {
      ...chart,
      points: [
        { ...points[0], t: points[0].t - 60 },
        ...points,
        { ...points[49], t: points[49].t + 60 },
      ],
    };
    const step =
      drawingPointToScreen({ ...anchor, time: anchor.time + 60 }, chart).x -
      previous.x;
    expect(drawingPointToScreen(anchor, updated).x).toBeCloseTo(
      previous.x - step,
    );
    expect(drawingPointToScreen(anchor, updated).y).toBe(previous.y);
  });
  it('interpolates through missing candles without assuming equally spaced timestamps', () => {
    const chart = projection();
    chart.points = [points[0], points[1], points[10]];
    const anchor = { time: points[5].t, price: 105 };
    expect(
      screenToDrawingPoint(drawingPointToScreen(anchor, chart), chart).time,
    ).toBeCloseTo(anchor.time);
  });
  it('reprojects stored anchors when changing interval, pan and zoom', () => {
    const chart = projection();
    const anchor = { time: points[20].t, price: 105 };
    const updated = {
      ...chart,
      interval: 300,
      points: points.filter((_, index) => index % 5 === 0),
      viewport: { ...chart.viewport, zoomScale: 2, offset: 30 },
    };
    const screen = drawingPointToScreen(anchor, updated);
    const restored = screenToDrawingPoint(screen, updated);
    expect(restored.time).toBeCloseTo(anchor.time);
    expect(restored.price).toBeCloseTo(anchor.price);
    expect(screen.x).not.toBe(drawingPointToScreen(anchor, chart).x);
  });
  it('snaps anchors to candle time and the nearest OHLC price', () => {
    const chart = projection();
    const screen = drawingPointToScreen(
      { time: points[25].t, price: 119 },
      chart,
    );
    expect(screenToDrawingPoint(screen, chart, true)).toEqual({
      time: points[25].t,
      price: 120,
    });
  });
  it('extends rays only in the direction of the second anchor', () => {
    const chart = projection();
    const ray = getDrawingGeometry(drawing('ray'), chart).paths[0].points;
    expect(ray[0].x).toBeCloseTo(250);
    expect(ray[1].x).toBeGreaterThan(450);
    const reversed = drawing('ray');
    reversed.points.reverse();
    const reverseRay = getDrawingGeometry(reversed, chart).paths[0].points;
    expect(reverseRay[0].x).toBeCloseTo(450);
    expect(reverseRay[1].x).toBeLessThan(250);
  });
  it('clips extended vertical lines without infinite or NaN coordinates', () => {
    const chart = projection();
    const line = drawing('extended');
    line.points[1].time = line.points[0].time;
    const path = getDrawingGeometry(line, chart).paths[0].points;
    expect(path).toHaveLength(2);
    expect(
      path.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    ).toBe(true);
    expect(Math.abs(path[1].y - path[0].y)).toBe(chart.layout.mainChartBottom);
  });
  it('prioritizes selected handles and never selects an unrelated empty area', () => {
    const chart = projection();
    const line = drawing();
    const overlapping = { ...line, id: 'top' };
    expect(
      hitTestDrawings([line, overlapping], { x: 250, y: 220 }, chart, line.id)
        ?.handle,
    ).toBe(0);
    expect(
      hitTestDrawings([line], { x: 350, y: 170 }, chart, null)?.drawing.id,
    ).toBe(line.id);
    expect(hitTestDrawings([line], { x: 50, y: 50 }, chart, null)).toBeNull();
  });
  it('moves one handle independently and translates a whole drawing in log scale', () => {
    const chart = projection('logarithmic');
    const line = drawing('trend', chart);
    const edited = moveDrawing(line, { x: 30, y: 20 }, chart, 0, false);
    expect(edited.points[1]).toEqual(line.points[1]);
    const translated = moveDrawing(line, { x: 30, y: 20 }, chart, null, false);
    for (let i = 0; i < 2; i += 1) {
      const before = drawingPointToScreen(line.points[i], chart);
      const after = drawingPointToScreen(translated.points[i], chart);
      expect(after.x - before.x).toBeCloseTo(30);
      expect(after.y - before.y).toBeCloseTo(20);
    }
  });
  it('restores complete drawing data and rejects corrupt local records', () => {
    const line = {
      ...drawing(),
      locked: true,
      color: '#ff0000',
      dash: 'dashed' as const,
    };
    expect(parseDrawings(JSON.stringify([line]))).toEqual([line]);
    expect(parseDrawings('{')).toEqual([]);
    expect(
      parseDrawings(
        JSON.stringify([
          null,
          { ...line, tool: '__proto__' },
          { ...line, points: [{ price: 'bad' }] },
          line,
          line,
        ]),
      ),
    ).toEqual([line]);
  });
  it('undoes deletion and style changes and clears the redo branch after a new edit', () => {
    const original = drawing();
    const added = changeDrawingHistory({ past: [], present: [], future: [] }, [
      original,
    ]);
    const styled = changeDrawingHistory(added, [{ ...original, width: 3 }]);
    const removed = changeDrawingHistory(styled, []);
    const restored = changeDrawingHistory(removed, 'undo');
    expect(restored.present[0].width).toBe(3);
    expect(changeDrawingHistory(restored, 'redo').present).toEqual([]);
    const branched = changeDrawingHistory(restored, [
      { ...original, width: 4 },
    ]);
    expect(branched.future).toEqual([]);
    expect(changeDrawingHistory(branched, 'undo').present[0].width).toBe(3);
  });
});
