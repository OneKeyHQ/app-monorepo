import QRCodeUtil from 'qrcode';

export type IQRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

// The number of modules per side of a finder pattern, and how many nested
// rings it is drawn as.
const FINDER_MODULES = 7;
const FINDER_RINGS = 3;

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
  const arr: number[] = Array.prototype.slice.call(
    QRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
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

export function getQRCodeLogoClearArenaSize({
  logoSize,
  logoMargin,
  cellSize,
}: {
  logoSize: number;
  logoMargin: number;
  cellSize: number;
}) {
  return Math.ceil((logoSize + logoMargin * 2 + 3) / cellSize);
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
}): { x: number; y: number; size: number; radius: number; isDark: boolean }[] {
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
    for (let ring = 0; ring < FINDER_RINGS; ring += 1) {
      const size = cellSize * (FINDER_MODULES - ring * 2);
      rings.push({
        x: originX + cellSize * ring,
        y: originY + cellSize * ring,
        size,
        radius: Math.min((ring - 3) * -6 + (ring === 0 ? 2 : 0), size / 2),
        isDark: ring % 2 === 0,
      });
    }
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
}): { x: number; y: number }[] {
  const size = matrix.length;
  const clearCenter = size / 2;
  const clearRadius = clearArenaModules / 2;
  const clearRadiusSquared = clearRadius * clearRadius;
  const cells: { x: number; y: number }[] = [];
  matrix.forEach((row, y) => {
    const isFinderRow = y < 7;
    const isBottomFinderRow = y > size - 8;
    row.forEach((module, x) => {
      if (!module) {
        return;
      }
      const isFinderPattern =
        (isFinderRow && (x < 7 || x > size - 8)) ||
        (isBottomFinderRow && x < 7);
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

export const QR_CODE_DOT_RADIUS_RATIO = 1 / 3;

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
  let path = '';
  for (const { x, y } of cells) {
    const cx = (x * cellSize + cellSize / 2 - radius).toFixed(2);
    const cy = (y * cellSize + cellSize / 2).toFixed(2);
    // two half-arcs make a full circle; `a` keeps every value relative so the
    // subpath is short
    path += `M${cx} ${cy}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 -${diameter} 0`;
  }
  return path;
}
