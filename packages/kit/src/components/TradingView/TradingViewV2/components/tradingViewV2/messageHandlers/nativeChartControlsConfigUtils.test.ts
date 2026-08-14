import {
  normalizeTradingViewActiveChartType,
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

describe('normalizeTradingViewActiveChartType', () => {
  it('falls back to a surviving chart type when the active option was removed', () => {
    const chartTypes = normalizeTradingViewChartTypes([
      { label: 'Candles', value: 1 },
      { label: 'Candles HLC', value: 21 },
      { label: 'Line', value: 2 },
    ]);

    expect(chartTypes).not.toBeNull();
    expect(normalizeTradingViewActiveChartType(chartTypes ?? [], 21)).toBe(1);
  });

  it('preserves active values that remain in the normalized options', () => {
    expect(
      normalizeTradingViewActiveChartType(
        [
          { label: 'Candles', value: 1 },
          { label: 'Legacy Style', value: 21 },
        ],
        21,
      ),
    ).toBe(21);
  });

  it('rejects invalid active values', () => {
    expect(normalizeTradingViewActiveChartType([], 'invalid')).toBeNull();
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
