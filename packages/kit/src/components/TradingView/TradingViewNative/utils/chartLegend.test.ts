import {
  formatTradingViewNativeVolume,
  getTradingViewNativeChartLegend,
} from './chartLegend';

describe('TradingViewNative chart legend', () => {
  it('builds colored price and volume values from an up candle', () => {
    expect(
      getTradingViewNativeChartLegend({
        c: 123.456_789,
        h: 125,
        l: 119.5,
        o: 120,
        t: 1,
        v: 1_250_000,
      }),
    ).toEqual({
      isUp: true,
      priceItems: [
        { label: 'O', value: '120' },
        { label: 'H', value: '125' },
        { label: 'L', value: '119.5' },
        { label: 'C', value: '123.457' },
      ],
      volumeItem: { label: 'Volume', value: '1.25M' },
    });
  });

  it('uses the down direction when the candle closes below its open', () => {
    expect(
      getTradingViewNativeChartLegend({
        c: 9,
        h: 11,
        l: 8,
        o: 10,
        t: 1,
        v: 500,
      }).isUp,
    ).toBe(false);
  });

  it('shows only the close price for a line series', () => {
    expect(
      getTradingViewNativeChartLegend(
        {
          c: 9,
          h: 11,
          l: 8,
          o: 10,
          t: 1,
          v: 500,
        },
        'line',
      ).priceItems,
    ).toEqual([{ label: 'Price', value: '9' }]);
  });

  it('formats volume compactly and rejects invalid values', () => {
    expect(formatTradingViewNativeVolume(1500)).toBe('1.5K');
    expect(formatTradingViewNativeVolume(2_500_000_000)).toBe('2.5B');
    expect(formatTradingViewNativeVolume(0)).toBe('0');
    expect(formatTradingViewNativeVolume(Number.NaN)).toBe('--');
    expect(formatTradingViewNativeVolume(-1)).toBe('--');
  });
});
