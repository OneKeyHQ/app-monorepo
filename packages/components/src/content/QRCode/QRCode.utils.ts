import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type QRCodeUtilType from 'qrcode';

export type IQRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

type IQRCodeUtil = typeof QRCodeUtilType;

// The encoder is ~70KB across 27 modules, and this module is reachable from
// the app's startup graph through the components barrel. Loading the library
// behind an async edge keeps it out of the native startup bundle; render
// paths gate on ensureQRCodeUtilLoaded() before calling the sync helpers.
let loadedQRCodeUtil: IQRCodeUtil | undefined;
let qrCodeUtilPromise: Promise<void> | undefined;

export function ensureQRCodeUtilLoaded() {
  if (!qrCodeUtilPromise) {
    qrCodeUtilPromise = import('qrcode').then((mod) => {
      // CJS/ESM interop shape differs across metro, vite and jest
      loadedQRCodeUtil = (mod.default ?? mod) as IQRCodeUtil;
    });
  }
  return qrCodeUtilPromise;
}

export function isQRCodeUtilLoaded() {
  return Boolean(loadedQRCodeUtil);
}

// The number of modules per side of a finder pattern.
const FINDER_MODULES = 7;
// Corner radius of each nested finder ring, outermost first, before clamping
// to the ring's own half-size.
const FINDER_RING_RADII = [20, 12, 6];

// Dot diameter as a fraction of a module.
export const QR_CODE_DOT_RADIUS_RATIO = 1 / 3;

// Encoding dominates the cost of rendering a code, and the same value is
// asked for more than once per render: the layout metrics need the matrix
// size, the renderer needs the matrix itself, and the animated air-gap path
// re-renders twice a second. One slot is enough — every caller within a
// render asks for the same value.
let lastMatrixKey = '';
let lastMatrix: number[][] = [];

export const generateMatrix = (
  value: string,
  errorCorrectionLevel: IQRCodeErrorCorrectionLevel,
): number[][] => {
  const key = `${errorCorrectionLevel}:${value}`;
  if (key === lastMatrixKey) {
    return lastMatrix;
  }
  if (!loadedQRCodeUtil) {
    throw new OneKeyLocalError(
      'QRCode encoder not loaded: await ensureQRCodeUtilLoaded() first',
    );
  }
  const arr: number[] = Array.prototype.slice.call(
    loadedQRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
    0,
  );
  const sqrt = Math.sqrt(arr.length);
  const matrix = arr.reduce((rows: number[][], entry, index) => {
    if (index % sqrt === 0) {
      rows.push([entry]);
    } else {
      rows[rows.length - 1].push(entry);
    }
    return rows;
  }, []);
  lastMatrixKey = key;
  lastMatrix = matrix;
  return matrix;
};

export function getQRCodeLayoutMetrics({
  value,
  ecl,
  size,
  padding,
  quietZoneModules,
}: {
  value: string;
  ecl: IQRCodeErrorCorrectionLevel;
  size: number;
  padding: number;
  quietZoneModules: number;
}) {
  const canvasSize = size + padding;
  const normalizedQuietZoneModules =
    Number.isFinite(quietZoneModules) && quietZoneModules > 0
      ? quietZoneModules
      : 0;
  const matrixSize = normalizedQuietZoneModules
    ? generateMatrix(value, ecl).length
    : 0;
  const qrCodeSize = normalizedQuietZoneModules
    ? (canvasSize * matrixSize) / (matrixSize + normalizedQuietZoneModules * 2)
    : size;
  const symbolScale = qrCodeSize / size;
  return {
    canvasSize,
    matrixSize,
    qrCodeSize,
    symbolScale,
    moduleSize: matrixSize ? qrCodeSize / matrixSize : 0,
    quietZoneSize: (canvasSize - qrCodeSize) / 2,
  };
}

// Diameter, in modules, of the area the dot renderer clears for the logo
// plate. It only has to reach one dot radius past the plate: any dot whose
// center is further out is drawn whole, and anything closer would be sliced
// by the plate edge. Rounding it up to whole modules, or padding it further,
// just grows the white disc past the plate and reads as extra logo padding.
export function getQRCodeLogoClearArenaSize({
  logoSize,
  logoMargin,
  cellSize,
}: {
  logoSize: number;
  logoMargin: number;
  cellSize: number;
}) {
  return (logoSize + logoMargin * 2) / cellSize + QR_CODE_DOT_RADIUS_RATIO * 2;
}

export const QR_CODE_PLATE_BORDER_RADIUS = 16;

