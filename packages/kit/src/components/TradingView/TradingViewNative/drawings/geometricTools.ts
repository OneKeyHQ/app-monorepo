import { formatDrawingNumber } from './measurement';
import { drawingArrowHead } from './pathUtils';

import type { IDrawingGeometry } from './geometry';
import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

function ellipse(
  center: IScreenPoint,
  rx: number,
  ry: number,
  start = 0,
  sweep = Math.PI * 2,
) {
  'worklet';
  return Array.from({ length: 97 }, (_, i) => ({
    x: center.x + rx * Math.cos(start + (sweep * i) / 96),
    y: center.y + ry * Math.sin(start + (sweep * i) / 96),
  }));
}

export function appendGeometricTools(
  drawing: IDrawing,
  projection: IDrawingProjection,
  geometry: IDrawingGeometry,
) {
  'worklet';
  const { handles, paths, labels } = geometry;
  const [a, second, third, fourth] = handles;
  if (!a) return false;
  const b = second ?? a;
  const c = third ?? b;
  const d = fourth ?? c;
  const filled = {
    fill: drawing.showBackground !== false,
    stroke: drawing.showBorder !== false,
    fillColor: drawing.fillColor,
    fillOpacity: drawing.fillOpacity ?? 0.2,
  };
  switch (drawing.tool) {
    case 'path':
    case 'polyline':
      paths.push({ points: [...handles] });
      if (drawing.tool === 'path' && handles.length > 1)
        paths.push({
          points: drawingArrowHead(
            handles[handles.length - 2],
            handles[handles.length - 1],
            10,
          ),
        });
      return true;
    case 'circle': {
      const radius = Math.hypot(b.x - a.x, b.y - a.y);
      paths.push({ points: ellipse(a, radius, radius), ...filled });
      return true;
    }
    case 'rotatedRectangle': {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = dx * dx + dy * dy;
      const offset = length
        ? ((c.x - a.x) * -dy + (c.y - a.y) * dx) / length
        : 0;
      paths.push({
        points: [
          a,
          b,
          { x: b.x - dy * offset, y: b.y + dx * offset },
          { x: a.x - dy * offset, y: a.y + dx * offset },
          a,
        ],
        ...filled,
      });
      return true;
    }
    case 'curve':
    case 'doubleCurve': {
      const curve = Array.from({ length: 65 }, (_, i) => {
        const t = i / 64;
        const u = 1 - t;
        if (drawing.tool === 'curve')
          return {
            x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
            y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
          };
        return {
          x:
            u ** 3 * a.x +
            3 * u * u * t * c.x +
            3 * u * t * t * d.x +
            t ** 3 * b.x,
          y:
            u ** 3 * a.y +
            3 * u * u * t * c.y +
            3 * u * t * t * d.y +
            t ** 3 * b.y,
        };
      });
      paths.push({ points: curve });
      return true;
    }
    case 'arc': {
      const determinant =
        2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(determinant) < 0.001) {
        paths.push({ points: [a, b] });
        return true;
      }
      const aa = a.x * a.x + a.y * a.y;
      const bb = b.x * b.x + b.y * b.y;
      const cc = c.x * c.x + c.y * c.y;
      const center = {
        x:
          (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) /
          determinant,
        y:
          (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) /
          determinant,
      };
      const start = Math.atan2(a.y - center.y, a.x - center.x);
      const end = Math.atan2(b.y - center.y, b.x - center.x);
      const middle = Math.atan2(c.y - center.y, c.x - center.x);
      const tau = Math.PI * 2;
      let sweep = (end - start + tau) % tau;
      if ((middle - start + tau) % tau > sweep) sweep -= tau;
      const radius = Math.hypot(a.x - center.x, a.y - center.y);
      paths.push({ points: ellipse(center, radius, radius, start, sweep) });
      return true;
    }
    case 'arrowMarker': {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const width = Math.min(length / 4, 5 + drawing.width * 2);
      const head = Math.min(length * 0.5, width * 3);
      const points = [
        [0, -width / 2],
        [length - head, -width / 2],
        [length - head, -width * 1.5],
        [length, 0],
        [length - head, width * 1.5],
        [length - head, width / 2],
        [0, width / 2],
        [0, -width / 2],
      ].map(([x, y]) => ({
        x: a.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: a.y + x * Math.sin(angle) + y * Math.cos(angle),
      }));
      paths.push({
        points,
        fill: true,
        fillOpacity: drawing.fillOpacity ?? 1,
        stroke: false,
      });
      return true;
    }
    case 'arrowUp':
    case 'arrowDown':
    case 'arrowLeft':
    case 'arrowRight': {
      const angles = {
        arrowUp: -Math.PI / 2,
        arrowDown: Math.PI / 2,
        arrowLeft: Math.PI,
        arrowRight: 0,
      };
      const angle = angles[drawing.tool];
      const size = (drawing.fontSize ?? 24) / 2;
      paths.push({
        points: [
          [0, 0],
          [-size, -size],
          [-size, -size / 3],
          [-size * 2, -size / 3],
          [-size * 2, size / 3],
          [-size, size / 3],
          [-size, size],
          [0, 0],
        ].map(([x, y]) => ({
          x: a.x + x * Math.cos(angle) - y * Math.sin(angle),
          y: a.y + x * Math.sin(angle) + y * Math.cos(angle),
        })),
        fill: true,
        fillOpacity: drawing.fillOpacity ?? 1,
        stroke: false,
      });
      return true;
    }
    case 'anchoredText':
    case 'note':
    case 'priceNote':
    case 'pin':
    case 'table':
    case 'comment':
    case 'signpost':
    case 'flag': {
      let anchor = a;
      if (
        drawing.anchor &&
        (drawing.tool === 'anchoredText' || drawing.tool === 'table')
      ) {
        anchor = {
          x: drawing.anchor.x * projection.layout.priceAxisX,
          y: drawing.anchor.y * projection.layout.mainChartBottom,
        };
        geometry.handles = [anchor];
      }
      const content = drawing.text ?? 'Text';
      if (drawing.tool === 'table') {
        const rows = content.split('\n').map((row) => row.split('\t'));
        const columns = Math.max(...rows.map((row) => row.length));
        const fontSize = drawing.fontSize ?? 14;
        const cellWidth = Math.max(
          56,
          ...rows.flat().map((cell) => cell.length * fontSize * 0.6 + 16),
        );
        const cellHeight = fontSize + 16;
        rows.forEach((row, rowIndex) =>
          Array.from({ length: columns }, (_, colIndex) => {
            const x = anchor.x + colIndex * cellWidth;
            const y = anchor.y + rowIndex * cellHeight;
            paths.push({
              points: [
                { x, y },
                { x: x + cellWidth, y },
                { x: x + cellWidth, y: y + cellHeight },
                { x, y: y + cellHeight },
                { x, y },
              ],
              ...filled,
            });
            labels.push({
              x: x + 8,
              y: y + 6,
              text: row[colIndex] ?? '',
              fontSize,
              verticalAlign: 'top',
              color: drawing.textColor ?? drawing.color,
            });
            return undefined;
          }),
        );
      } else if (drawing.tool === 'anchoredText')
        labels.push({
          ...anchor,
          text: content,
          fontSize: drawing.fontSize ?? 20,
          verticalAlign: 'top',
          color: drawing.textColor ?? drawing.color,
          background: drawing.showBackground
            ? (drawing.fillColor ?? drawing.color)
            : undefined,
          borderColor: drawing.showBorder ? drawing.color : undefined,
          borderWidth: drawing.width,
          padding: drawing.showBackground || drawing.showBorder ? 6 : 0,
          opacity: drawing.fillOpacity ?? 1,
        });
      else if (drawing.tool === 'flag') {
        paths.push(
          { points: [a, { x: a.x, y: a.y - 40 }] },
          {
            points: [
              { x: a.x, y: a.y - 40 },
              { x: a.x + 36, y: a.y - 32 },
              { x: a.x, y: a.y - 24 },
            ],
            fill: true,
            fillOpacity: 1,
          },
        );
        if (drawing.text)
          labels.push({
            x: a.x + 40,
            y: a.y - 28,
            text: content,
            fontSize: drawing.fontSize,
            color: drawing.textColor ?? drawing.color,
          });
      } else {
        const target = second ?? { x: a.x + 20, y: a.y - 40 };
        let labelText = content;
        if (drawing.tool === 'priceNote')
          labelText = `${formatDrawingNumber(drawing.points[0].price, projection.priceDecimalPlaces)}\n${content}`;
        labels.push({
          ...target,
          text: labelText,
          fontSize: drawing.fontSize ?? 14,
          verticalAlign: 'bottom',
          align: 'center',
          padding: 8,
          radius: drawing.tool === 'pin' ? 12 : 4,
          color: drawing.textColor ?? '#FFFFFF',
          background:
            drawing.showBackground === false
              ? undefined
              : (drawing.fillColor ?? drawing.color),
          opacity: drawing.fillOpacity ?? 1,
          pointer: drawing.tool === 'note' ? undefined : a,
          borderColor: drawing.showBorder === false ? undefined : drawing.color,
        });
        if (drawing.tool === 'signpost') paths.push({ points: [a, target] });
      }
      return true;
    }
    case 'icon':
    case 'emoji':
    case 'sticker': {
      const size = drawing.fontSize ?? 32;
      const stamp =
        drawing.stamp ?? (drawing.tool === 'icon' ? 'star' : 'smile');
      const radius = size / 2;
      if (stamp === 'smile') {
        paths.push({
          points: ellipse(a, radius, radius),
          fill: true,
          fillColor: drawing.fillColor ?? '#FFEB3B',
          fillOpacity: 1,
          color: '#363A45',
          width: 1,
        });
        for (const offset of [-0.35, 0.35])
          paths.push({
            points: ellipse(
              { x: a.x + radius * offset, y: a.y - radius * 0.25 },
              1.5,
              2,
            ),
            fill: true,
            fillOpacity: 1,
            color: '#363A45',
          });
        paths.push({
          points: ellipse(
            { x: a.x, y: a.y },
            radius * 0.55,
            radius * 0.55,
            0.2,
            Math.PI - 0.4,
          ),
          color: '#363A45',
          width: 1.5,
        });
      } else if (stamp === 'star' || stamp === 'heart') {
        const points = Array.from(
          { length: stamp === 'star' ? 11 : 65 },
          (_, i) => {
            if (stamp === 'star') {
              const angle = (i * Math.PI) / 5 - Math.PI / 2;
              const r = i % 2 ? radius * 0.45 : radius;
              return {
                x: a.x + Math.cos(angle) * r,
                y: a.y + Math.sin(angle) * r,
              };
            }
            const t = (i * Math.PI * 2) / 64;
            return {
              x: a.x + radius * Math.sin(t) ** 3,
              y:
                a.y -
                (radius *
                  (13 * Math.cos(t) -
                    5 * Math.cos(2 * t) -
                    2 * Math.cos(3 * t) -
                    Math.cos(4 * t))) /
                  16,
            };
          },
        );
        paths.push({
          points,
          fill: true,
          fillOpacity: drawing.fillOpacity ?? 1,
          stroke: false,
        });
      } else if (stamp === 'check')
        paths.push({
          points: [
            { x: a.x - radius, y: a.y },
            { x: a.x - radius / 3, y: a.y + radius * 0.7 },
            { x: a.x + radius, y: a.y - radius * 0.7 },
          ],
          width: drawing.width + 2,
        });
      else if (stamp === 'cross')
        paths.push(
          {
            points: [
              { x: a.x - radius, y: a.y - radius },
              { x: a.x + radius, y: a.y + radius },
            ],
          },
          {
            points: [
              { x: a.x - radius, y: a.y + radius },
              { x: a.x + radius, y: a.y - radius },
            ],
          },
        );
      else {
        const sign = stamp === 'arrowUp' ? -1 : 1;
        const end = { x: a.x, y: a.y + sign * radius };
        const start = { x: a.x, y: a.y - sign * radius };
        paths.push(
          { points: [start, end] },
          { points: drawingArrowHead(start, end, radius) },
        );
      }
      return true;
    }
    default:
      return false;
  }
}
