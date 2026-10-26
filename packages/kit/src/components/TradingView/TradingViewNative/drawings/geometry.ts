import { appendAdvancedLevels } from './advancedLevels';
import { appendFibonacciGeometry } from './fibonacci';
import { appendGeometricTools } from './geometricTools';
import {
  getDrawingLabelBackground,
  getDrawingLabelLayout,
} from './labelLayout';
import { formatDrawingNumber, getDrawingMeasurement } from './measurement';
import {
  drawingPointToScreen,
  getFreehandBounds,
  isFibonacciTool,
  isRangeTool,
} from './model';
import {
  drawingArrowHead,
  extendDrawingLine,
  smoothDrawingStroke,
} from './pathUtils';
import { appendPatternGeometry } from './patternGeometry';
import { appendProjectionGeometry } from './projectionGeometry';

import type { IDrawingLabel } from './labelLayout';
import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

export type { IDrawingLabel } from './labelLayout';
export type IDrawingPath = {
  points: IScreenPoint[];
  fill?: boolean;
  stroke?: boolean;
  fillOpacity?: number;
  fillColor?: string;
  dashed?: boolean;
  color?: string;
  width?: number;
  opacity?: number;
};
export type IDrawingGeometry = {
  handles: IScreenPoint[];
  paths: IDrawingPath[];
  labels: IDrawingLabel[];
};