// The symbol is centered on the white plate with `quietZoneSize` of plate
// showing on every side, and that margin is all a rounded corner has to eat
// into. A corner of radius r sweeps an arc centered at (r, r), so the symbol's
// own square corner at (q, q) only stays inside the rounded plate while
// sqrt(2) * (r - q) <= r, i.e. r <= (2 + sqrt(2)) * q. Past that the symbol
// pokes out of the corner, which is visible on the smallest share codes where
// the plate margin is only a couple of pixels.
export function getQRCodePlateBorderRadius(quietZoneSize: number) {
  return Math.min(
    QR_CODE_PLATE_BORDER_RADIUS,
    (2 + Math.SQRT2) * quietZoneSize,
  );
}

// The three finder patterns, as nested rounded squares alternating dark and
// light. They are drawn from these rects rather than from the matrix so both
// the SVG and the canvas renderer round their corners the same way; the radii
// are clamped here because SVG clamps an oversized `rx` on its own and canvas
// does not.
export function getQRCodeFinderRings({
  matrixSize,
  cellSize,
}: {
  matrixSize: number;
  cellSize: number;
}) {
  const rings: {
    x: number;
    y: number;
    size: number;
    radius: number;
    isDark: boolean;
  }[] = [];
  // top-left, top-right, bottom-left
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ].forEach(({ x, y }) => {
    const originX = (matrixSize - FINDER_MODULES) * cellSize * x;
    const originY = (matrixSize - FINDER_MODULES) * cellSize * y;
    FINDER_RING_RADII.forEach((ringRadius, ring) => {
      const size = cellSize * (FINDER_MODULES - ring * 2);
      rings.push({
        x: originX + cellSize * ring,
        y: originY + cellSize * ring,
        size,
        radius: Math.min(ringRadius, size / 2),
        isDark: ring % 2 === 0,
      });
    });
  });
  return rings;
}

// Dark modules the dot renderer has to draw, in matrix coordinates where
// x is the column and y is the row. The three finder patterns are excluded
// because they are drawn separately as rounded squares, and the modules under
// the logo are dropped so the logo plate does not sit on top of stray dots.
// The cleared area is a disc rather than a square block: the plate is round,
// and clearing a square leaves white corners around it that read as a square
// plate, since the cleared modules and the plate are both the plate color.
export function getQRCodeDotCells({
  matrix,
  clearArenaModules = 0,
}: {
  matrix: number[][];
  clearArenaModules?: number;
}) {
  const size = matrix.length;
  const clearCenter = size / 2;
  const clearRadius = clearArenaModules / 2;
  const clearRadiusSquared = clearRadius * clearRadius;
  const cells: { x: number; y: number }[] = [];
  matrix.forEach((row, y) => {
    const isFinderRow = y < FINDER_MODULES;
    const isBottomFinderRow = y >= size - FINDER_MODULES;
    row.forEach((module, x) => {
      if (!module) {
        return;
      }
      const isFinderPattern =
        (isFinderRow && (x < FINDER_MODULES || x >= size - FINDER_MODULES)) ||
        (isBottomFinderRow && x < FINDER_MODULES);
      if (isFinderPattern) {
        return;
      }
      if (clearRadius > 0) {
        // measure from the module's center so the disc edge lands evenly
        const dx = x + 0.5 - clearCenter;
        const dy = y + 0.5 - clearCenter;
        if (dx * dx + dy * dy <= clearRadiusSquared) {
          return;
        }
      }
      cells.push({ x, y });
    });
  });
  return cells;
}

// Every dot shares one fill and none of them overlap, so the whole field can
// be a single path instead of one element per module. That matters on the
// air-gap flow, where the code is rebuilt every 500ms as UR frames cycle and
// a typical frame has ~900 dark modules.
export function getQRCodeDotsPath({
  cells,
  cellSize,
}: {
  cells: { x: number; y: number }[];
  cellSize: number;
}) {
  const radius = cellSize * QR_CODE_DOT_RADIUS_RATIO;
  const r = radius.toFixed(2);
  const diameter = (radius * 2).toFixed(2);
  // dozens of cells share each column and row, so format every axis value
  // once instead of per cell — this runs per animation frame on the air-gap
  // flow
  const xStrings: string[] = [];
  const yStrings: string[] = [];
  let path = '';
  for (const { x, y } of cells) {
    const cx = (xStrings[x] ??= (x * cellSize + cellSize / 2 - radius).toFixed(
      2,
    ));
    const cy = (yStrings[y] ??= (y * cellSize + cellSize / 2).toFixed(2));
    // two half-arcs make a full circle; `a` keeps every value relative so the
    // subpath is short
    path += `M${cx} ${cy}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 -${diameter} 0`;
  }
  return path;
}
