import { formatTradingViewNativePriceTick } from '../utils/chartLayout';

import {
  DEFAULT_DRAWING_STYLE,
  drawingPointToScreen,
  getFreehandBounds,
  isFreehandTool,
} from './model';

import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

export type IDrawingPath = {
  points: IScreenPoint[];
  fill?: boolean;
  dashed?: boolean;
  color?: string;
  width?: number;
  opacity?: number;
};
export type IDrawingLabel = IScreenPoint & { text: string };
export type IDrawingGeometry = {
  handles: IScreenPoint[];
  paths: IDrawingPath[];
  labels: IDrawingLabel[];
};

function extendLine(
  a: IScreenPoint,
  b: IScreenPoint,
  projection: IDrawingProjection,
  extent: 'segment' | 'ray' | 'line',
): IScreenPoint[] {
  'worklet';

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 0.01) return [a, b];
  let start = extent === 'line' ? -Infinity : 0;
  let end = extent === 'segment' ? 1 : Infinity;
  const boundaries = [
    [-dx, a.x],
    [dx, projection.layout.priceAxisX - a.x],
    [-dy, a.y],
    [dy, projection.layout.mainChartBottom - a.y],
  ];
  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return [];
    } else if (direction < 0) start = Math.max(start, distance / direction);
    else end = Math.min(end, distance / direction);
  }
  return start <= end
    ? [
        { x: a.x + start * dx, y: a.y + start * dy },
        { x: a.x + end * dx, y: a.y + end * dy },
      ]
    : [];
}

