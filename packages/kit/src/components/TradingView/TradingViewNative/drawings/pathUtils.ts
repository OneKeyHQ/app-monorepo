import type { IDrawingProjection, IScreenPoint } from './model';

export function extendDrawingLine(
  a: IScreenPoint,
  b: IScreenPoint,
  projection: IDrawingProjection,
  extendStart: boolean,
  extendEnd: boolean,
): IScreenPoint[] {
  'worklet';
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 0.01) return [a, b];
  let start = extendStart ? -Infinity : 0;
  let end = extendEnd ? Infinity : 1;
  for (const [direction, distance] of [
    [-dx, a.x],
    [dx, projection.layout.priceAxisX - a.x],
    [-dy, a.y],
    [dy, projection.layout.mainChartBottom - a.y],
  ]) {
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

export function drawingArrowHead(
  a: IScreenPoint,
  b: IScreenPoint,
  size: number,
) {
  'worklet';
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return [
    {
      x: b.x - size * Math.cos(angle - Math.PI / 4),
      y: b.y - size * Math.sin(angle - Math.PI / 4),
    },
    b,
    {
      x: b.x - size * Math.cos(angle + Math.PI / 4),
      y: b.y - size * Math.sin(angle + Math.PI / 4),
    },
  ];
}

export function smoothDrawingStroke(points: IScreenPoint[]): IScreenPoint[] {
  'worklet';
  if (points.length < 3) return points;
  const result = [points[0]];
  let start = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const end =
      index === points.length - 2
        ? next
        : { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    for (let step = 1; step <= 4; step += 1) {
      const t = step / 4;
      result.push({
        x:
          (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
        y:
          (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
      });
    }
    start = end;
  }
  return result;
}
