import {
  type IQRCodeErrorCorrectionLevel,
  QR_CODE_DOT_RADIUS_RATIO,
  ensureQRCodeUtilLoaded,
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeFinderRings,
  getQRCodeLogoClearArenaSize,
} from '@onekeyhq/components/src/content/QRCode/QRCode.utils';

// Canvas twin of the dot renderer in the QRCode component. Share images on
// web and desktop are painted straight onto a 2D context instead of mounting
// the component, so the drawing calls have to be written a second time here.
// Every position, size and radius comes from the same helpers the component
// uses, so only the primitives differ: <Rect>/<Path> there, roundRect/arc here.

const PLATE_COLOR = '#FFFFFF';

// One rounded-rect path builder for the finder rings and the share-image
// cards that call this module. Kept here rather than pulling the equivalent
// out of shared/utils/imageUtils: that module statically imports
// expo-file-system, expo-image-manipulator and a canvas blur library, which
// is a lot of graph to drag into three share-image screens for one path.
export function drawRoundedRect(
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
    return;
  }
  // roundRect clamps an oversized radius on its own; the manual fallback
  // has to do it by hand or the corners self-intersect
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  ctx.moveTo(x + r, y);
  ctx.lineTo(right - r, y);
  ctx.quadraticCurveTo(right, y, right, y + r);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right, bottom, right - r, bottom);
  ctx.lineTo(x + r, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function drawDotQRCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  {
    value,
    x: originX,
    y: originY,
    size,
    darkColor = '#000000',
    // node-qrcode defaulted to 'M' for the callers that never named a level,
    // so this stays 'M' to keep their symbols the same size. Pass 'H' where
    // something is drawn on top of the code.
    ecl = 'M',
    clearPlateSize,
  }: {
    value: string;
    x: number;
    y: number;
    size: number;
    darkColor?: string;
    ecl?: IQRCodeErrorCorrectionLevel;
    // Diameter, in px, of a plate the caller will paint over the center of
    // the code. Dots under it are dropped the same way the on-screen
    // component clears them, so the plate edge never slices dots in half.
    clearPlateSize?: number;
  },
) {
  // resolve the lazily-loaded encoder before touching the context, so the
  // save/restore pair below never spans an await
  await ensureQRCodeUtilLoaded();
  const matrix = generateMatrix(value, ecl);
  const cellSize = size / matrix.length;
  const dotRadius = cellSize * QR_CODE_DOT_RADIUS_RATIO;

  ctx.save();
  try {
    ctx.fillStyle = PLATE_COLOR;
    ctx.fillRect(originX, originY, size, size);

    getQRCodeFinderRings({ matrixSize: matrix.length, cellSize }).forEach(
      (ring) => {
        ctx.fillStyle = ring.isDark ? darkColor : PLATE_COLOR;
        drawRoundedRect(
          ctx,
          originX + ring.x,
          originY + ring.y,
          ring.size,
          ring.size,
          ring.radius,
        );
        ctx.fill();
      },
    );

    const clearArenaModules = clearPlateSize
      ? getQRCodeLogoClearArenaSize({
          logoSize: clearPlateSize,
          logoMargin: 0,
          cellSize,
        })
      : 0;
    // one path for every dot: they share a fill and never overlap, so a single
    // fill() is equivalent to one per module and far cheaper
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    getQRCodeDotCells({ matrix, clearArenaModules }).forEach(({ x, y }) => {
      const cx = originX + x * cellSize + cellSize / 2;
      const cy = originY + y * cellSize + cellSize / 2;
      // move first, otherwise arc() joins each circle to the previous one
      ctx.moveTo(cx + dotRadius, cy);
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
    });
    ctx.fill();
  } finally {
    // callers catch draw failures and carry on painting the rest of the card,
    // so the context has to come back balanced even when this throws
    ctx.restore();
  }
}
