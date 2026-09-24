import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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
      if (tool !== 'priceLabel')
        expect(labels[1].y - labels[0].y).toBeCloseTo(44);
      const point = { x: labels[0].x + 60, y: labels[0].y - 30 };
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
      if (DRAWING_TOOLS[tool].points === 3)
        item.points.push(screenToDrawingPoint({ x: 360, y: 280 }, chart));
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
