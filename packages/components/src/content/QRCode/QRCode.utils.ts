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
