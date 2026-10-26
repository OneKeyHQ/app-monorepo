import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
} from '../chartConstants';
import { getTradingViewNativePriceY } from '../utils/chartLayout';
import { getTradingViewNativeCandleX } from '../utils/chartViewport';
import { getTradingViewNativePriceAtProgress } from '../utils/priceScale';

import { ADDITIONAL_DRAWING_TOOLS } from './additionalTools';

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
  measure: { label: 'Measure', group: 'Measure', points: 2 },
  priceRange: { label: 'Price Range', group: 'Measure', points: 2 },
  dateRange: { label: 'Date Range', group: 'Measure', points: 2 },
  datePriceRange: {
    label: 'Date and Price Range',
    group: 'Measure',
    points: 2,
  },
  ...ADDITIONAL_DRAWING_TOOLS,
} as const;

export type IDrawingTool = keyof typeof DRAWING_TOOLS;

export const DRAWING_TOOLBAR_GROUPS = [
  'Lines',
  'Fibonacci',
  'Patterns',
  'Forecasting',
  'Shapes',
  'Text',
  'Icons',
  'Measure',
] as const;

export function getDrawingToolbarGroup(tool: IDrawingTool) {
  const group = DRAWING_TOOLS[tool].group;
  if (group === 'Pitchforks') return 'Lines';
  if (group === 'Gann') return 'Fibonacci';
  if (group === 'Elliott Waves' || group === 'Cycles') return 'Patterns';
  if (
    group === 'Projection' ||
    group === 'Volume' ||
    (group === 'Measure' && tool !== 'measure')
  )
    return 'Forecasting';
  if (group === 'Brushes') return 'Shapes';
  return group;
}
export type IDrawingPoint = { time: number; price: number };
export type IScreenPoint = { x: number; y: number };
export type IDrawingLevel = { value: number; color: string; visible: boolean };
export type IDrawingStyle = {
  color: string;
  width: number;
  dash: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  opacity?: number;
  fillOpacity?: number;
  fillColor?: string;
  textColor?: string;
  showBackground?: boolean;
  showBorder?: boolean;
  extendLeft?: boolean;
  extendRight?: boolean;
  showLabels?: boolean;
  showPrices?: boolean;
  showVolume?: boolean;
  showMiddleLine?: boolean;
  showFans?: boolean;
  showArcs?: boolean;
  reverse?: boolean;
  labelPosition?: 'left' | 'center' | 'right';
  levels?: IDrawingLevel[];
  deviation?: number;
  candleRange?: number;
  candleVariance?: number;
  accountSize?: number;
  riskPercent?: number;
  profileRows?: number;
  valueAreaPercent?: number;
  stamp?:
    | 'smile'
    | 'heart'
    | 'star'
    | 'check'
    | 'cross'
    | 'arrowUp'
    | 'arrowDown';
};
export type IDrawingVolumeBin = {
  low: number;
  high: number;
  up: number;
  down: number;
};

export type IDrawing = IDrawingStyle & {
  id: string;
  tool: IDrawingTool;
  points: IDrawingPoint[];
  locked: boolean;
  text?: string;
  name?: string;
  hidden?: boolean;
  anchor?: IScreenPoint;
  source?: IMarketTokenKLineDataPoint[];
  sourceInterval?: number;
  // Computed from finer history for rendering; never persisted with the drawing.
  volumeProfile?: { bins: IDrawingVolumeBin[]; interval: number };
};
export type IDrawingProjection = {
  layout: ITradingViewNativeChartLayout;
  points: IMarketTokenKLineDataPoint[];
  interval: number;
  viewport: ITradingViewNativeChartRuntimeViewport;
  priceDecimalPlaces?: number;
  size?: { width: number; height: number };
  showPriceAxis?: boolean;
};

export const DEFAULT_DRAWING_FONT_SIZE = 12;
export const DRAWING_FONT_SIZES: readonly number[] = [
  8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40,
];

export const DEFAULT_DRAWING_STYLE: IDrawingStyle = {
  color: '#2962FF',
  width: 2,
  dash: 'solid',
  fontSize: DEFAULT_DRAWING_FONT_SIZE,
};
export const MAX_DRAWINGS = 200;
export const MAX_DRAWING_POINTS = 2000;

export function isFibonacciTool(tool: IDrawingTool | 'cursor') {
  'worklet';
  return tool.startsWith('fib');
}

export function isRangeTool(tool: IDrawingTool | 'cursor') {
  'worklet';
  return (
    tool === 'measure' ||
    tool === 'priceRange' ||
    tool === 'dateRange' ||
    tool === 'datePriceRange'
  );
}

