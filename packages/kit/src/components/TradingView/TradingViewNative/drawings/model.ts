import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
} from '../chartConstants';
import { getTradingViewNativePriceY } from '../utils/chartLayout';
import { getTradingViewNativeCandleX } from '../utils/chartViewport';
import { getTradingViewNativePriceAtProgress } from '../utils/priceScale';

import type { ITradingViewNativeChartLayout } from '../utils/chartLayout';
import type { ITradingViewNativeChartRuntimeViewport } from '../utils/chartRuntime';

export const DRAWING_TOOLS = {
  trend: { label: 'Trend Line', group: 'Lines', points: 2 },
  ray: { label: 'Ray', group: 'Lines', points: 2 },
  extended: { label: 'Extended Line', group: 'Lines', points: 2 },
  horizontal: { label: 'Horizontal Line', group: 'Lines', points: 1 },
  horizontalRay: { label: 'Horizontal Ray', group: 'Lines', points: 1 },
  vertical: { label: 'Vertical Line', group: 'Lines', points: 1 },
  cross: { label: 'Cross Line', group: 'Lines', points: 1 },
  arrow: { label: 'Arrow', group: 'Lines', points: 2 },
  info: { label: 'Info Line', group: 'Lines', points: 2 },
  angle: { label: 'Trend Angle', group: 'Lines', points: 2 },
  channel: { label: 'Parallel Channel', group: 'Lines', points: 3 },
  fib: { label: 'Fib Retracement', group: 'Fibonacci', points: 2 },
  fibExtension: {
    label: 'Trend-Based Fib Extension',
    group: 'Fibonacci',
    points: 3,
  },
  fibChannel: { label: 'Fib Channel', group: 'Fibonacci', points: 3 },
  fibFan: { label: 'Fib Speed Resistance Fan', group: 'Fibonacci', points: 2 },
  fibTime: { label: 'Fib Time Zone', group: 'Fibonacci', points: 2 },
  rectangle: { label: 'Rectangle', group: 'Shapes', points: 2 },
  ellipse: { label: 'Ellipse', group: 'Shapes', points: 2 },
  triangle: { label: 'Triangle', group: 'Shapes', points: 3 },
  brush: { label: 'Brush', group: 'Brushes', points: 2 },
  highlighter: { label: 'Highlighter', group: 'Brushes', points: 2 },
  text: { label: 'Text', group: 'Text', points: 1 },
  callout: { label: 'Callout', group: 'Text', points: 2 },
  priceLabel: { label: 'Price Label', group: 'Text', points: 1 },
  priceRange: { label: 'Price Range', group: 'Measure', points: 2 },
  dateRange: { label: 'Date Range', group: 'Measure', points: 2 },
  datePriceRange: {
    label: 'Date and Price Range',
    group: 'Measure',
    points: 2,
  },
} as const;

export type IDrawingTool = keyof typeof DRAWING_TOOLS;
export type IDrawingPoint = { time: number; price: number };
export type IScreenPoint = { x: number; y: number };
export type IDrawingStyle = {
  color: string;
  width: number;
  dash: 'solid' | 'dashed' | 'dotted';
};
export type IDrawing = IDrawingStyle & {
  id: string;
  tool: IDrawingTool;
  points: IDrawingPoint[];
  locked: boolean;
  text?: string;
  name?: string;
  hidden?: boolean;
};
export type IDrawingProjection = {
  layout: ITradingViewNativeChartLayout;
  points: IMarketTokenKLineDataPoint[];
  interval: number;
  viewport: ITradingViewNativeChartRuntimeViewport;
};

export const DEFAULT_DRAWING_STYLE: IDrawingStyle = {
  color: '#2962FF',
  width: 2,
  dash: 'solid',
};
export const MAX_DRAWINGS = 200;
export const MAX_DRAWING_POINTS = 2000;

export function isFreehandTool(tool: IDrawingTool) {
  'worklet';

  return tool === 'brush' || tool === 'highlighter';
}

