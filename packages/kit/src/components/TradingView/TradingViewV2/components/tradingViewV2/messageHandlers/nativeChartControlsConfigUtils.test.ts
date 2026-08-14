import {
  normalizeTradingViewChartTypes,
  normalizeTradingViewLayoutRestored,
} from './nativeChartControlsConfigUtils';

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

describe('normalizeTradingViewChartTypes', () => {
  it('removes only the retired Candles HLC bridge option', () => {
    expect(
      normalizeTradingViewChartTypes([
        { label: 'Candles', value: 1 },
        { label: 'Heikin Ashi', value: 8 },
        { label: 'Bars', value: 0 },
        { label: 'Candles HLC', value: 21 },
        { label: 'Legacy Style', value: 21 },
        { label: 'HLC Area', value: 16 },
        { label: 'Line', value: 2 },
        { label: 'Area', value: 3 },
      ]),
    ).toEqual([
      { label: 'Candles', value: 1 },
      { label: 'Heikin Ashi', value: 8 },
      { label: 'Bars', value: 0 },
      { label: 'Legacy Style', value: 21 },
      { label: 'HLC Area', value: 16 },
      { label: 'Line', value: 2 },
      { label: 'Area', value: 3 },
    ]);
  });

  it('rejects invalid chart type payloads', () => {
    expect(normalizeTradingViewChartTypes(null)).toBeNull();
    expect(
      normalizeTradingViewChartTypes([{ label: 'Candles', value: 'invalid' }]),
    ).toBeNull();
  });
});
