import {
  QR_CODE_PLATE_BORDER_RADIUS,
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeDotsPath,
  getQRCodeFinderRings,
  getQRCodeLayoutMetrics,
  getQRCodeLogoClearArenaSize,
  getQRCodePlateBorderRadius,
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

describe('QRCode plate border radius', () => {
  // The plate margin is half the `padding` each call site passes, so these are
  // the three distinct margins in the app: RookieShare (5), Perp PositionShare
  // (8), and everything on the default (10).
  it.each([
    ['RookieShare', 2.5],
    ['Perp PositionShare', 4],
    ['Receive / OpenInApp / Prime', 5],
  ])(
    'keeps the symbol corner inside the rounded plate for %s',
    (_surface, quietZoneSize) => {
      const radius = getQRCodePlateBorderRadius(quietZoneSize);

      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(QR_CODE_PLATE_BORDER_RADIUS);
      // the symbol's own corner must sit inside the plate's corner arc
      const distanceToArcCentre =
        Math.SQRT2 * Math.max(radius - quietZoneSize, 0);
      expect(distanceToArcCentre).toBeLessThanOrEqual(radius + 1e-9);
    },
  );

  it('gives the full radius once the plate margin can carry it', () => {
    expect(getQRCodePlateBorderRadius(5)).toBe(QR_CODE_PLATE_BORDER_RADIUS);
  });
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
    const size = matrix.length;
    const cells = getQRCodeDotCells({ matrix });

    expect(cells.length).toBeGreaterThan(0);
    for (const { x, y } of cells) {
      expect(matrix[y][x]).toBe(1);
    }

    // count the dark modules independently of the exclusion rule, then remove
    // the three 7x7 finder squares by their coordinates rather than by
    // re-stating the predicate the implementation uses
    const darkModules = matrix.flat().filter(Boolean).length;
    const finderOrigins = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ];
    const darkInsideFinders = finderOrigins.reduce(
      (total, [originY, originX]) =>
        total +
        matrix
          .slice(originY, originY + 7)
          .flatMap((row) => row.slice(originX, originX + 7))
          .filter(Boolean).length,
      0,
    );
    expect(cells).toHaveLength(darkModules - darkInsideFinders);
  });

  it('emits one closed circle per dot, centered on its module', () => {
    const matrix = generateMatrix(
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      'H',
    );
    const cellSize = 6;
    const cells = getQRCodeDotCells({ matrix });
    const path = getQRCodeDotsPath({ cells, cellSize });

    // one subpath per dot, each a moveto plus two half-arcs back to the start
    const subpaths = path.split('M').filter(Boolean);
    expect(subpaths).toHaveLength(cells.length);

    const radius = cellSize / 3;
    const [first] = cells;
    const startX = first.x * cellSize + cellSize / 2 - radius;
    const startY = first.y * cellSize + cellSize / 2;
    expect(subpaths[0]).toContain(`${startX.toFixed(2)} ${startY.toFixed(2)}`);
    // the two arcs must travel a full diameter out and back, or the circle
    // does not close and the fill leaks into the next subpath
    const arcs = subpaths[0].match(/a[\d.]+ [\d.]+ 0 1 0 (-?[\d.]+) 0/g) ?? [];
    expect(arcs).toHaveLength(2);
    expect(subpaths[0]).toContain(`${(radius * 2).toFixed(2)} 0`);
    expect(subpaths[0]).toContain(`-${(radius * 2).toFixed(2)} 0`);
  });

  it('places three finder patterns as alternating nested rings', () => {
    const cellSize = 6;
    const matrixSize = 37;
    const rings = getQRCodeFinderRings({ matrixSize, cellSize });

    expect(rings).toHaveLength(9);
    // dark, light, dark for each of the three corners
    expect(rings.map((r) => r.isDark)).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
    ]);

    const outers = rings.filter((r) => r.size === 7 * cellSize);
    expect(outers).toHaveLength(3);
    const farEdge = (matrixSize - 7) * cellSize;
    expect(outers.map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [farEdge, 0],
      [0, farEdge],
    ]);

    // rings nest inward by one module a side and never round past a semicircle
    for (const ring of rings) {
      expect(ring.radius).toBeLessThanOrEqual(ring.size / 2);
      expect(ring.radius).toBeGreaterThan(0);
    }
  });

  it('drops the modules a logo would cover', () => {
    const matrix = generateMatrix('https://onekey.so', 'H');
    const withoutLogo = getQRCodeDotCells({ matrix });
    const withLogo = getQRCodeDotCells({ matrix, clearArenaModules: 8 });

    expect(withLogo.length).toBeLessThan(withoutLogo.length);
    for (const { x, y } of withLogo) {
      expect(matrix[y][x]).toBe(1);
    }
  });
});