export function constrainDrawingPoint(
  start: IScreenPoint,
  end: IScreenPoint,
  tool: IDrawingTool,
): IScreenPoint {
  'worklet';

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (tool === 'rectangle' || tool === 'ellipse') {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + Math.sign(dx) * size,
      y: start.y + Math.sign(dy) * size,
    };
  }
  const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
  const length = Math.hypot(dx, dy);
  return {
    x: start.x + Math.cos(angle) * length,
    y: start.y + Math.sin(angle) * length,
  };
}

function timeAtIndex(index: number, { points, interval }: IDrawingProjection) {
  'worklet';

  const lastIndex = points.length - 1;
  if (index < 0) return points[0].t + index * interval;
  if (index >= lastIndex) {
    return points[lastIndex].t + (index - lastIndex) * interval;
  }
  const left = Math.floor(index);
  return (
    points[left].t + (points[left + 1].t - points[left].t) * (index - left)
  );
}

function indexAtTime(time: number, { points, interval }: IDrawingProjection) {
  'worklet';

  const lastIndex = points.length - 1;
  if (time <= points[0].t) return (time - points[0].t) / interval;
  if (time >= points[lastIndex].t) {
    return lastIndex + (time - points[lastIndex].t) / interval;
  }
  let low = 0;
  let high = lastIndex;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].t <= time) low = mid;
    else high = mid;
  }
  return low + (time - points[low].t) / (points[high].t - points[low].t);
}

function firstPointX(projection: IDrawingProjection) {
  'worklet';

  return getTradingViewNativeCandleX({
    ...projection.viewport,
    index: 0,
    pointCount: projection.points.length,
    priceAxisX: projection.layout.priceAxisX,
  });
}

export function drawingPointToScreen(
  point: IDrawingPoint,
  projection: IDrawingProjection,
): IScreenPoint {
  'worklet';

  return {
    x:
      firstPointX(projection) +
      indexAtTime(point.time, projection) *
        TRADING_VIEW_NATIVE_CANDLE_STEP *
        projection.viewport.zoomScale,
    y: getTradingViewNativePriceY(point.price, projection.layout),
  };
}

export function screenToDrawingPoint(
  point: IScreenPoint,
  projection: IDrawingProjection,
  magnet = false,
): IDrawingPoint {
  'worklet';

  const { layout, points, viewport } = projection;
  const index =
    (point.x - firstPointX(projection)) /
    (TRADING_VIEW_NATIVE_CANDLE_STEP * viewport.zoomScale);
  const candle = points[Math.round(index)];
  if (magnet && candle) {
    const prices = [candle.o, candle.h, candle.l, candle.c];
    const price = prices.reduce((closest, candidate) =>
      Math.abs(getTradingViewNativePriceY(candidate, layout) - point.y) <
      Math.abs(getTradingViewNativePriceY(closest, layout) - point.y)
        ? candidate
        : closest,
    );
    return { time: candle.t, price };
  }
  return {
    time: timeAtIndex(index, projection),
    price: getTradingViewNativePriceAtProgress({
      ...layout,
      mode: layout.priceScaleMode,
      progress:
        (point.y - TRADING_VIEW_NATIVE_CHART_TOP_PADDING) /
        layout.priceChartHeight,
    }),
  };
}

export function isInDrawingPane(
  point: IScreenPoint,
  { layout }: IDrawingProjection,
) {
  'worklet';

  return (
    point.x >= 0 &&
    point.x <= layout.priceAxisX &&
    point.y >= 0 &&
    point.y < layout.mainChartBottom
  );
}

