import { normalizeTradingViewLayoutRestored } from './nativeChartControlsConfigUtils';

describe('normalizeTradingViewLayoutRestored', () => {
  it('preserves explicit restoration state', () => {
    expect(normalizeTradingViewLayoutRestored(true)).toBe(true);
    expect(normalizeTradingViewLayoutRestored(false)).toBe(false);
  });

  it('returns undefined for legacy or invalid values', () => {
    expect(normalizeTradingViewLayoutRestored(undefined)).toBeUndefined();
    expect(normalizeTradingViewLayoutRestored('true')).toBeUndefined();
  });
});
