import {
  generateMatrix,
  getQRCodeDotCells,
} from '@onekeyhq/components/src/content/QRCode/QRCode.utils';

// Canvas twin of the dot renderer in the QRCode component. Share images on
// web and desktop are painted straight onto a 2D context instead of mounting
// the component, so the geometry has to be spelled out a second time here. It
// reads the module positions from the same helpers the component uses, so the
// two renderers cannot drift apart on anything but the drawing primitives.

const FINDER_RING_COUNT = 3;
const FINDER_MODULES = 7;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

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
    ecl?: 'L' | 'M' | 'Q' | 'H';
  },
) {
  const matrix = generateMatrix(value, ecl);
  const cellSize = size / matrix.length;

  ctx.save();
  ctx.fillStyle = lightColor;
  ctx.fillRect(originX, originY, size, size);

  // three finder patterns, drawn as nested rounded squares like the component
  const finderOrigins = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  finderOrigins.forEach(({ x, y }) => {
    const x1 = (matrix.length - FINDER_MODULES) * cellSize * x;
    const y1 = (matrix.length - FINDER_MODULES) * cellSize * y;
    for (let i = 0; i < FINDER_RING_COUNT; i += 1) {
      const box = cellSize * (FINDER_MODULES - i * 2);
      // same radii as the component; SVG clamps oversized radii on its own,
      // canvas does not, so clamp explicitly to keep the corners valid
      const radius = Math.min((i - 3) * -6 + (i === 0 ? 2 : 0), box / 2);
      ctx.fillStyle = i % 2 !== 0 ? lightColor : darkColor;
      drawRoundedRect(
        ctx,
        originX + x1 + cellSize * i,
        originY + y1 + cellSize * i,
        box,
        box,
        radius,
      );
      ctx.fill();
    }
  });

  ctx.fillStyle = darkColor;
  getQRCodeDotCells({
    matrix,
    hasLogo: false,
    logoSize: 0,
    logoMargin: 0,
    cellSize,
  }).forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(
      originX + x * cellSize + cellSize / 2,
      originY + y * cellSize + cellSize / 2,
      cellSize / 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
  ctx.restore();
}
