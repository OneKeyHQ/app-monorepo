import {
  formatTradingViewNativeVolume,
  getTradingViewNativeChartLegend,
  getTradingViewNativeChartLegendRowLayout,
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

  it('formats volume compactly and rejects invalid values', () => {
    expect(formatTradingViewNativeVolume(1500)).toBe('1.5K');
    expect(formatTradingViewNativeVolume(2_500_000_000)).toBe('2.5B');
    expect(formatTradingViewNativeVolume(0)).toBe('0');
    expect(formatTradingViewNativeVolume(Number.NaN)).toBe('--');
    expect(formatTradingViewNativeVolume(-1)).toBe('--');
  });

  it('lays out a renderer-independent legend row', () => {
    expect(
      getTradingViewNativeChartLegendRowLayout({
        items: [
          { label: 'O', value: '1' },
          { label: 'H', value: '2' },
        ],
        maxX: 100,
        measureTextWidth: (text) => text.length * 5,
        top: 2,
      }),
    ).toEqual({
      backgroundRect: {
        height: 15,
        width: 42,
        x: 4,
        y: 0,
      },
      clipRect: {
        height: 15,
        width: 96,
        x: 4,
        y: 0,
      },
      segments: [
        { label: 'O', labelX: 8, value: '1', valueX: 16 },
        { label: 'H', labelX: 29, value: '2', valueX: 37 },
      ],
      textBaselineY: 13,
    });
  });
});
