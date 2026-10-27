// cspell:ignore Alphaf Skia
import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';

import { getDrawingAxisGeometry } from '../drawings/axisGeometry';
import { getDrawingGeometry } from '../drawings/geometry';
import {
  getDrawingLabelBackground,
  getDrawingLabelLayout,
} from '../drawings/labelLayout';
import { isFreehandTool } from '../drawings/model';

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
        paint.setColor(
          Skia.Color(
            line.fillColor ?? line.color ?? drawing.fillColor ?? drawing.color,
          ),
        );
        paint.setAlphaf(
          (line.fillOpacity ?? drawing.fillOpacity ?? 0.2) *
            (line.opacity ?? drawing.opacity ?? 1),
        );
        canvas.drawPath(path, paint);
      }
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(line.width ?? drawing.width);
      paint.setColor(Skia.Color(line.color ?? drawing.color));
      paint.setAlphaf(line.opacity ?? drawing.opacity ?? 1);
      let dash: number[] = [];
      if (line.dashed || drawing.dash === 'dashed') dash = [6, 4];
      else if (drawing.dash === 'dotted') dash = [1, 4];
      const effect = dash.length ? Skia.PathEffect.MakeDash(dash, 0) : null;
      paint.setPathEffect(effect);
      if (line.stroke !== false) canvas.drawPath(path, paint);
      paint.setPathEffect(null);
      effect?.dispose();
      path.dispose();
    }
    paint.setStyle(PaintStyle.Fill);
    paint.setAlphaf(1);
    for (const label of geometry.labels) {
      const originalSize = font.getSize();
      const layout = getDrawingLabelLayout(label, projection, (text, size) => {
        'worklet';
        font.setSize(size);
        return font.measureText(text).width;
      });
      paint.setPathEffect(null);
      paint.setAlphaf(label.opacity ?? 1);
      if (label.background || label.borderColor) {
        const path = Skia.Path.Make();
        getDrawingLabelBackground(label, layout).forEach((point, index) => {
          if (index === 0) path.moveTo(point.x, point.y);
          else path.lineTo(point.x, point.y);
        });
        path.close();
        if (label.background) {
          paint.setStyle(PaintStyle.Fill);
          paint.setColor(Skia.Color(label.background));
          canvas.drawPath(path, paint);
        }
        if (label.borderColor) {
          paint.setStyle(PaintStyle.Stroke);
          paint.setStrokeWidth(label.borderWidth ?? 1);
          paint.setColor(Skia.Color(label.borderColor));
          canvas.drawPath(path, paint);
        }
        path.dispose();
      }
      paint.setAlphaf(1);
      paint.setStyle(PaintStyle.Fill);
      paint.setColor(
        Skia.Color(label.color ?? drawing.textColor ?? drawing.color),
      );
      layout.lines.forEach((line, index) => {
        const x =
          label.align === 'center'
            ? layout.x + (layout.width - font.measureText(line).width) / 2
            : layout.x + layout.padding;
        canvas.drawText(
          line,
          x,
          layout.y +
            layout.padding +
            layout.fontSize +
            index * layout.lineHeight,
          paint,
          font,
        );
      });
      // The chart axes share this font instance with drawing labels.
      font.setSize(originalSize);
    }
    if (
      !drawing.locked &&
      (state.selectedId === drawing.id ||
        state.selectedIds.includes(drawing.id))
    ) {
      paint.setColor(Skia.Color('#2962FF'));
      paint.setAlphaf(1);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(1.5);
      if (isFreehandTool(drawing.tool)) {
        const [a, , b] = geometry.handles;
        const effect = Skia.PathEffect.MakeDash([3, 3], 0);
        paint.setPathEffect(effect);
        canvas.drawRect(Skia.XYWHRect(a.x, a.y, b.x - a.x, b.y - a.y), paint);
        paint.setPathEffect(null);
        effect?.dispose();
      }
      for (const point of geometry.handles) {
        paint.setStyle(PaintStyle.Fill);
        paint.setColor(Skia.Color(background));
        canvas.drawCircle(point.x, point.y, 4, paint);
        paint.setStyle(PaintStyle.Stroke);
        paint.setColor(Skia.Color('#2962FF'));
        canvas.drawCircle(point.x, point.y, 4, paint);
      }
    }
  }
  canvas.restore();
  const axes = getDrawingAxisGeometry(state, projection);
  if (axes.rectangles.length) {
    const originalSize = font.getSize();
    font.setSize(11);
    paint.setStyle(PaintStyle.Fill);
    paint.setPathEffect(null);
    paint.setColor(Skia.Color('#2962FF'));
    for (const rect of axes.rectangles) {
      paint.setAlphaf(rect.opacity);
      canvas.drawRect(
        Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height),
        paint,
      );
    }
    paint.setAlphaf(1);
    paint.setColor(Skia.Color('#FFFFFF'));
    for (const label of axes.labels)
      canvas.drawText(label.text, label.x, label.y, paint, font);
    font.setSize(originalSize);
  }
  paint.dispose();
}
