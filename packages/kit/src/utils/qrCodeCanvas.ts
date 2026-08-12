import {
  type IQRCodeErrorCorrectionLevel,
  QR_CODE_DOT_RADIUS_RATIO,
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeFinderRings,
} from '@onekeyhq/components/src/content/QRCode/QRCode.utils';
import { drawRoundRectPath } from '@onekeyhq/shared/src/utils/imageUtils';

// Canvas twin of the dot renderer in the QRCode component. Share images on
// web and desktop are painted straight onto a 2D context instead of mounting
// the component, so the drawing calls have to be written a second time here.
// Every position, size and radius comes from the same helpers the component
// uses, so only the primitives differ: <Rect>/<Path> there, roundRect/arc here.
export function drawDotQRCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  {
    value,
    x: originX,
    y: originY,
    size,
    darkColor = '#000000',
    lightColor = '#FFFFFF',
    ecl = 'H',
  }: {
    value: string;
    x: number;
    y: number;
    size: number;
    darkColor?: string;
    lightColor?: string;
    ecl?: IQRCodeErrorCorrectionLevel;
  },
) {
  const matrix = generateMatrix(value, ecl);
  const cellSize = size / matrix.length;

  ctx.save();
  ctx.fillStyle = lightColor;
  ctx.fillRect(originX, originY, size, size);

  getQRCodeFinderRings({ matrixSize: matrix.length, cellSize }).forEach(
    (ring) => {
      ctx.fillStyle = ring.isDark ? darkColor : lightColor;
      drawRoundRectPath(
        ctx,
        ring.size,
        ring.size,
        ring.radius,
        originX + ring.x,
        originY + ring.y,
      );
      ctx.fill();
    },
  );

  // one path for every dot: they share a fill and never overlap, so a single
  // fill() is equivalent to one per module and far cheaper
  const radius = cellSize * QR_CODE_DOT_RADIUS_RATIO;
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  getQRCodeDotCells({ matrix }).forEach(({ x, y }) => {
    const cx = originX + x * cellSize + cellSize / 2;
    const cy = originY + y * cellSize + cellSize / 2;
    // move first, otherwise arc() joins each circle to the previous one
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  });
  ctx.fill();
  ctx.restore();
}