export function getDrawingGeometry(
  drawing: IDrawing,
  projection: IDrawingProjection,
): IDrawingGeometry {
  'worklet';

  const handles = drawing.points.map((point) =>
    drawingPointToScreen(point, projection),
  );
  const [a, second] = handles;
  const b = second ?? a;
  const c = handles[2] ?? b;
  const paths: IDrawingPath[] = [];
  const labels: IDrawingLabel[] = [];
  if (!a) return { handles, paths, labels };
  const { priceAxisX: width, mainChartBottom: height } = projection.layout;
  let extent: 'segment' | 'ray' | 'line' = 'segment';
  if (drawing.tool === 'extended') extent = 'line';
  else if (drawing.tool === 'ray') extent = 'ray';
  switch (drawing.tool) {
    case 'brush':
    case 'highlighter':
      paths.push({
        points: handles,
        width:
          drawing.tool === 'highlighter' ? drawing.width * 6 : drawing.width,
        opacity: drawing.tool === 'highlighter' ? 0.3 : 1,
      });
      break;
    case 'rectangle':
    case 'priceRange':
    case 'dateRange':
    case 'datePriceRange': {
      paths.push({
        points: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a],
        fill: true,
      });
      if (drawing.tool !== 'rectangle') {
        const from = drawing.points[0];
        const to = drawing.points[1] ?? from;
        const delta = to.price - from.price;
        const percent = from.price ? (delta / from.price) * 100 : 0;
        const bars = Math.round((to.time - from.time) / projection.interval);
        const labelParts: string[] = [];
        if (drawing.tool !== 'dateRange')
          labelParts.push(
            `${formatTradingViewNativePriceTick(delta)} (${percent.toFixed(2)}%)`,
          );
        if (drawing.tool !== 'priceRange')
          labelParts.push(
            `${bars} bars · ${Math.round((to.time - from.time) / 60)}m`,
          );
        labels.push({
          x: Math.min(a.x, b.x) + 6,
          y: Math.min(a.y, b.y) - 8,
          text: labelParts.join(' · '),
        });
      }
      break;
    }
    case 'ellipse': {
      const ellipse = Array.from({ length: 65 }, (_, index) => {
        const angle = (index * Math.PI) / 32;
        return {
          x: (a.x + b.x) / 2 + ((b.x - a.x) / 2) * Math.cos(angle),
          y: (a.y + b.y) / 2 + ((b.y - a.y) / 2) * Math.sin(angle),
        };
      });
      paths.push({ points: ellipse, fill: true });
      break;
    }
    case 'triangle':
      paths.push({ points: [a, b, c, a], fill: true });
      break;
    case 'text':
    case 'priceLabel':
    case 'callout': {
      const position = drawing.tool === 'callout' ? b : a;
      const text =
        drawing.tool === 'priceLabel'
          ? formatTradingViewNativePriceTick(drawing.points[0].price)
          : (drawing.text ?? 'Text');
      text.split('\n').forEach((line, index) =>
        labels.push({
          x: position.x + 6,
          y: position.y - 6 + index * 16,
          text: line,
        }),
      );
      if (drawing.tool === 'callout') paths.push({ points: [a, b] });
      break;
    }
    case 'channel':
    case 'fibChannel': {
      // The third anchor controls the channel's vertical offset at its own time.
      const baseY =
        b.x === a.x ? a.y : a.y + ((b.y - a.y) * (c.x - a.x)) / (b.x - a.x);
      const offset = c.y - baseY;
      const levels =
        drawing.tool === 'fibChannel'
          ? [0, 0.236, 0.382, 0.5, 0.618, 1, 1.618]
          : [0, 0.5, 1];
      paths.push({
        points: [
          a,
          b,
          { x: b.x, y: b.y + offset },
          { x: a.x, y: a.y + offset },
          a,
        ],
        fill: true,
      });
      for (const level of levels) {
        paths.push({
          points: [
            { x: a.x, y: a.y + offset * level },
            { x: b.x, y: b.y + offset * level },
          ],
          dashed: level === 0.5,
        });
        if (drawing.tool === 'fibChannel')
          labels.push({
            x: b.x + 4,
            y: b.y + offset * level - 4,
            text: String(level),
          });
      }
      break;
    }
    case 'fib':
    case 'fibExtension': {
      const levels =
        drawing.tool === 'fib'
          ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
          : [0, 0.618, 1, 1.618, 2.618, 3.618];
      const colors = [
        '#787B86',
        '#F23645',
        '#FF9800',
        '#4CAF50',
        '#089981',
        '#00BCD4',
        '#2962FF',
      ];
      const from = drawing.points[0].price;
      const to = drawing.points[1]?.price ?? from;
      const origin = drawing.points[2]?.price ?? to;
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x, c.x);
      paths.push({ points: [a, b], dashed: true });
      if (drawing.tool === 'fibExtension')
        paths.push({ points: [b, c], dashed: true });
      levels.forEach((level, index) => {
        const price =
          drawing.tool === 'fib'
            ? to + (from - to) * level
            : origin + (to - from) * level;
        const y = drawingPointToScreen(
          { time: drawing.points[0].time, price },
          projection,
        ).y;
        paths.push({
          points: [
            { x: left, y },
            { x: right, y },
          ],
          color:
            drawing.color === DEFAULT_DRAWING_STYLE.color
              ? colors[index % colors.length]
              : drawing.color,
        });
        labels.push({
          x: right + 4,
          y: y - 3,
          text: `${level} (${formatTradingViewNativePriceTick(price)})`,
        });
      });
      break;
    }
    case 'fibFan':
      for (const level of [0.382, 0.5, 0.618, 1]) {
        const target = { x: b.x, y: a.y + (b.y - a.y) * level };
        paths.push({ points: extendLine(a, target, projection, 'ray') });
        labels.push({ x: target.x + 4, y: target.y - 4, text: String(level) });
      }
      break;
    case 'fibTime':
      for (const level of [0, 1, 2, 3, 5, 8, 13, 21]) {
        const x = a.x + (b.x - a.x) * level;
        paths.push({
          points: [
            { x, y: 0 },
            { x, y: height },
          ],
        });
        labels.push({ x: x + 4, y: 20, text: String(level) });
      }
      break;
    case 'horizontal':
    case 'horizontalRay':
    case 'cross':
      paths.push({
        points: [
          { x: drawing.tool === 'horizontalRay' ? a.x : 0, y: a.y },
          { x: width, y: a.y },
        ],
      });
      if (drawing.tool === 'cross')
        paths.push({
          points: [
            { x: a.x, y: 0 },
            { x: a.x, y: height },
          ],
        });
      labels.push({
        x: Math.max(width - 80, 4),
        y: a.y - 8,
        text: formatTradingViewNativePriceTick(drawing.points[0].price),
      });
      break;
    case 'vertical':
      paths.push({
        points: [
          { x: a.x, y: 0 },
          { x: a.x, y: height },
        ],
      });
      break;
    default:
      paths.push({
        points: extendLine(a, b, projection, extent),
      });
      if (drawing.tool === 'arrow') {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        paths.push({
          points: [
            {
              x: b.x - 12 * Math.cos(angle - Math.PI / 6),
              y: b.y - 12 * Math.sin(angle - Math.PI / 6),
            },
            b,
            {
              x: b.x - 12 * Math.cos(angle + Math.PI / 6),
              y: b.y - 12 * Math.sin(angle + Math.PI / 6),
            },
          ],
        });
      }
      if (drawing.tool === 'angle') {
        const angle = (-Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        labels.push({ x: b.x + 8, y: b.y - 8, text: `${angle.toFixed(1)}°` });
        paths.push({ points: [a, { x: a.x + 40, y: a.y }], dashed: true });
      }
      if (drawing.tool === 'info' && drawing.points[1]) {
        const delta = drawing.points[1].price - drawing.points[0].price;
        const percent = drawing.points[0].price
          ? (delta / drawing.points[0].price) * 100
          : 0;
        const bars = Math.round(
          (drawing.points[1].time - drawing.points[0].time) /
            projection.interval,
        );
        labels.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2 - 12,
          text: `${formatTradingViewNativePriceTick(delta)} (${percent.toFixed(2)}%) · ${bars} bars`,
        });
      }
  }
  if (drawing.tool === 'rectangle' && handles.length === 2) {
    handles.push({ x: a.x, y: b.y }, { x: b.x, y: a.y });
  }
  return {
    handles: isFreehandTool(drawing.tool)
      ? getFreehandBounds(drawing, projection)
      : handles,
    paths,
    labels,
  };
}

