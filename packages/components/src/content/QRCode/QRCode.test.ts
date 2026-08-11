import {
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeLayoutMetrics,
  getQRCodeLogoClearArenaSize,
} from './QRCode.utils';

const QR_SIZE = 190;
const QR_PADDING = 10;
const QUIET_ZONE_MODULES = 4;
const LOGO_SIZE = 56;
const LOGO_MARGIN = 4;

describe('QRCode layout metrics', () => {
  it.each([
    ['EVM', '0x8dE690AcD6A938d0aE3bE6e08Ce80a54Bb0b928D', 37],
    ['Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 37],
    ['Solana', 'So11111111111111111111111111111111111111112', 29],
  ])(
    'keeps four quiet-zone modules and a cleared scaled logo for a realistic %s address',
    (_chain, value, expectedMatrixSize) => {
      const metrics = getQRCodeLayoutMetrics({
        value,
        ecl: 'H',
        size: QR_SIZE,
        padding: QR_PADDING,
        quietZoneModules: QUIET_ZONE_MODULES,
      });
      const scaledLogoSize = LOGO_SIZE * metrics.symbolScale;
      const scaledLogoMargin = LOGO_MARGIN * metrics.symbolScale;
      const clearArenaModules = getQRCodeLogoClearArenaSize({
        logoSize: scaledLogoSize,
        logoMargin: scaledLogoMargin,
        cellSize: metrics.moduleSize,
      });

      expect(metrics.matrixSize).toBe(expectedMatrixSize);
      expect(metrics.quietZoneSize / metrics.moduleSize).toBeCloseTo(
        QUIET_ZONE_MODULES,
        10,
      );
      expect(metrics.moduleSize).toBeGreaterThan(4);
      expect(clearArenaModules * metrics.moduleSize).toBeGreaterThanOrEqual(
        scaledLogoSize + scaledLogoMargin * 2,
      );
      expect(
        (scaledLogoSize + scaledLogoMargin * 2) / metrics.qrCodeSize,
      ).toBeCloseTo((LOGO_SIZE + LOGO_MARGIN * 2) / QR_SIZE, 10);
    },
  );
});

describe('QRCode dot rendering', () => {
  // Regression guard for OK-59643: the dot renderer used to read the matrix
  // as [x][y], which drew the symbol transposed along its main diagonal. The
  // three finder patterns are drawn separately and map onto themselves under
  // a transpose, so the result still looked like a valid QR code while the
  // data region was mirrored — scanners without mirror support could not read
  // it, and scanners with mirror support needed a second decode pass.
  it.each([
    ['EVM', '0x8dE690AcD6A938d0aE3bE6e08Ce80a54Bb0b928D'],
    ['Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'],
    ['Solana', 'So11111111111111111111111111111111111111112'],
  ])('draws every dot on a dark module of the %s matrix', (_chain, value) => {
    const matrix = generateMatrix(value, 'H');
    const cells = getQRCodeDotCells({
      matrix,
      hasLogo: false,
      logoSize: 0,
      logoMargin: 0,
      cellSize: 1,
    });

    expect(cells.length).toBeGreaterThan(0);
    for (const { x, y } of cells) {
      expect(matrix[y][x]).toBe(1);
    }

    const size = matrix.length;
    const expectedCells = matrix.reduce(
      (total, row, y) =>
        total +
        row.filter(
          (module, x) =>
            module &&
            !(
              (y < 7 && x < 7) ||
              (y < 7 && x > size - 8) ||
              (y > size - 8 && x < 7)
            ),
        ).length,
      0,
    );
    expect(cells).toHaveLength(expectedCells);
  });
});
