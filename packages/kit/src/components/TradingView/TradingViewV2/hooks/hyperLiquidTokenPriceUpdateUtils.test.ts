import { getHyperLiquidInterval } from './hyperLiquidTokenPriceUpdateUtils';

describe('hyperLiquidTokenPriceUpdateUtils', () => {
  describe('getHyperLiquidInterval', () => {
    it.each([
      ['1', '1m'],
      ['3', '3m'],
      ['60', '1h'],
      ['240', '4h'],
      ['1H', '1h'],
      ['1D', '1d'],
      ['D', '1d'],
      ['1W', '1w'],
      ['W', '1w'],
      ['1M', '1M'],
      ['M', '1M'],
    ] as const)('maps TradingView resolution %s to %s', (input, expected) => {
      expect(getHyperLiquidInterval(input)).toBe(expected);
    });

    it('falls back to 1m for unsupported resolutions', () => {
      expect(getHyperLiquidInterval('2D')).toBe('1m');
      expect(getHyperLiquidInterval(undefined)).toBe('1m');
    });
  });
});