export function getFreehandBounds(
  drawing: IDrawing,
  projection: IDrawingProjection,
) {
  'worklet';

  const points = drawing.points.map((point) =>
    drawingPointToScreen(point, projection),
  );
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function moveDrawing(
  drawing: IDrawing,
  delta: IScreenPoint,
  projection: IDrawingProjection,
  handle: number | null,
  magnet: boolean,
): IDrawing {
  'worklet';

  if (isFreehandTool(drawing.tool) && handle !== null) {
    const bounds = getFreehandBounds(drawing, projection);
    const anchor = bounds[handle];
    const fixed = bounds[(handle + 2) % 4];
    if (!anchor || !fixed) return drawing;
    const scaleX =
      anchor.x === fixed.x
        ? 1
        : (anchor.x + delta.x - fixed.x) / (anchor.x - fixed.x);
    const scaleY =
      anchor.y === fixed.y
        ? 1
        : (anchor.y + delta.y - fixed.y) / (anchor.y - fixed.y);
    return {
      ...drawing,
      points: drawing.points.map((point) => {
        const screen = drawingPointToScreen(point, projection);
        return screenToDrawingPoint(
          {
            x: fixed.x + (screen.x - fixed.x) * scaleX,
            y: fixed.y + (screen.y - fixed.y) * scaleY,
          },
          projection,
          false,
        );
      }),
    };
  }
  return {
    ...drawing,
    points: drawing.points.map((point, index) => {
      if (drawing.tool === 'rectangle' && handle !== null && handle >= 2) {
        const screen = drawingPointToScreen(point, projection);
        const moveX = handle === 2 ? index === 0 : index === 1;
        return screenToDrawingPoint(
          {
            x: screen.x + (moveX ? delta.x : 0),
            y: screen.y + (moveX ? 0 : delta.y),
          },
          projection,
          magnet,
        );
      }
      if (handle !== null && index !== handle) return point;
      const screen = drawingPointToScreen(point, projection);
      return screenToDrawingPoint(
        { x: screen.x + delta.x, y: screen.y + delta.y },
        projection,
        handle !== null && magnet,
      );
    }),
  };
}

export function parseDrawings(value: string | null): IDrawing[] {
  'worklet';

  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    return parsed
      .filter((item: unknown): item is IDrawing => {
        if (!item || typeof item !== 'object') return false;
        const drawing = item as Partial<IDrawing>;
        if (
          typeof drawing.id !== 'string' ||
          ids.has(drawing.id) ||
          typeof drawing.tool !== 'string' ||
          !Object.hasOwn(DRAWING_TOOLS, drawing.tool) ||
          typeof drawing.color !== 'string' ||
          !/^#[\da-f]{6}$/i.test(drawing.color) ||
          typeof drawing.width !== 'number' ||
          ![1, 2, 3, 4].includes(drawing.width) ||
          !['solid', 'dashed', 'dotted'].includes(drawing.dash ?? '') ||
          typeof drawing.locked !== 'boolean' ||
          (drawing.hidden !== undefined &&
            typeof drawing.hidden !== 'boolean') ||
          (drawing.name !== undefined &&
            (typeof drawing.name !== 'string' || drawing.name.length > 100)) ||
          (drawing.text !== undefined &&
            (typeof drawing.text !== 'string' || drawing.text.length > 500)) ||
          !Array.isArray(drawing.points) ||
          drawing.points.length < DRAWING_TOOLS[drawing.tool].points ||
          drawing.points.length > MAX_DRAWING_POINTS ||
          !drawing.points.every((point: unknown) => {
            if (!point || typeof point !== 'object') return false;
            const anchor = point as Partial<IDrawingPoint>;
            return (
              typeof anchor.time === 'number' &&
              Number.isFinite(anchor.time) &&
              Math.abs(anchor.time) < 8_640_000_000_000 &&
              Number.isFinite(anchor.price)
            );
          })
        )
          return false;
        ids.add(drawing.id);
        return true;
      })
      .slice(0, MAX_DRAWINGS);
  } catch {
    return [];
  }
}

export type IDrawingHistory = {
  past: IDrawing[][];
  present: IDrawing[];
  future: IDrawing[][];
};
export function changeDrawingHistory(
  history: IDrawingHistory,
  change: IDrawing[] | 'undo' | 'redo',
): IDrawingHistory {
  'worklet';

  if (change === 'undo') {
    const previous = history.past.at(-1);
    return previous
      ? {
          past: history.past.slice(0, -1),
          present: previous,
          future: [history.present, ...history.future],
        }
      : history;
  }
  if (change === 'redo') {
    const next = history.future[0];
    return next
      ? {
          past: [...history.past, history.present],
          present: next,
          future: history.future.slice(1),
        }
      : history;
  }
  return {
    past: [...history.past, history.present].slice(-50),
    present: change,
    future: [],
  };
}