export function getDrawingGeometry(
  drawing: IDrawing,
  projection: IDrawingProjection,
): IDrawingGeometry {
  'worklet';
  const handles = drawing.points.map((point) =>
    drawingPointToScreen(point, projection),
  );
  const geometry: IDrawingGeometry = { handles, paths: [], labels: [] };
  const { paths, labels } = geometry;
  const [a, second] = handles;
  if (!a) return geometry;
  const b = second ?? a;
  const c = handles[2] ?? b;
  const { priceAxisX: width, mainChartBottom: height } = projection.layout;
  const rectangle = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
  const shapeStyle = {
    fill: drawing.showBackground !== false,
    stroke: drawing.showBorder !== false,
    fillColor: drawing.fillColor,
    fillOpacity: drawing.fillOpacity ?? 0.2,
  };
  if (
    appendGeometricTools(drawing, projection, geometry) ||
    appendPatternGeometry(drawing, projection, geometry) ||
    appendAdvancedLevels(drawing, projection, geometry) ||
    appendProjectionGeometry(drawing, projection, geometry)
  )
    return geometry;
  if (isFibonacciTool(drawing.tool)) {
    appendFibonacciGeometry(drawing, projection, geometry);
    return geometry;
  }
  if (isRangeTool(drawing.tool)) {
    const measurement = getDrawingMeasurement(drawing, projection);
    let color = drawing.color;
    if (drawing.tool === 'measure')
      color = measurement.delta < 0 ? '#F7525F' : '#2962FF';
    const left =
      drawing.extendLeft && drawing.tool === 'priceRange'
        ? 0
        : Math.min(a.x, b.x);
    const right =
      drawing.extendRight && drawing.tool === 'priceRange'
        ? width
        : Math.max(a.x, b.x);
    const top =
      drawing.extendLeft && drawing.tool === 'dateRange'
        ? 0
        : Math.min(a.y, b.y);
    const bottom =
      drawing.extendRight && drawing.tool === 'dateRange'
        ? height
        : Math.max(a.y, b.y);
    paths.push({
      points: [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ],
      fill: drawing.showBackground !== false,
      stroke: drawing.showBorder === true,
      color,
      fillColor: drawing.fillColor,
      fillOpacity: drawing.fillOpacity ?? 0.15,
    });
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const lines: string[] = [];
    if (drawing.tool !== 'dateRange') {
      const start = { x: centerX, y: a.y };
      const end = { x: centerX, y: b.y };
      paths.push(
        { points: [start, end], color },
        { points: drawingArrowHead(start, end, 7), color },
      );
      if (drawing.tool === 'priceRange') {
        paths.push(
          {
            points: [
              { x: left, y: a.y },
              { x: right, y: a.y },
            ],
            color,
          },
          {
            points: [
              { x: left, y: b.y },
              { x: right, y: b.y },
            ],
            color,
          },
        );
      }
      lines.push(measurement.priceText);
    }
    if (drawing.tool !== 'priceRange') {
      const start = { x: a.x, y: centerY };
      const end = { x: b.x, y: centerY };
      paths.push(
        { points: [start, end], color },
        { points: drawingArrowHead(start, end, 7), color },
      );
      if (drawing.tool === 'dateRange')
        paths.push(
          {
            points: [
              { x: a.x, y: top },
              { x: a.x, y: bottom },
            ],
            color,
          },
          {
            points: [
              { x: b.x, y: top },
              { x: b.x, y: bottom },
            ],
            color,
          },
        );
      lines.push(measurement.timeText);
      if (drawing.showVolume !== false) lines.push(measurement.volumeText);
    }
    if (drawing.showLabels !== false) {
      const below = drawing.tool === 'dateRange' || b.y >= a.y;
      labels.push({
        x: centerX,
        y: below ? bottom + 10 : top - 10,
        text: lines.join('\n'),
        lineHeight: (drawing.fontSize ?? 12) + 6,
        fontSize: drawing.fontSize ?? 12,
        color: drawing.textColor ?? '#FFFFFF',
        background: color,
        align: 'center',
        verticalAlign: below ? 'top' : 'bottom',
        padding: 8,
        radius: 4,
        keepInPane: true,
      });
    }
    if (drawing.tool === 'measure') geometry.handles = [];
    else if (handles.length === 2)
      handles.push({ x: a.x, y: b.y }, { x: b.x, y: a.y });
    return geometry;
  }
  switch (drawing.tool) {
    case 'brush':
    case 'highlighter':
      paths.push({
        points: smoothDrawingStroke(handles),
        width:
          drawing.tool === 'highlighter' ? drawing.width * 5 : drawing.width,
        opacity: drawing.opacity ?? (drawing.tool === 'highlighter' ? 0.5 : 1),
      });
      geometry.handles = getFreehandBounds(drawing, projection);
      break;
    case 'rectangle':
      paths.push({ points: rectangle, ...shapeStyle });
      if (handles.length === 2)
        handles.push({ x: a.x, y: b.y }, { x: b.x, y: a.y });
      break;
    case 'ellipse':
      paths.push({
        points: Array.from({ length: 97 }, (_, index) => {
          const angle = (index * Math.PI) / 48;
          return {
            x: (a.x + b.x) / 2 + ((b.x - a.x) / 2) * Math.cos(angle),
            y: (a.y + b.y) / 2 + ((b.y - a.y) / 2) * Math.sin(angle),
          };
        }),
        ...shapeStyle,
      });
      if (handles.length === 2)
        handles.push({ x: a.x, y: b.y }, { x: b.x, y: a.y });
      break;
    case 'triangle':
      paths.push({ points: [a, b, c, a], ...shapeStyle });
      break;
    case 'text':
      labels.push({
        x: a.x,
        y: a.y,
        verticalAlign: 'top',
        text: drawing.text ?? 'Text',
        fontSize: drawing.fontSize ?? 12,
        color: drawing.textColor ?? drawing.color,
        background: drawing.showBackground
          ? (drawing.fillColor ?? drawing.color)
          : undefined,
        borderColor: drawing.showBorder ? drawing.color : undefined,
        borderWidth: drawing.width,
        opacity: drawing.fillOpacity ?? 0.2,
        padding: drawing.showBackground || drawing.showBorder ? 4 : 0,
      });
      break;
    case 'callout':
    case 'priceLabel': {
      const priceLabel = drawing.tool === 'priceLabel';
      labels.push({
        x: priceLabel ? a.x + 14 : b.x,
        y: priceLabel ? a.y - 14 : b.y,
        verticalAlign: priceLabel ? 'bottom' : 'middle',
        align: priceLabel ? 'left' : 'center',
        text: priceLabel
          ? formatDrawingNumber(
              drawing.points[0].price,
              projection.priceDecimalPlaces,
            )
          : (drawing.text ?? 'Text'),
        fontSize: drawing.fontSize,
        color: drawing.textColor ?? '#FFFFFF',
        background:
          drawing.showBackground === false
            ? undefined
            : (drawing.fillColor ?? drawing.color),
        borderColor: drawing.showBorder === false ? undefined : drawing.color,
        borderWidth: drawing.width,
        padding: 6,
        radius: 4,
        pointer: a,
        opacity: drawing.fillOpacity ?? 1,
      });
      break;
    }
    case 'channel': {
      const baseY =
        b.x === a.x ? a.y : a.y + ((b.y - a.y) * (c.x - a.x)) / (b.x - a.x);
      const offset = c.y - baseY;
      geometry.handles = [
        a,
        b,
        { x: a.x, y: a.y + offset },
        { x: b.x, y: b.y + offset },
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + offset },
      ];
      const upper = extendDrawingLine(
        a,
        b,
        projection,
        drawing.extendLeft ?? false,
        drawing.extendRight ?? false,
      );
      const lower = extendDrawingLine(
        { x: a.x, y: a.y + offset },
        { x: b.x, y: b.y + offset },
        projection,
        drawing.extendLeft ?? false,
        drawing.extendRight ?? false,
      );
      if (
        upper.length === 2 &&
        lower.length === 2 &&
        drawing.showBackground !== false
      )
        paths.push({
          points: [upper[0], upper[1], lower[1], lower[0]],
          ...shapeStyle,
          stroke: false,
        });
      paths.push({ points: upper }, { points: lower });
      if (drawing.showMiddleLine !== false)
        paths.push({
          points: extendDrawingLine(
            { x: a.x, y: a.y + offset / 2 },
            { x: b.x, y: b.y + offset / 2 },
            projection,
            drawing.extendLeft ?? false,
            drawing.extendRight ?? false,
          ),
          dashed: true,
          width: 1,
        });
      break;
    }
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
      break;
    case 'vertical':
      paths.push({
        points: [
          { x: a.x, y: 0 },
          { x: a.x, y: height },
        ],
      });
      break;
    default: {
      const line = extendDrawingLine(
        a,
        b,
        projection,
        drawing.extendLeft ?? drawing.tool === 'extended',
        drawing.extendRight ??
          (drawing.tool === 'extended' || drawing.tool === 'ray'),
      );
      paths.push({ points: line });
      if (drawing.tool === 'arrow')
        paths.push({ points: drawingArrowHead(a, b, 8 + drawing.width * 2) });
      if (drawing.tool === 'angle') {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const radius = Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) / 2);
        paths.push({
          points: [a, { x: a.x + radius + 12, y: a.y }],
          dashed: true,
          width: 1,
        });
        paths.push({
          points: Array.from({ length: 25 }, (_, index) => ({
            x: a.x + radius * Math.cos((angle * index) / 24),
            y: a.y + radius * Math.sin((angle * index) / 24),
          })),
          width: 1,
        });
        labels.push({
          x: a.x + (radius + 14) * Math.cos(angle / 2),
          y: a.y + (radius + 14) * Math.sin(angle / 2),
          text: `${((-angle * 180) / Math.PI).toFixed(1)}°`,
          fontSize: drawing.fontSize,
          color: drawing.textColor ?? drawing.color,
          align: 'center',
          verticalAlign: 'middle',
        });
      }
      if (
        drawing.tool === 'info' &&
        drawing.points[1] &&
        drawing.showLabels !== false
      ) {
        const stats = getDrawingMeasurement(drawing, projection);
        labels.push({
          x: (a.x + b.x) / 2,
          y: Math.min(a.y, b.y) - 10,
          text: `${stats.priceText}\n${stats.timeText}`,
          fontSize: drawing.fontSize,
          color: drawing.textColor ?? '#FFFFFF',
          background: '#363A45',
          align: 'center',
          verticalAlign: 'bottom',
          padding: 6,
          radius: 4,
          keepInPane: true,
        });
      }
    }
  }
  return geometry;
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
      geometry.paths.some(
        (path) =>
          path.stroke !== false &&
          path.points.some(
            (anchor, anchorIndex) =>
              anchorIndex > 0 &&
              distanceToSegment(point, path.points[anchorIndex - 1], anchor) <=
                Math.max(tolerance - 2, (path.width ?? drawing.width) / 2 + 3),
          ),
      ) ||
      geometry.labels.some((label) => {
        const bounds = getDrawingLabelLayout(label, projection);
        if (
          label.pointer &&
          containsPoint(point, getDrawingLabelBackground(label, bounds))
        )
          return true;
        return (
          point.x >= bounds.x - 2 &&
          point.x <= bounds.x + bounds.width + 2 &&
          point.y >= bounds.y - 2 &&
          point.y <= bounds.y + bounds.height + 2
        );
      });
    if (hit) return { drawing, handle: null };
  }
  return null;
}
