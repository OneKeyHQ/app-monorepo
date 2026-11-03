// cspell:ignore xabcd
import { ADDITIONAL_DRAWING_TOOLS } from './additionalTools';
import { extendDrawingLine } from './pathUtils';

import type { IDrawingGeometry } from './geometry';
import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

const PATTERN_LABELS = {
  xabcd: ['X', 'A', 'B', 'C', 'D'],
  cypher: ['X', 'A', 'B', 'C', 'D'],
  abcd: ['A', 'B', 'C', 'D'],
  trianglePattern: ['A', 'B', 'C', 'D'],
  headShoulders: ['', 'Left Shoulder', '', 'Head', '', 'Right Shoulder', ''],
  threeDrives: ['0', '1', 'A', '2', 'B', '3'],
  elliottImpulse: ['0', '1', '2', '3', '4', '5'],
  elliottCorrection: ['0', 'A', 'B', 'C'],
  elliottTriangle: ['0', 'A', 'B', 'C', 'D', 'E'],
  elliottDouble: ['0', 'W', 'X', 'Y'],
  elliottTriple: ['0', 'W', 'X', 'Y', 'X', 'Z'],
} as const;

export function appendPatternGeometry(
  drawing: IDrawing,
  projection: IDrawingProjection,
  geometry: IDrawingGeometry,
) {
  'worklet';
  const names = PATTERN_LABELS[drawing.tool as keyof typeof PATTERN_LABELS];
  if (!names) return false;
  const { handles, paths, labels } = geometry;
  paths.push({ points: [...handles] });
  if (drawing.showLabels !== false)
    handles.forEach((point, index) => {
      const previous = handles[index - 1] ?? handles[index + 1] ?? point;
      const above = point.y <= previous.y;
      if (names[index])
        labels.push({
          ...point,
          y: point.y + (above ? -10 : 10),
          text: names[index],
          color: drawing.textColor ?? drawing.color,
          fontSize: drawing.fontSize ?? 14,
          align: 'center',
          verticalAlign: above ? 'bottom' : 'top',
        });
    });
  const fillTriangle = (points: IScreenPoint[]) => {
    'worklet';
    paths.push({
      points: [...points, points[0]],
      fill: drawing.showBackground !== false,
      fillOpacity: drawing.fillOpacity ?? 0.15,
      dashed: true,
      width: 1,
    });
  };
  const ratio = (a: number, b: number, c: number) => {
    'worklet';
    const first = drawing.points[a];
    const second = drawing.points[b];
    const third = drawing.points[c];
    if (
      !first ||
      !second ||
      !third ||
      first.price === second.price ||
      drawing.showLabels === false
    )
      return;
    labels.push({
      x: (handles[a].x + handles[c].x) / 2,
      y: (handles[a].y + handles[c].y) / 2 - 5,
      align: 'center',
      text: Math.abs(
        (third.price - second.price) / (second.price - first.price),
      ).toFixed(3),
      color: drawing.color,
      fontSize: drawing.fontSize,
    });
  };
  if (drawing.tool === 'xabcd' || drawing.tool === 'cypher') {
    if (handles.length >= 3) {
      fillTriangle(handles.slice(0, 3));
      ratio(0, 1, 2);
    }
    if (handles.length >= 5) {
      fillTriangle(handles.slice(2, 5));
      ratio(2, 3, 4);
      paths.push(
        { points: [handles[1], handles[3]], dashed: true, width: 1 },
        { points: [handles[0], handles[4]], dashed: true, width: 1 },
      );
      ratio(1, 2, 3);
    }
  } else if (drawing.tool === 'headShoulders' && handles.length >= 5) {
    paths.push({
      points: extendDrawingLine(handles[2], handles[4], projection, true, true),
      dashed: true,
      width: 1,
    });
    if (handles.length === 7)
      paths.push({
        points: [...handles, handles[0]],
        fill: drawing.showBackground !== false,
        fillOpacity: drawing.fillOpacity ?? 0.1,
        stroke: false,
      });
  } else if (drawing.tool === 'trianglePattern' && handles.length === 4) {
    paths.push({
      points: [handles[0], handles[2], handles[3], handles[1], handles[0]],
      fill: drawing.showBackground !== false,
      fillOpacity: drawing.fillOpacity ?? 0.15,
      width: 1,
    });
  } else if (
    ADDITIONAL_DRAWING_TOOLS[
      drawing.tool as keyof typeof ADDITIONAL_DRAWING_TOOLS
    ]?.group === 'Patterns'
  ) {
    for (let index = 0; index + 2 < handles.length; index += 1) {
      paths.push({
        points: [handles[index], handles[index + 2]],
        dashed: true,
        width: 1,
      });
      ratio(index, index + 1, index + 2);
    }
  }
  return true;
}
