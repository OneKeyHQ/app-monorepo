import { getDrawingAxisGeometry } from '../../drawings/axisGeometry';
import { getDrawingGeometry } from '../../drawings/geometry';
import {
  getDrawingLabelBackground,
  getDrawingLabelLayout,
} from '../../drawings/labelLayout';
import { isFreehandTool } from '../../drawings/model';

import type { IDrawing, IDrawingProjection } from '../../drawings/model';
export * from '../../drawings/geometry';

export function drawChartDrawings(
  context: CanvasRenderingContext2D,
  drawings: IDrawing[],
  projection: IDrawingProjection,
  selectedId: string | null,
  background: string,
  selectedIds: readonly string[] = [],
) {
  context.save();
  context.beginPath();
  context.rect(
    0,
    0,
    projection.layout.priceAxisX,
    projection.layout.mainChartBottom,
  );
  context.clip();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  for (const drawing of drawings.filter((item) => !item.hidden)) {
    const geometry = getDrawingGeometry(drawing, projection);
    context.globalAlpha = 1;
    context.lineWidth = drawing.width;
    for (const path of geometry.paths.filter((item) => item.points.length)) {
      context.strokeStyle = path.color ?? drawing.color;
      context.fillStyle = path.color ?? drawing.color;
      context.lineWidth = path.width ?? drawing.width;
      context.globalAlpha = path.opacity ?? drawing.opacity ?? 1;
      let dash: number[] = [];
      if (path.dashed || drawing.dash === 'dashed') dash = [6, 4];
      else if (drawing.dash === 'dotted') dash = [1, 4];
      context.setLineDash(dash);
      context.beginPath();
      path.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      if (path.fill) {
        context.closePath();
        context.fillStyle =
          path.fillColor ?? path.color ?? drawing.fillColor ?? drawing.color;
        context.globalAlpha *= path.fillOpacity ?? drawing.fillOpacity ?? 0.2;
        context.fill();
        context.globalAlpha = path.opacity ?? drawing.opacity ?? 1;
      }
      if (path.stroke !== false) context.stroke();
    }
    for (const label of geometry.labels) {
      const layout = getDrawingLabelLayout(label, projection, (text, size) => {
        context.font = `${size}px sans-serif`;
        return context.measureText(text).width;
      });
      context.setLineDash([]);
      context.globalAlpha = label.opacity ?? 1;
      if (label.background || label.borderColor) {
        context.beginPath();
        getDrawingLabelBackground(label, layout).forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.closePath();
        if (label.background) {
          context.fillStyle = label.background;
          context.fill();
        }
        if (label.borderColor) {
          context.strokeStyle = label.borderColor;
          context.lineWidth = label.borderWidth ?? 1;
          context.stroke();
        }
      }
      context.globalAlpha = 1;
      context.fillStyle = label.color ?? drawing.textColor ?? drawing.color;
      context.font = `${layout.fontSize}px sans-serif`;
      context.textAlign = label.align === 'center' ? 'center' : 'left';
      const textX =
        label.align === 'center'
          ? layout.x + layout.width / 2
          : layout.x + layout.padding;
      layout.lines.forEach((line, index) => {
        context.fillText(
          line,
          textX,
          layout.y +
            layout.padding +
            layout.fontSize +
            index * layout.lineHeight,
        );
      });
    }
    if (
      (drawing.id === selectedId || selectedIds.includes(drawing.id)) &&
      !drawing.locked
    ) {
      context.globalAlpha = 1;
      context.setLineDash([]);
      context.lineWidth = 1.5;
      context.strokeStyle = '#2962FF';
      context.fillStyle = background;
      if (isFreehandTool(drawing.tool)) {
        const [a, , b] = geometry.handles;
        context.setLineDash([3, 3]);
        context.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        context.setLineDash([]);
      }
      for (const point of geometry.handles) {
        context.beginPath();
        context.arc(point.x, point.y, 4, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }
  }
  context.restore();
  const axes = getDrawingAxisGeometry(
    { drawings, selectedId, selectedIds },
    projection,
  );
  if (axes.rectangles.length) {
    context.save();
    context.fillStyle = '#2962FF';
    for (const rect of axes.rectangles) {
      context.globalAlpha = rect.opacity;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    context.globalAlpha = 1;
    context.fillStyle = '#FFFFFF';
    context.font = '11px sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    for (const label of axes.labels)
      context.fillText(label.text, label.x, label.y);
    context.restore();
  }
}
