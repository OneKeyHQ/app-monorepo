// cspell:ignore Alphaf Skia XYWH
import { DEFAULT_DRAWING_STYLE, screenToDrawingPoint } from '../drawings/model';
import { getTradingViewNativeChartLayout } from '../utils/chartLayout';
import { createTradingViewNativeChartRuntimeState } from '../utils/chartRuntime';

import { drawNativeChartDrawings } from './chartDrawingRenderer';

import type { IDrawingProjection } from '../drawings/model';
import type { SkCanvas, SkFont } from '@shopify/react-native-skia';

const mockPaint = {
  setAntiAlias: jest.fn(),
  setStrokeCap: jest.fn(),
  setStrokeJoin: jest.fn(),
  setColor: jest.fn(),
  setPathEffect: jest.fn(),
  setStyle: jest.fn(),
  setAlphaf: jest.fn(),
  setStrokeWidth: jest.fn(),
  dispose: jest.fn(),
};
const mockPath = {
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  close: jest.fn(),
  dispose: jest.fn(),
};
jest.mock('@shopify/react-native-skia', () => ({
  ClipOp: { Intersect: 0 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  StrokeCap: { Round: 1 },
  StrokeJoin: { Round: 1 },
  Skia: {
    Paint: () => mockPaint,
    Color: (color: string) => color,
    Path: { Make: () => mockPath },
    PathEffect: { MakeDash: () => ({ dispose: jest.fn() }) },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
  },
}));

const points = Array.from({ length: 50 }, (_, index) => ({
  t: 1_700_000_000 + index * 60,
  o: 100,
  h: 120,
  l: 90,
  c: 110,
  v: 10,
}));
const layout = getTradingViewNativeChartLayout({
  candleIntervalSeconds: 60,
  chartType: 'candlestick',
  hasVolume: false,
  height: 400,
  minimumTimeTickIndexSpacing: 1,
  points,
  priceAxisWidth: 70,
  priceRangeScale: 1,
  priceScaleMode: 'linear',
  visiblePointRange: { startIndex: 0, endIndex: points.length },
  width: 800,
});

it('renders a live native brush as a path and exposes only four bounds handles after selection', () => {
  if (!layout) throw Error('Expected chart layout');
  const projection: IDrawingProjection = {
    layout,
    points,
    interval: 60,
    viewport: createTradingViewNativeChartRuntimeState({}).viewport,
  };
  const drawing = {
    ...DEFAULT_DRAWING_STYLE,
    id: 'brush',
    tool: 'brush' as const,
    locked: false,
    points: Array.from({ length: 120 }, (_, i) =>
      screenToDrawingPoint({ x: 200 + i, y: 200 + (i % 30) }, projection),
    ),
  };
  const canvas = {
    save: jest.fn(),
    restore: jest.fn(),
    clipRect: jest.fn(),
    drawPath: jest.fn(),
    drawCircle: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
  };
  const font = { measureText: (text: string) => ({ width: text.length * 6 }) };
  const render = (selectedId: string | null, hidden = false) =>
    drawNativeChartDrawings(
      canvas as unknown as SkCanvas,
      { drawings: [{ ...drawing, hidden }], selectedId, selectedIds: [] },
      projection,
      font as unknown as SkFont,
      '#fff',
    );
  render(null);
  expect(canvas.drawPath).toHaveBeenCalledTimes(1);
  expect(mockPath.lineTo).toHaveBeenCalledTimes(119);
  expect(canvas.drawCircle).not.toHaveBeenCalled();
  expect(canvas.clipRect).toHaveBeenCalledWith(
    { x: 0, y: 0, width: layout.priceAxisX, height: layout.mainChartBottom },
    0,
    true,
  );
  render(drawing.id);
  expect(canvas.drawCircle).toHaveBeenCalledTimes(8);
  expect(canvas.drawRect).toHaveBeenCalledTimes(1);
  render(null, true);
  expect(canvas.drawPath).toHaveBeenCalledTimes(2);
  expect(mockPath.dispose).toHaveBeenCalledTimes(2);
  expect(mockPaint.dispose).toHaveBeenCalledTimes(3);
  expect(canvas.save).toHaveBeenCalledTimes(3);
  expect(canvas.restore).toHaveBeenCalledTimes(3);
});

it('renders text at its saved size without changing the font used by chart axes', () => {
  if (!layout) throw Error('Expected chart layout');
  const projection: IDrawingProjection = {
    layout,
    points,
    interval: 60,
    viewport: createTradingViewNativeChartRuntimeState({}).viewport,
  };
  let size = 11;
  const font = {
    getSize: () => size,
    setSize: (value: number) => {
      size = value;
    },
    measureText: (text: string) => ({ width: (text.length * size) / 2 }),
  };
  const canvas = {
    save: jest.fn(),
    restore: jest.fn(),
    clipRect: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(() => size),
  };
  const drawing = {
    ...DEFAULT_DRAWING_STYLE,
    id: 'text',
    tool: 'text' as const,
    locked: false,
    text: 'ASTER\nsupport',
    fontSize: 40,
    points: [screenToDrawingPoint({ x: 250, y: 220 }, projection)],
  };
  drawNativeChartDrawings(
    canvas as unknown as SkCanvas,
    {
      drawings: [drawing, { ...drawing, id: 'legacy', fontSize: undefined }],
      selectedId: null,
      selectedIds: [],
    },
    projection,
    font as unknown as SkFont,
    '#fff',
  );
  expect(canvas.drawText).toHaveNthReturnedWith(1, 40);
  expect(canvas.drawText).toHaveNthReturnedWith(2, 40);
  expect(canvas.drawText).toHaveNthReturnedWith(3, 12);
  expect(canvas.drawText).toHaveNthReturnedWith(4, 12);
  expect(canvas.drawRect.mock.calls[0][0]).toMatchObject({
    width: 106,
    height: 46,
  });
  expect(canvas.drawRect.mock.calls[2][0]).toMatchObject({
    width: 36,
    height: 18,
  });
  expect(size).toBe(11);
});
