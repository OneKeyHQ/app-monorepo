// cspell:ignore Alphaf Skia
import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';

import { getDrawingGeometry } from '../drawings/geometry';
import { DEFAULT_DRAWING_FONT_SIZE, isFreehandTool } from '../drawings/model';

import type { IDrawingProjection } from '../drawings/model';
import type { IDrawingRenderState } from '../drawings/useChartDrawings';
import type { SkCanvas, SkFont } from '@shopify/react-native-skia';

export function drawNativeChartDrawings(
  canvas: SkCanvas,
  state: IDrawingRenderState,
  projection: IDrawingProjection,
  font: SkFont,
  background: string,
) {
  'worklet';
  canvas.save();
  canvas.clipRect(
    Skia.XYWHRect(
      0,
      0,
      projection.layout.priceAxisX,
      projection.layout.mainChartBottom,
    ),
    ClipOp.Intersect,
    true,
  );
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  for (const drawing of state.drawings.filter((item) => !item.hidden)) {
    const geometry = getDrawingGeometry(drawing, projection);
    for (const line of geometry.paths.filter(
      (path) => path.points.length > 0,
    )) {
      const path = Skia.Path.Make();
      line.points.forEach((point, index) => {
        if (index === 0) path.moveTo(point.x, point.y);
        else path.lineTo(point.x, point.y);
      });
      paint.setColor(Skia.Color(line.color ?? drawing.color));
      paint.setPathEffect(null);
      if (line.fill) {
        path.close();
        paint.setStyle(PaintStyle.Fill);
        paint.setAlphaf(0.12);
        canvas.drawPath(path, paint);
      }
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(line.width ?? drawing.width);
      paint.setAlphaf(line.opacity ?? 1);
      let dash: number[] = [];
      if (line.dashed || drawing.dash === 'dashed') dash = [6, 4];
      else if (drawing.dash === 'dotted') dash = [1, 4];
      const effect = dash.length ? Skia.PathEffect.MakeDash(dash, 0) : null;
      paint.setPathEffect(effect);
      canvas.drawPath(path, paint);
      paint.setPathEffect(null);
      effect?.dispose();
      path.dispose();
    }
    paint.setStyle(PaintStyle.Fill);
    paint.setAlphaf(1);
    for (const label of geometry.labels) {
      const fontSize = label.fontSize ?? DEFAULT_DRAWING_FONT_SIZE;
      const originalSize = font.getSize();
      font.setSize(fontSize);
      paint.setColor(Skia.Color(background));
      const width = font.measureText(label.text).width;
      canvas.drawRect(
        Skia.XYWHRect(
          label.x - 3,
          label.y - fontSize - 1,
          width + 6,
          fontSize + 6,
        ),
        paint,
      );
      paint.setColor(Skia.Color(drawing.color));
      canvas.drawText(label.text, label.x, label.y, paint, font);
      // The chart axes share this font instance with drawing labels.
      font.setSize(originalSize);
    }
    if (
      !drawing.locked &&
      (state.selectedId === drawing.id ||
        state.selectedIds.includes(drawing.id))
    ) {
      paint.setColor(Skia.Color(drawing.color));
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(1.5);
      if (isFreehandTool(drawing.tool)) {
        const [a, , b] = geometry.handles;
        canvas.drawRect(Skia.XYWHRect(a.x, a.y, b.x - a.x, b.y - a.y), paint);
      }
      for (const point of geometry.handles) {
        paint.setStyle(PaintStyle.Fill);
        paint.setColor(Skia.Color(background));
        canvas.drawCircle(point.x, point.y, 5, paint);
        paint.setStyle(PaintStyle.Stroke);
        paint.setColor(Skia.Color(drawing.color));
        canvas.drawCircle(point.x, point.y, 5, paint);
      }
    }
  }
  paint.dispose();
  canvas.restore();
}
