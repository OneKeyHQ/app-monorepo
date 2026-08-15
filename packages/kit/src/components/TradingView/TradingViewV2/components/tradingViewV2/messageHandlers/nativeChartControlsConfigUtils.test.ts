import {
  normalizeTradingViewChartTypeState,
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

describe('normalizeTradingViewChartTypeState', () => {
  it('falls back to Candles when the retired active option is removed', () => {
    expect(
      normalizeTradingViewChartTypeState(
        [
          { label: 'Bars', value: 0 },
          { label: 'Candles HLC', value: 21 },
          { label: 'Candles', value: 1 },
          { label: 'Line', value: 2 },
        ],
        21,
      ),
    ).toEqual({
      chartTypes: [
        { label: 'Bars', value: 0 },
        { label: 'Candles', value: 1 },
        { label: 'Line', value: 2 },
      ],
      activeChartType: 1,
      chartTypeToSync: 1,
    });
  });

  it('preserves an unrelated active value missing from the options', () => {
    expect(
      normalizeTradingViewChartTypeState(
        [
          { label: 'Candles', value: 1 },
          { label: 'Line', value: 2 },
        ],
        100,
      ),
    ).toEqual({
      chartTypes: [
        { label: 'Candles', value: 1 },
        { label: 'Line', value: 2 },
      ],
      activeChartType: 100,
    });
  });

  it('preserves an active value that remains after filtering', () => {
    expect(
      normalizeTradingViewChartTypeState(
        [
          { label: 'Candles', value: 1 },
          { label: 'Candles HLC', value: 21 },
          { label: 'Legacy Style', value: 21 },
        ],
        21,
      ),
    ).toEqual({
      chartTypes: [
        { label: 'Candles', value: 1 },
        { label: 'Legacy Style', value: 21 },
      ],
      activeChartType: 21,
    });
  });

  it('removes only the retired Candles HLC bridge option', () => {
    expect(
      normalizeTradingViewChartTypeState(
        [
          { label: 'Candles', value: 1 },
          { label: 'Heikin Ashi', value: 8 },
          { label: 'Bars', value: 0 },
          { label: 'Candles HLC', value: 21 },
          { label: 'Legacy Style', value: 21 },
          { label: 'Candles HLC', value: 100 },
          { label: 'HLC Area', value: 16 },
          { label: 'Line', value: 2 },
          { label: 'Area', value: 3 },
        ],
        1,
      ),
    ).toEqual({
      chartTypes: [
        { label: 'Candles', value: 1 },
        { label: 'Heikin Ashi', value: 8 },
        { label: 'Bars', value: 0 },
        { label: 'Legacy Style', value: 21 },
        { label: 'Candles HLC', value: 100 },
        { label: 'HLC Area', value: 16 },
        { label: 'Line', value: 2 },
        { label: 'Area', value: 3 },
      ],
      activeChartType: 1,
    });
  });

  it('rejects invalid chart type state', () => {
    expect(normalizeTradingViewChartTypeState(null, 1)).toBeNull();
    expect(
      normalizeTradingViewChartTypeState(
        [{ label: 'Candles', value: 'invalid' }],
        1,
      ),
    ).toBeNull();
    expect(
      normalizeTradingViewChartTypeState(
        [{ label: 'Candles', value: 1 }],
        'invalid',
      ),
    ).toBeNull();
  });
});
