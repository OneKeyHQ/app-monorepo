import {
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
