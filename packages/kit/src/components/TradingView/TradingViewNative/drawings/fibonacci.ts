import { formatDrawingNumber } from './measurement';
import { DEFAULT_DRAWING_STYLE, drawingPointToScreen } from './model';
import { extendDrawingLine } from './pathUtils';

import type { IDrawingGeometry, IDrawingPath } from './geometry';
import type {
  IDrawing,
  IDrawingLevel,
  IDrawingProjection,
  IDrawingTool,
  IScreenPoint,
} from './model';

export function getDefaultDrawingLevels(tool: IDrawingTool): IDrawingLevel[] {
  'worklet';
  let values = [
    0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236,
  ];
  if (tool === 'fibTime') values = [0, 1, 2, 3, 5, 8, 13, 21, 34];
  if (tool === 'fibFan') values = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
  if (tool === 'gannFan') values = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8];
  else if (tool === 'gannSquareFixed') values = [0, 1, 2, 3, 4, 5];
  else if (tool.startsWith('gann')) values = [0, 0.25, 0.5, 0.75, 1];
  const pitchfork = [
    'pitchfork',
    'schiffPitchfork',
    'modifiedPitchfork',
    'insidePitchfork',
    'pitchfan',
  ].includes(tool);
  if (pitchfork) values = [-1, -0.5, 0, 0.5, 1];
  const colors =
    tool === 'fibFan'
      ? [
          '#787B86',
          '#FF9800',
          '#00BCD4',
          '#4CAF50',
          '#089981',
          '#2962FF',
          '#787B86',
        ]
      : [
          '#787B86',
          '#F23645',
          '#FF9800',
          '#4CAF50',
          '#089981',
          '#00BCD4',
          '#787B86',
          '#2962FF',
          '#F23645',
          '#9C27B0',
          '#E91E63',
        ];
  return values.map((value, index) => {
    let color = colors[index % colors.length];
    if (tool === 'fibTime' || pitchfork) color = '#2962FF';
    if (tool === 'gannSquareFixed')
      color = [
        '#787B86',
        '#FF9800',
        '#00BCD4',
        '#4CAF50',
        '#F23645',
        '#9C27B0',
      ][index % 6];
    return { value, color, visible: true };
  });
}

