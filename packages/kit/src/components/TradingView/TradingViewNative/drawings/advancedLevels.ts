import { getDefaultDrawingLevels } from './fibonacci';
import { extendDrawingLine } from './pathUtils';

import type { IDrawingGeometry, IDrawingPath } from './geometry';
import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

export function appendAdvancedLevels(
  drawing: IDrawing,
  projection: IDrawingProjection,
  geometry: IDrawingGeometry,
) {
  'worklet';
  if (
    ![
      'fibTrendTime',
      'fibCircles',
      'fibArcs',
      'fibWedge',
      'fibSpiral',
      'pitchfork',
      'schiffPitchfork',
      'modifiedPitchfork',
      'insidePitchfork',
      'pitchfan',
      'gannFan',
      'gannBox',
      'gannSquare',
      'gannSquareFixed',
      'cyclicLines',
      'timeCycles',
      'sineLine',
    ].includes(drawing.tool)
  )
    return false;
  const { handles, paths, labels } = geometry;
  const [a, second] = handles;
  if (!a) return false;
  const b = second ?? a;
  const c = handles[2] ?? b;
  const width = projection.layout.priceAxisX;
  const height = projection.layout.mainChartBottom;
  const levels = (drawing.levels ?? getDefaultDrawingLevels(drawing.tool))
    .filter((level) => level.visible)
    .map((level) => ({
      ...level,
      color:
        !drawing.levels && drawing.color !== '#2962FF'
          ? drawing.color
          : level.color,
    }));
  const label = (point: IScreenPoint, text: string, color?: string) => {
    'worklet';
    if (drawing.showLabels !== false)
      labels.push({
        ...point,
        text,
        color: drawing.textColor ?? color ?? drawing.color,
        fontSize: drawing.fontSize,
        align: 'center',
      });
  };
  const fill = (points: IScreenPoint[], color: string) => {
    'worklet';
    if (drawing.showBackground !== false)
      paths.push({
        points,
        fill: true,
        stroke: false,
        color,
        fillOpacity: drawing.fillOpacity ?? 0.15,
      });
  };
  const arc = (
    center: IScreenPoint,
    radius: number,
    start: number,
    sweep: number,
  ) => {
    'worklet';
    return Array.from({ length: 97 }, (_, i) => ({
      x: center.x + radius * Math.cos(start + (sweep * i) / 96),
      y: center.y + radius * Math.sin(start + (sweep * i) / 96),
    }));
  };
  if (drawing.tool === 'fibTrendTime') {
    let previous: number | undefined;
    const strokes: IDrawingPath[] = [];
    for (const level of levels) {
      const x = c.x + (b.x - a.x) * level.value * (drawing.reverse ? -1 : 1);
      if (previous !== undefined)
        fill(
          [
            { x: previous, y: 0 },
            { x, y: 0 },
            { x, y: height },
            { x: previous, y: height },
          ],
          level.color,
        );
      strokes.push({
        points: [
          { x, y: 0 },
          { x, y: height },
        ],
        color: level.color,
      });
      label({ x, y: height - 8 }, String(level.value), level.color);
      previous = x;
    }
    paths.push(...strokes, { points: [a, b, c], dashed: true, width: 1 });
    return true;
  }
  if (
    ['fibCircles', 'fibArcs', 'fibWedge', 'fibSpiral'].includes(drawing.tool)
  ) {
    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const start = Math.atan2(b.y - a.y, b.x - a.x);
    if (drawing.tool === 'fibSpiral') {
      const direction = drawing.reverse ? -1 : 1;
      paths.push({
        points: Array.from({ length: 385 }, (_, i) => {
          const turn = ((i / 384) * 8 - 6) * Math.PI;
          const r = radius * 1.618_033_988_75 ** (turn / (Math.PI / 2));
          return {
            x: a.x + r * Math.cos(start + direction * turn),
            y: a.y + r * Math.sin(start + direction * turn),
          };
        }),
      });
    } else {
      let sweep = Math.PI * 2;
      if (drawing.tool === 'fibArcs')
        sweep = drawing.reverse ? -Math.PI : Math.PI;
      if (drawing.tool === 'fibWedge') {
        sweep = Math.atan2(c.y - a.y, c.x - a.x) - start;
        if (sweep > Math.PI) sweep -= Math.PI * 2;
        if (sweep < -Math.PI) sweep += Math.PI * 2;
      }
      const offset = drawing.tool === 'fibArcs' ? start - Math.PI / 2 : start;
      let previous: IScreenPoint[] | undefined;
      const strokes: IDrawingPath[] = [];
      for (const level of levels
        .filter((item) => item.value > 0)
        .toSorted((left, right) => left.value - right.value)) {
        const points = arc(a, radius * level.value, offset, sweep);
        if (previous) fill([...points, ...previous.toReversed()], level.color);
        strokes.push({ points, color: level.color });
        label(
          points[Math.floor(points.length / 2)],
          String(level.value),
          level.color,
        );
        previous = points;
      }
      paths.push(...strokes);
    }
    paths.push({ points: [a, b], dashed: true, width: 1 });
    return true;
  }
  if (
    [
      'pitchfork',
      'schiffPitchfork',
      'modifiedPitchfork',
      'insidePitchfork',
      'pitchfan',
    ].includes(drawing.tool)
  ) {
    let origin = a;
    let median = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    if (drawing.tool === 'schiffPitchfork')
      origin = { x: a.x, y: (a.y + b.y) / 2 };
    if (
      drawing.tool === 'modifiedPitchfork' ||
      drawing.tool === 'insidePitchfork'
    )
      origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (drawing.tool === 'insidePitchfork') median = c;
    const ratios = levels;
    const strokes: IDrawingPath[] = [];
    let previous: IScreenPoint[] | undefined;
    for (const level of ratios
      .filter((item) => item.visible)
      .toSorted((left, right) => left.value - right.value)) {
      const point = {
        x: median.x + ((c.x - b.x) * level.value) / 2,
        y: median.y + ((c.y - b.y) * level.value) / 2,
      };
      const startPoint = drawing.tool === 'pitchfan' ? origin : point;
      const endPoint =
        drawing.tool === 'pitchfan'
          ? point
          : {
              x: point.x + median.x - origin.x,
              y: point.y + median.y - origin.y,
            };
      const line = extendDrawingLine(
        startPoint,
        endPoint,
        projection,
        drawing.extendLeft ?? false,
        drawing.extendRight !== false,
      );
      if (previous?.length === 2 && line.length === 2)
        fill([previous[0], previous[1], line[1], line[0]], level.color);
      strokes.push({
        points: line,
        color: level.color,
        dashed: Math.abs(level.value) === 0.5,
      });
      previous = line;
    }
    paths.push(
      ...strokes,
      { points: [a, b, c], dashed: true, width: 1 },
      {
        points: extendDrawingLine(
          origin,
          median,
          projection,
          drawing.extendLeft ?? false,
          drawing.extendRight !== false,
        ),
        width: 1,
      },
    );
    return true;
  }
  if (drawing.tool === 'gannSquareFixed') {
    const unit = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const directionX = b.x >= a.x ? 1 : -1;
    const directionY = (b.y >= a.y ? 1 : -1) * (drawing.reverse ? -1 : 1);
    const maximum = Math.max(1, ...levels.map((level) => level.value));
    const point = (x: number, y: number) => {
      'worklet';
      return { x: a.x + x * unit * directionX, y: a.y + y * unit * directionY };
    };
    const strokes: IDrawingPath[] = [];
    let previous = 0;
    for (const level of levels.toSorted(
      (left, right) => left.value - right.value,
    )) {
      if (level.value > previous)
        fill(
          [
            point(previous, 0),
            point(level.value, 0),
            point(level.value, maximum),
            point(previous, maximum),
          ],
          level.color,
        );
      strokes.push(
        {
          points: [point(level.value, 0), point(level.value, maximum)],
          color: level.color,
        },
        {
          points: [point(0, level.value), point(maximum, level.value)],
          color: level.color,
        },
      );
      if (drawing.showArcs !== false && level.value > 0)
        for (const factor of [1, Math.SQRT2]) {
          strokes.push({
            points: Array.from({ length: 97 }, (_, index) => {
              const angle = ((index / 96) * Math.PI) / 2;
              return point(
                level.value * factor * Math.cos(angle),
                level.value * factor * Math.sin(angle),
              );
            }),
            color: level.color,
          });
        }
      previous = level.value;
    }
    if (drawing.showFans !== false)
      for (const [index, ratio] of [
        1 / 8,
        1 / 4,
        1 / 3,
        1 / 2,
        1,
        2,
        3,
        4,
        8,
      ].entries()) {
        strokes.push({
          points: extendDrawingLine(
            a,
            point(1, ratio),
            projection,
            false,
            true,
          ),
          color:
            levels[index % Math.max(1, levels.length)]?.color ?? drawing.color,
        });
      }
    paths.push(...strokes);
    return true;
  }
  if (drawing.tool.startsWith('gann')) {
    if (drawing.tool === 'gannFan') {
      const ratios = levels;
      const strokes: IDrawingPath[] = [];
      let previous: IScreenPoint | undefined;
      for (const level of ratios.filter((item) => item.visible)) {
        const end = {
          x: b.x,
          y: a.y + (b.y - a.y) * level.value * (drawing.reverse ? -1 : 1),
        };
        const scale =
          1 +
          (width + height + Math.abs(a.x) + Math.abs(a.y)) /
            Math.max(1, Math.abs(b.x - a.x));
        const far = {
          x: a.x + (end.x - a.x) * scale,
          y: a.y + (end.y - a.y) * scale,
        };
        if (previous) fill([a, previous, far], level.color);
        strokes.push({
          points: extendDrawingLine(
            a,
            end,
            projection,
            drawing.extendLeft ?? false,
            true,
          ),
          color: level.color,
        });
        label(
          end,
          level.value >= 1
            ? `${level.value}/1`
            : `1/${Math.round(1 / level.value)}`,
          level.color,
        );
        previous = far;
      }
      paths.push(...strokes);
    } else {
      const ratios = levels;
      const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
      let previous: number | undefined;
      const strokes: IDrawingPath[] = [];
      for (const level of ratios.filter((item) => item.visible)) {
        const ratio = drawing.reverse ? 1 - level.value : level.value;
        const x = a.x + (b.x - a.x) * ratio;
        const y = a.y + (b.y - a.y) * ratio;
        if (previous !== undefined)
          fill(
            [
              { x: a.x, y: previous },
              { x: b.x, y: previous },
              { x: b.x, y },
              { x: a.x, y },
            ],
            level.color,
          );
        strokes.push(
          {
            points: [
              { x, y: a.y },
              { x, y: b.y },
            ],
            color: level.color,
          },
          {
            points: [
              { x: a.x, y },
              { x: b.x, y },
            ],
            color: level.color,
          },
        );
        label({ x, y: b.y + 16 }, String(level.value), level.color);
        label({ x: a.x - 16, y }, String(level.value), level.color);
        previous = y;
      }
      paths.push(...strokes);
      if (drawing.tool !== 'gannBox') {
        if (drawing.showFans !== false) {
          for (const [i, corner] of corners.entries()) {
            const opposite = corners[(i + 2) % 4];
            for (const fraction of [0.25, 0.5, 0.75, 1])
              paths.push(
                {
                  points: [
                    corner,
                    {
                      x: opposite.x,
                      y: corner.y + (opposite.y - corner.y) * fraction,
                    },
                  ],
                  width: 1,
                },
                {
                  points: [
                    corner,
                    {
                      x: corner.x + (opposite.x - corner.x) * fraction,
                      y: opposite.y,
                    },
                  ],
                  width: 1,
                },
              );
          }
        }
        if (drawing.tool === 'gannSquare' && drawing.showArcs !== false) {
          const radius = Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          for (const ratio of [0.25, 0.5, 0.75, 1])
            paths.push({
              points: arc(
                a,
                radius * ratio,
                Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 4,
                Math.PI / 2,
              ),
              width: 1,
            });
        }
      }
    }
    return true;
  }
  if (['cyclicLines', 'timeCycles', 'sineLine'].includes(drawing.tool)) {
    const period = Math.max(4, Math.abs(b.x - a.x));
    const start = Math.max(-200, Math.floor(-a.x / period));
    const end = Math.min(200, Math.ceil((width - a.x) / period));
    for (let i = start; i <= end; i += 1) {
      const x = a.x + i * period;
      if (drawing.tool === 'cyclicLines')
        paths.push({
          points: [
            { x, y: 0 },
            { x, y: height },
          ],
          dashed: i !== 0 && i !== 1,
        });
      else if (drawing.tool === 'timeCycles')
        paths.push({
          points: arc(
            { x: x + period / 2, y: a.y },
            period / 2,
            Math.PI,
            Math.PI,
          ),
        });
      else
        paths.push({
          points: Array.from({ length: 33 }, (_, step) => ({
            x: x + (period * step) / 32,
            y:
              a.y +
              Math.max(10, Math.abs(b.y - a.y)) *
                Math.sin((step / 32) * Math.PI * 2),
          })),
        });
    }
    return true;
  }
  return false;
}