export function getDrawingDefaultStyle(tool: IDrawingTool): IDrawingStyle {
  'worklet';
  const style: IDrawingStyle = { ...DEFAULT_DRAWING_STYLE };
  if (tool === 'measure') style.width = 1;
  if (tool === 'text') style.fontSize = 20;
  if (tool === 'anchoredText') style.fontSize = 20;
  if (['note', 'priceNote', 'pin', 'comment', 'signpost'].includes(tool)) {
    style.fontSize = 14;
    style.textColor = '#FFFFFF';
    style.fillOpacity = 1;
  }
  if (['icon', 'emoji', 'sticker'].includes(tool)) style.fontSize = 32;
  if (tool === 'callout' || tool === 'priceLabel') {
    style.textColor = '#FFFFFF';
    style.fillOpacity = 1;
    style.fontSize = 14;
  }
  if (tool === 'highlighter') {
    style.color = '#FFEB3B';
    style.width = 4;
    style.opacity = 0.5;
  }
  if (
    [
      'xabcd',
      'cypher',
      'abcd',
      'trianglePattern',
      'headShoulders',
      'threeDrives',
    ].includes(tool)
  )
    style.color = '#9C27B0';
  return style;
}

export function isTextDrawingTool(tool: IDrawingTool | 'cursor') {
  'worklet';

  return [
    'text',
    'callout',
    'priceLabel',
    'anchoredText',
    'note',
    'priceNote',
    'pin',
    'table',
    'comment',
    'signpost',
    'flag',
  ].includes(tool);
}

export function isPathTool(tool: IDrawingTool | 'cursor') {
  'worklet';
  return tool === 'path' || tool === 'polyline' || tool === 'ghostFeed';
}

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