export function appendFibonacciGeometry(
  drawing: IDrawing,
  projection: IDrawingProjection,
  geometry: IDrawingGeometry,
) {
  'worklet';
  const { handles, paths, labels } = geometry;
  const [a, second] = handles;
  const b = second ?? a;
  const c = handles[2] ?? b;
  const levels = (drawing.levels ?? getDefaultDrawingLevels(drawing.tool))
    .filter((level) => level.visible)
    .toSorted((left, right) => left.value - right.value);
  const levelColor = (level: IDrawingLevel) => {
    'worklet';
    return drawing.levels || drawing.color === DEFAULT_DRAWING_STYLE.color
      ? level.color
      : drawing.color;
  };
  const fill = (points: IScreenPoint[], color: string) => {
    'worklet';
    if (drawing.showBackground !== false)
      paths.push({
        points,
        fill: true,
        stroke: false,
        color,
        fillOpacity: drawing.fillOpacity ?? 0.2,
      });
  };
  const position = drawing.labelPosition ?? 'left';
  let align: 'left' | 'right' | 'center' = 'center';
  if (position === 'left') align = 'right';
  if (position === 'right') align = 'left';
  const label = (x: number, y: number, text: string, color: string) => {
    'worklet';
    if (drawing.showLabels !== false)
      labels.push({
        x,
        y: y + 4,
        text,
        color: drawing.textColor ?? color,
        fontSize: drawing.fontSize,
        align,
      });
  };
  const strokes: IDrawingPath[] = [];
  if (drawing.tool === 'fibTime') {
    for (const level of levels) {
      const x =
        a.x + (b.x - a.x) * (drawing.reverse ? -level.value : level.value);
      const color = levelColor(level);
      paths.push({
        points: [
          { x, y: 0 },
          { x, y: projection.layout.mainChartBottom },
        ],
        color,
      });
      label(
        x + 4,
        projection.layout.mainChartBottom - 12,
        String(level.value),
        color,
      );
    }
    paths.push({ points: [a, b], dashed: true, color: '#787B86', width: 1 });
    return;
  }
  if (drawing.tool === 'fibFan') {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const origin = drawing.reverse ? b : a;
    const target = drawing.reverse ? a : b;
    for (const axis of ['price', 'time'] as const) {
      let previous: IScreenPoint | undefined;
      for (const level of levels) {
        const ratio = 1 - level.value;
        const end =
          axis === 'price'
            ? { x: target.x, y: origin.y + (target.y - origin.y) * ratio }
            : { x: origin.x + (target.x - origin.x) * ratio, y: target.y };
        const color = levelColor(level);
        const path = extendDrawingLine(origin, end, projection, false, true);
        if (previous && path.length) {
          const scale =
            1 +
            (projection.layout.priceAxisX +
              projection.layout.mainChartBottom +
              Math.abs(origin.x) +
              Math.abs(origin.y)) /
              Math.max(1, Math.min(Math.abs(dx), Math.abs(dy)));
          fill(
            [
              origin,
              {
                x: origin.x + (previous.x - origin.x) * scale,
                y: origin.y + (previous.y - origin.y) * scale,
              },
              {
                x: origin.x + (end.x - origin.x) * scale,
                y: origin.y + (end.y - origin.y) * scale,
              },
            ],
            color,
          );
        }
        strokes.push({ points: path, color });
        strokes.push({
          points:
            axis === 'price'
              ? [{ x: origin.x, y: end.y }, end]
              : [{ x: end.x, y: origin.y }, end],
          color: '#787B86',
          width: 1,
          opacity: 0.4,
        });
        label(end.x + 4, end.y - 8, String(level.value), color);
        previous = end;
      }
    }
    paths.push(...strokes);
    return;
  }
  if (drawing.tool === 'fibChannel') {
    const baseY =
      b.x === a.x ? a.y : a.y + ((b.y - a.y) * (c.x - a.x)) / (b.x - a.x);
    const offset = (c.y - baseY) * (drawing.reverse ? -1 : 1);
    let previous: IScreenPoint[] | undefined;
    for (const level of levels) {
      const start = { x: a.x, y: a.y + offset * level.value };
      const end = { x: b.x, y: b.y + offset * level.value };
      const line = extendDrawingLine(
        start,
        end,
        projection,
        drawing.extendLeft ?? false,
        drawing.extendRight ?? false,
      );
      const color = levelColor(level);
      if (previous && line.length === 2)
        fill([...previous, line[1], line[0]], color);
      strokes.push({ points: line, color });
      let at = start;
      if (position === 'right') at = end;
      if (position === 'center')
        at = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      label(
        at.x + (position === 'left' ? -4 : 4),
        at.y,
        String(level.value),
        color,
      );
      previous = line.length === 2 ? line : undefined;
    }
    paths.push(...strokes);
    return;
  }
  const from = drawing.points[0].price;
  const to = drawing.points[1]?.price ?? from;
  const origin = drawing.points[2]?.price ?? to;
  const left = drawing.extendLeft ? 0 : Math.min(a.x, b.x, c.x);
  const right = drawing.extendRight
    ? projection.layout.priceAxisX
    : Math.max(a.x, b.x, c.x);
  let previousY: number | undefined;
  for (const level of levels) {
    const ratio = drawing.reverse ? 1 - level.value : level.value;
    const price =
      drawing.tool === 'fib'
        ? to + (from - to) * ratio
        : origin + (to - from) * (drawing.reverse ? -level.value : level.value);
    const y = drawingPointToScreen(
      { time: drawing.points[0].time, price },
      projection,
    ).y;
    const color = levelColor(level);
    if (previousY !== undefined)
      fill(
        [
          { x: left, y: previousY },
          { x: right, y: previousY },
          { x: right, y },
          { x: left, y },
        ],
        color,
      );
    strokes.push({
      points: [
        { x: left, y },
        { x: right, y },
      ],
      color,
    });
    const value =
      drawing.showPrices === false
        ? String(level.value)
        : `${level.value} (${formatDrawingNumber(price, projection.priceDecimalPlaces)})`;
    let labelX = (left + right) / 2;
    if (position === 'left') labelX = left - 4;
    if (position === 'right') labelX = right + 4;
    label(labelX, y, value, color);
    previousY = y;
  }
  paths.push(...strokes, {
    points: drawing.tool === 'fibExtension' ? [a, b, c] : [a, b],
    dashed: true,
    color: '#787B86',
    width: 1,
  });
}
