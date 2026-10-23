import { formatTradingViewNativeCrosshairTime } from '../utils/chartLayout';

import { estimateDrawingTextWidth } from './labelLayout';
import { formatDrawingNumber, getDrawingPricePrecision } from './measurement';
import {
  drawingPointToScreen,
  indexAtTime,
  isFreehandTool,
  timeAtIndex,
} from './model';

import type { IDrawingProjection } from './model';
import type { IDrawingRenderState } from './useChartDrawings';

type IAxisRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};
type IAxisText = { x: number; y: number; text: string };
type IAxisLabel = { position: number; size: number; text: string };

function placeLabels(items: IAxisLabel[], available: number) {
  'worklet';
  const sorted = items.toSorted((a, b) => a.position - b.position);
  const positions: number[] = [];
  sorted.forEach((item, index) => {
    positions.push(
      Math.max(
        0,
        item.position - item.size / 2,
        index ? positions[index - 1] + sorted[index - 1].size + 2 : 0,
      ),
    );
  });
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    const end =
      index < positions.length - 1 ? positions[index + 1] - 2 : available;
    positions[index] = Math.max(
      0,
      Math.min(positions[index], end - sorted[index].size),
    );
  }
  return sorted.map((item, index) => ({ ...item, position: positions[index] }));
}

export function getDrawingAxisGeometry(
  state: IDrawingRenderState,
  projection: IDrawingProjection,
) {
  'worklet';
  const rectangles: IAxisRectangle[] = [];
  const labels: IAxisText[] = [];
  const result = { rectangles, labels };
  if (!projection.size) return result;
  const drawing =
    state.drawings.findLast(
      (item) => !item.hidden && item.tool === 'measure',
    ) ??
    state.drawings.find((item) => !item.hidden && item.id === state.selectedId);
  if (
    !drawing ||
    drawing.anchor ||
    isFreehandTool(drawing.tool) ||
    !drawing.points.length
  )
    return result;
  const { width, height } = projection.size;
  const { priceAxisX, mainChartBottom, timeAxisY } = projection.layout;
  const anchors =
    drawing.points.length <= 8
      ? drawing.points
      : [drawing.points[0], drawing.points[drawing.points.length - 1]];
  const points = anchors.map((point) => ({
    ...drawingPointToScreen(point, projection),
    ...point,
  }));
  if (projection.showPriceAxis !== false && width > priceAxisX) {
    const top = Math.max(0, Math.min(...points.map((point) => point.y)));
    const bottom = Math.min(
      mainChartBottom,
      Math.max(...points.map((point) => point.y)),
    );
    if (bottom > top)
      rectangles.push({
        x: priceAxisX,
        y: top,
        width: width - priceAxisX,
        height: bottom - top,
        opacity: 0.15,
      });
    const prices = new Set<string>();
    const items: IAxisLabel[] = [];
    for (const point of points) {
      const text = formatDrawingNumber(
        point.price,
        getDrawingPricePrecision(projection),
      );
      if (point.y >= 0 && point.y <= mainChartBottom && !prices.has(text)) {
        prices.add(text);
        items.push({ position: point.y, size: 20, text });
      }
    }
    for (const item of placeLabels(items, mainChartBottom)) {
      const labelWidth = Math.min(
        width,
        Math.max(
          width - priceAxisX,
          estimateDrawingTextWidth(item.text, 11) + 8,
        ),
      );
      const x = width - labelWidth;
      rectangles.push({
        x,
        y: item.position,
        width: labelWidth,
        height: 20,
        opacity: 1,
      });
      labels.push({ x: x + 4, y: item.position + 14, text: item.text });
    }
  }
  const axisHeight = Math.min(24, height - timeAxisY);
  if (axisHeight > 0) {
    const left = Math.max(0, Math.min(...points.map((point) => point.x)));
    const right = Math.min(
      priceAxisX,
      Math.max(...points.map((point) => point.x)),
    );
    if (right > left)
      rectangles.push({
        x: left,
        y: timeAxisY,
        width: right - left,
        height: axisHeight,
        opacity: 0.15,
      });
    const times = new Set<string>();
    const items: IAxisLabel[] = [];
    for (const point of points) {
      const time = timeAtIndex(
        Math.round(indexAtTime(point.time, projection)),
        projection,
      );
      const text = formatTradingViewNativeCrosshairTime(
        time,
        projection.interval,
      );
      if (point.x >= 0 && point.x <= priceAxisX && !times.has(text)) {
        times.add(text);
        items.push({
          position: point.x,
          size: Math.min(priceAxisX, estimateDrawingTextWidth(text, 11) + 10),
          text,
        });
      }
    }
    const sorted = items.toSorted((a, b) => a.position - b.position);
    const visible =
      sorted.length > 2 &&
      sorted.reduce((sum, item) => sum + item.size + 2, 0) > priceAxisX
        ? [sorted[0], sorted[sorted.length - 1]]
        : sorted;
    for (const item of placeLabels(visible, priceAxisX)) {
      rectangles.push({
        x: item.position,
        y: timeAxisY,
        width: item.size,
        height: axisHeight,
        opacity: 1,
      });
      labels.push({ x: item.position + 5, y: timeAxisY + 15, text: item.text });
    }
  }
  return result;
}