function containsPoint(point: IScreenPoint, polygon: IScreenPoint[]) {
  'worklet';

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function distanceToSegment(
  point: IScreenPoint,
  a: IScreenPoint,
  b: IScreenPoint,
) {
  'worklet';

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
        ),
      )
    : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

export function hitTestDrawings(
  drawings: IDrawing[],
  point: IScreenPoint,
  projection: IDrawingProjection,
  selectedId: string | null,
  tolerance = 8,
) {
  'worklet';

  // A selected handle wins over any overlapping drawing body.
  const selected = drawings.find(
    (drawing) => drawing.id === selectedId && !drawing.hidden,
  );
  if (selected && !selected.locked) {
    const geometry = getDrawingGeometry(selected, projection);
    const handle = geometry.handles.findIndex(
      (anchor) =>
        Math.hypot(anchor.x - point.x, anchor.y - point.y) <= tolerance,
    );
    if (handle >= 0) return { drawing: selected, handle };
  }
  const visibleDrawings = drawings.filter((drawing) => !drawing.hidden);
  for (let index = visibleDrawings.length - 1; index >= 0; index -= 1) {
    const drawing = visibleDrawings[index];
    const geometry = getDrawingGeometry(drawing, projection);
    const hit =
      geometry.paths.some(
        (path) => path.fill && containsPoint(point, path.points),
      ) ||
      geometry.paths.some((path) =>
        path.points.some(
          (anchor, anchorIndex) =>
            anchorIndex > 0 &&
            distanceToSegment(point, path.points[anchorIndex - 1], anchor) <=
              Math.max(tolerance - 2, drawing.width / 2 + 3),
        ),
      ) ||
      geometry.labels.some(
        (label) =>
          point.x >= label.x &&
          point.x <= label.x + label.text.length * 7 &&
          point.y >= label.y - 14 &&
          point.y <= label.y + 4,
      );
    if (hit) return { drawing, handle: null };
  }
  return null;
}