export function timeAtIndex(
  index: number,
  { points, interval }: Pick<IDrawingProjection, 'points' | 'interval'>,
) {
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

export function indexAtTime(
  time: number,
  { points, interval }: Pick<IDrawingProjection, 'points' | 'interval'>,
) {
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

  if (drawing.anchor)
    return {
      ...drawing,
      anchor: {
        x: drawing.anchor.x + delta.x / projection.layout.priceAxisX,
        y: drawing.anchor.y + delta.y / projection.layout.mainChartBottom,
      },
    };

  if (
    drawing.tool === 'channel' &&
    drawing.points.length >= 3 &&
    handle !== null
  ) {
    const [a, b, c] = drawing.points.map((point) =>
      drawingPointToScreen(point, projection),
    );
    const slope = b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x);
    let offset = c.y - a.y - slope * (c.x - a.x);
    if (handle === 0 || handle === 1) {
      const point = handle === 0 ? a : b;
      point.x += delta.x;
      point.y += delta.y;
    } else if (handle === 2 || handle === 3) {
      const point = handle === 2 ? a : b;
      point.x += delta.x;
      point.y += slope * delta.x;
      offset += delta.y - slope * delta.x;
    } else if (handle === 4) {
      a.x += delta.x;
      b.x += delta.x;
      a.y += delta.y;
      b.y += delta.y;
      offset -= delta.y - slope * delta.x;
    } else if (handle === 5) offset += delta.y - slope * delta.x;
    return {
      ...drawing,
      points: [a, b, { x: a.x, y: a.y + offset }].map((point) =>
        screenToDrawingPoint(point, projection, magnet),
      ),
    };
  }
  if (
    (drawing.tool === 'longPosition' || drawing.tool === 'shortPosition') &&
    drawing.points.length >= 3 &&
    handle !== null
  ) {
    if (handle === 0)
      return moveDrawing(drawing, delta, projection, null, magnet);
    const [entry, target, stop] = drawing.points;
    const direction = drawing.tool === 'longPosition' ? 1 : -1;
    const tick = 10 ** -(projection.priceDecimalPlaces ?? 8);
    const targetScreen = drawingPointToScreen(target, projection);
    const stopScreen = drawingPointToScreen(stop, projection);
    const changedTarget = screenToDrawingPoint(
      {
        x: targetScreen.x + (handle === 1 ? delta.x : 0),
        y: targetScreen.y + (handle === 2 ? delta.y : 0),
      },
      projection,
      magnet,
    );
    const changedStop = screenToDrawingPoint(
      { x: stopScreen.x, y: stopScreen.y + (handle === 3 ? delta.y : 0) },
      projection,
      magnet,
    );
    return {
      ...drawing,
      points: [
        entry,
        {
          time: Math.max(entry.time + projection.interval, changedTarget.time),
          price:
            direction *
            Math.max(
              direction * changedTarget.price,
              direction * entry.price + tick,
            ),
        },
        {
          time: entry.time,
          price:
            direction *
            Math.min(
              direction * changedStop.price,
              direction * entry.price - tick,
            ),
        },
      ],
    };
  }

  if (
    drawing.tool === 'projection' &&
    drawing.points.length >= 3 &&
    handle !== null
  ) {
    if (handle === 0)
      return moveDrawing(drawing, delta, projection, null, magnet);
    const [a, b, c] = drawing.points.map((point) =>
      drawingPointToScreen(point, projection),
    );
    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(c.y - a.y, c.x - a.x);
    const target = {
      x: a.x + radius * Math.cos(angle),
      y: a.y + radius * Math.sin(angle),
    };
    if (handle === 1) {
      b.x += delta.x;
      b.y += delta.y;
    } else {
      target.x += delta.x;
      target.y += delta.y;
    }
    const nextRadius = Math.hypot(b.x - a.x, b.y - a.y);
    const nextAngle = Math.atan2(target.y - a.y, target.x - a.x);
    return {
      ...drawing,
      points: [
        a,
        b,
        {
          x: a.x + nextRadius * Math.cos(nextAngle),
          y: a.y + nextRadius * Math.sin(nextAngle),
        },
      ].map((point) => screenToDrawingPoint(point, projection, magnet)),
    };
  }

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
      if (
        (drawing.tool === 'rectangle' ||
          drawing.tool === 'ellipse' ||
          isRangeTool(drawing.tool)) &&
        handle !== null &&
        handle >= 2
      ) {
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
          (drawing.fontSize !== undefined &&
            !DRAWING_FONT_SIZES.includes(drawing.fontSize)) ||
          !['solid', 'dashed', 'dotted'].includes(drawing.dash ?? '') ||
          ![drawing.opacity, drawing.fillOpacity].every(
            (opacity) =>
              opacity === undefined ||
              (typeof opacity === 'number' &&
                Number.isFinite(opacity) &&
                opacity >= 0 &&
                opacity <= 1),
          ) ||
          ![drawing.fillColor, drawing.textColor].every(
            (color) =>
              color === undefined ||
              (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)),
          ) ||
          ![
            drawing.deviation,
            drawing.candleRange,
            drawing.candleVariance,
            drawing.sourceInterval,
            drawing.accountSize,
            drawing.riskPercent,
            drawing.profileRows,
            drawing.valueAreaPercent,
          ].every(
            (number) =>
              number === undefined ||
              (typeof number === 'number' &&
                Number.isFinite(number) &&
                number >= 0 &&
                number <= 1e12),
          ) ||
          (drawing.stamp !== undefined &&
            ![
              'smile',
              'heart',
              'star',
              'check',
              'cross',
              'arrowUp',
              'arrowDown',
            ].includes(drawing.stamp)) ||
          (drawing.anchor !== undefined &&
            (!drawing.anchor ||
              !Number.isFinite(drawing.anchor.x) ||
              !Number.isFinite(drawing.anchor.y))) ||
          (drawing.source !== undefined &&
            (!Array.isArray(drawing.source) ||
              drawing.source.length > MAX_DRAWING_POINTS ||
              !drawing.source.every(
                (point) =>
                  point &&
                  ['t', 'o', 'h', 'l', 'c', 'v'].every((key) =>
                    Number.isFinite(
                      point[key as keyof IMarketTokenKLineDataPoint],
                    ),
                  ),
              ))) ||
          ![
            drawing.showBackground,
            drawing.showBorder,
            drawing.extendLeft,
            drawing.extendRight,
            drawing.showLabels,
            drawing.showPrices,
            drawing.showVolume,
            drawing.showMiddleLine,
            drawing.showFans,
            drawing.showArcs,
            drawing.reverse,
          ].every((flag) => flag === undefined || typeof flag === 'boolean') ||
          (drawing.labelPosition !== undefined &&
            !['left', 'center', 'right'].includes(drawing.labelPosition)) ||
          (drawing.levels !== undefined &&
            (!Array.isArray(drawing.levels) ||
              drawing.levels.length > 24 ||
              !drawing.levels.every((level: unknown) => {
                if (!level || typeof level !== 'object') return false;
                const entry = level as Partial<IDrawingLevel>;
                return (
                  typeof entry.value === 'number' &&
                  Number.isFinite(entry.value) &&
                  Math.abs(entry.value) <= 1000 &&
                  typeof entry.visible === 'boolean' &&
                  typeof entry.color === 'string' &&
                  /^#[\da-f]{6}$/i.test(entry.color)
                );
              }))) ||
          (drawing.sourceInterval !== undefined &&
            drawing.sourceInterval <= 0) ||
          (drawing.profileRows !== undefined &&
            (drawing.profileRows < 1 ||
              drawing.profileRows > 100 ||
              !Number.isInteger(drawing.profileRows))) ||
          (drawing.valueAreaPercent !== undefined &&
            (drawing.valueAreaPercent < 1 || drawing.valueAreaPercent > 100)) ||
          (drawing.riskPercent !== undefined && drawing.riskPercent > 100) ||
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
      .slice(0, MAX_DRAWINGS)
      .map((drawing) => {
        const restored = { ...drawing };
        delete restored.volumeProfile;
        return restored;
      });
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
