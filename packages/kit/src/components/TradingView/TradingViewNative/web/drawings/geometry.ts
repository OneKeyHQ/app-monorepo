import { getDrawingGeometry } from '../../drawings/geometry';
import {
  DEFAULT_DRAWING_FONT_SIZE,
  isFreehandTool,
} from '../../drawings/model';

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
      context.globalAlpha = path.opacity ?? 1;
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
        context.globalAlpha = 0.12;
        context.fill();
        context.globalAlpha = 1;
      }
      context.stroke();
    }
    for (const label of geometry.labels) {
      const fontSize = label.fontSize ?? DEFAULT_DRAWING_FONT_SIZE;
      context.font = `${fontSize}px sans-serif`;
      context.fillStyle = background;
      context.globalAlpha = 0.9;
      context.fillRect(
        label.x - 3,
        label.y - fontSize - 1,
        context.measureText(label.text).width + 6,
        fontSize + 6,
      );
      context.globalAlpha = 1;
      context.fillStyle = drawing.color;
      context.fillText(label.text, label.x, label.y);
    }
    if (
      (drawing.id === selectedId || selectedIds.includes(drawing.id)) &&
      !drawing.locked
    ) {
      context.globalAlpha = 1;
      context.setLineDash([]);
      context.lineWidth = 1.5;
      context.strokeStyle = drawing.color;
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
}
