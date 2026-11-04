import { DEFAULT_DRAWING_FONT_SIZE } from './model';

import type { IDrawingProjection, IScreenPoint } from './model';

export type IDrawingLabel = IScreenPoint & {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  background?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number;
  radius?: number;
  pointer?: IScreenPoint;
  keepInPane?: boolean;
};

export function estimateDrawingTextWidth(text: string, fontSize: number) {
  'worklet';
  let width = 0;
  for (const char of text) {
    if (" ilI.,:;!|'’.".includes(char)) width += 0.28;
    else if ('MW@%'.includes(char)) width += 0.85;
    else width += char.charCodeAt(0) > 255 ? 1 : 0.56;
  }
  return width * fontSize;
}

export function getDrawingLabelLayout(
  label: IDrawingLabel,
  projection: IDrawingProjection,
  measureText?: (text: string, size: number) => number,
) {
  'worklet';
  const fontSize = label.fontSize ?? DEFAULT_DRAWING_FONT_SIZE;
  const padding = label.padding ?? 0;
  const lineHeight = label.lineHeight ?? fontSize + 4;
  const lines = label.text.split('\n');
  const measure = measureText ?? estimateDrawingTextWidth;
  const width =
    Math.max(...lines.map((line) => measure(line, fontSize)), 1) + padding * 2;
  const height = lines.length * lineHeight + padding * 2;
  let x = label.x;
  if (label.align === 'center') x -= width / 2;
  else if (label.align === 'right') x -= width;
  let y = label.y - fontSize - padding;
  if (label.verticalAlign === 'top') y = label.y;
  else if (label.verticalAlign === 'middle') y = label.y - height / 2;
  else if (label.verticalAlign === 'bottom') y = label.y - height;
  if (label.keepInPane) {
    x = Math.max(4, Math.min(x, projection.layout.priceAxisX - width - 4));
    y = Math.max(
      4,
      Math.min(y, projection.layout.mainChartBottom - height - 4),
    );
  }
  return { x, y, width, height, fontSize, padding, lineHeight, lines };
}

export function getDrawingLabelBackground(
  label: IDrawingLabel,
  layout: ReturnType<typeof getDrawingLabelLayout>,
): IScreenPoint[] {
  'worklet';
  const { x, y, width, height } = layout;
  const right = x + width;
  const bottom = y + height;
  const radius = Math.min(label.radius ?? 0, width / 2, height / 2);
  const pointer = label.pointer;
  let side = -1;
  if (pointer) {
    if (pointer.y < y) side = 0;
    else if (pointer.y > bottom) side = 2;
    else if (pointer.x > right) side = 1;
    else if (pointer.x < x) side = 3;
  }
  const points: IScreenPoint[] = [];
  const corners = [
    { x: right - radius, y: y + radius },
    { x: right - radius, y: bottom - radius },
    { x: x + radius, y: bottom - radius },
    { x: x + radius, y: y + radius },
  ];
  for (let edge = 0; edge < 4; edge += 1) {
    if (pointer && edge === side) {
      const centerX = Math.max(
        x + radius + 5,
        Math.min(right - radius - 5, pointer.x),
      );
      const centerY = Math.max(
        y + radius + 5,
        Math.min(bottom - radius - 5, pointer.y),
      );
      if (side === 0)
        points.push({ x: centerX - 5, y }, pointer, { x: centerX + 5, y });
      else if (side === 1)
        points.push({ x: right, y: centerY - 5 }, pointer, {
          x: right,
          y: centerY + 5,
        });
      else if (side === 2)
        points.push({ x: centerX + 5, y: bottom }, pointer, {
          x: centerX - 5,
          y: bottom,
        });
      else points.push({ x, y: centerY + 5 }, pointer, { x, y: centerY - 5 });
    }
    const corner = corners[edge];
    for (let step = 0; step <= 4; step += 1) {
      const angle = ((edge - 1) * Math.PI) / 2 + (step * Math.PI) / 8;
      points.push({
        x: corner.x + radius * Math.cos(angle),
        y: corner.y + radius * Math.sin(angle),
      });
    }
  }
  return points;
}
