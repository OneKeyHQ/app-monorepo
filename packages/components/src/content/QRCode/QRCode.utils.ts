import QRCodeUtil from 'qrcode';

export const generateMatrix = (
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
): number[][] => {
  const arr: number[] = Array.prototype.slice.call(
    QRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
    0,
  );
  const sqrt = Math.sqrt(arr.length);
  return arr.reduce((rows: number[][], key, index) => {
    if (index % sqrt === 0) {
      rows.push([key]);
    } else {
      rows[rows.length - 1].push(key);
    }
    return rows;
  }, []);
};

export function getQRCodeLayoutMetrics({
  value,
  ecl,
  size,
  padding,
  quietZoneModules,
}: {
  value: string;
  ecl: 'L' | 'M' | 'Q' | 'H';
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

// The symbol is centred on the white plate with `quietZoneSize` of plate
// showing on every side, and that margin is all a rounded corner has to eat
// into. A corner of radius r sweeps an arc centred at (r, r), so the symbol's
// own square corner at (q, q) only stays inside the rounded plate while
// sqrt(2) * (r - q) <= r, i.e. r <= (2 + sqrt(2)) * q. Past that the symbol
// pokes out of the corner, which is visible on the smallest share codes where
// the plate margin is only a couple of pixels.
export function getQRCodePlateBorderRadius(quietZoneSize: number) {
  return Math.min(QR_CODE_PLATE_BORDER_RADIUS, (2 + Math.SQRT2) * quietZoneSize);
}

// Dark modules the dot renderer has to draw, in matrix coordinates where
// x is the column and y is the row. The three finder patterns are excluded
// because they are drawn separately as rounded squares, and the modules under
// the logo are dropped so the logo plate does not sit on top of stray dots.
export function getQRCodeDotCells({
  matrix,
  hasLogo,
  logoSize,
  logoMargin,
  cellSize,
}: {
  matrix: number[][];
  hasLogo: boolean;
  logoSize: number;
  logoMargin: number;
  cellSize: number;
}): { x: number; y: number }[] {
  const size = matrix.length;
  const clearArenaSize = getQRCodeLogoClearArenaSize({
    logoSize,
    logoMargin,
    cellSize,
  });
  const clearAreaStart = size / 2 - clearArenaSize / 2;
  const clearAreaEnd = size / 2 + clearArenaSize / 2 - 1;
  const cells: { x: number; y: number }[] = [];
  matrix.forEach((row, y) => {
    row.forEach((module, x) => {
      if (!module) {
        return;
      }
      const isFinderPattern =
        (y < 7 && x < 7) || (y < 7 && x > size - 8) || (y > size - 8 && x < 7);
      if (isFinderPattern) {
        return;
      }
      const isInsideLogoClearArea =
        y >= clearAreaStart &&
        y <= clearAreaEnd &&
        x >= clearAreaStart &&
        x <= clearAreaEnd;
      if (hasLogo && isInsideLogoClearArea) {
        return;
      }
      cells.push({ x, y });
    });
  });
  return cells;
}
