import {
  formatTradingViewNativePriceChange,
  formatTradingViewNativeVolume,
  getTradingViewNativeChartLegend,
  getTradingViewNativeChartLegendRowLayout,
  getTradingViewNativeChartLegendRowLayouts,
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
        { label: '', value: '+3.45679 (+2.88%)' },
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

  it('shows close price and price change for a line series', () => {
    expect(
      getTradingViewNativeChartLegend(
        {
          c: 9,
          h: 20,
          l: 1,
          o: 10,
          t: 1,
          v: 500,
        },
        'line',
      ),
    ).toEqual({
      isUp: false,
      priceItems: [
        { label: 'Price', value: '9' },
        { label: '', value: '-1 (-10%)' },
      ],
      volumeItem: { label: 'Volume', value: '500' },
    });
  });

  it('formats signed candle price and percentage changes', () => {
    expect(
      formatTradingViewNativePriceChange({
        close: 22_866,
        open: 22_200,
      }),
    ).toBe('+666 (+3%)');
    expect(
      formatTradingViewNativePriceChange({
        close: 95,
        open: 100,
      }),
    ).toBe('-5 (-5%)');
    expect(
      formatTradingViewNativePriceChange({
        close: 100,
        open: 100,
      }),
    ).toBe('0 (0%)');
    expect(
      formatTradingViewNativePriceChange({
        close: 101,
        open: 102,
        previousClose: 100,
      }),
    ).toBe('+1 (+1%)');
    expect(
      formatTradingViewNativePriceChange({
        close: 0.000_012_39,
        open: 0.000_012_34,
      }),
    ).toBe('+0.00000005 (+0.41%)');
  });

  it('rejects a price change with an invalid open', () => {
    expect(
      formatTradingViewNativePriceChange({
        close: 100,
        open: 0,
      }),
    ).toBe('--');
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

  it('wraps overflowing legend items into bounded rows', () => {
    const rows = getTradingViewNativeChartLegendRowLayouts({
      items: [
        { label: 'O', value: '123456' },
        { label: 'H', value: '234567' },
        { label: 'L', value: '123456' },
        { label: 'C', value: '234567' },
        { label: '', value: '+111111 (+12.34%)' },
      ],
      maxX: 150,
      measureTextWidth: (text) => text.length * 6,
      top: 2,
    });

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const right = row.clipRect.x + row.clipRect.width;
      for (const segment of row.segments) {
        expect(segment.valueX + segment.value.length * 6).toBeLessThanOrEqual(
          right,
        );
      }
    }
    expect(rows.at(-1)?.segments).toEqual([
      { label: '', value: '+111111 (+12.34%)', labelX: 8, valueX: 11 },
    ]);
  });
});
