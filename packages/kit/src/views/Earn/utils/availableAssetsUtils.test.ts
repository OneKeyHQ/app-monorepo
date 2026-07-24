import { parseFormattedLiquidityValue } from './availableAssetsUtils';

describe('availableAssetsUtils', () => {
  it('parses formatted liquidity values and tolerates missing data', () => {
    expect(parseFormattedLiquidityValue('$1.25B')).toBe(1_250_000_000);
    expect(parseFormattedLiquidityValue('850K')).toBe(850_000);
    expect(parseFormattedLiquidityValue(undefined)).toBe(0);
    expect(parseFormattedLiquidityValue('not-a-number')).toBe(0);
  });
});
