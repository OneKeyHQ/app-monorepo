import {
  formatTradingViewNativePriceChange,
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

  it('uses the previous close for the TradingView bar-change value and color', () => {
    const legend = getTradingViewNativeChartLegend(
      {
        c: 101,
        h: 103,
        l: 99,
        o: 102,
        t: 1,
        v: 10,
      },
      100,
    );

    expect(legend.isUp).toBe(true);
    expect(legend.priceItems.at(-1)).toEqual({
      label: '',
      value: '+1 (+1%)',
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
        close: 12.39e-6,
        open: 12.34e-6,
      }),
    ).toBe('+0.00000005 (+0.41%)');
    expect(
      formatTradingViewNativePriceChange({
        close: 100 + 1e-7,
        open: 100,
      }),
    ).toBe('+0.0000001 (0%)');
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

  it('moves overflowing legend items to a visible second row', () => {
    const layout = getTradingViewNativeChartLegendRowLayout({
      items: [
        { label: 'O', value: '123456' },
        { label: 'H', value: '123457' },
        { label: 'L', value: '123455' },
        { label: 'C', value: '123456' },
        { label: '', value: '+0.00000005 (+0.41%)' },
      ],
      maxX: 210,
      measureTextWidth: (text) => text.length * 5,
      top: 2,
    });

    expect(layout).not.toBeNull();
    expect(layout?.backgroundRect.height).toBe(30);
    expect(layout?.clipRect.height).toBe(30);
    const priceChangeSegment = layout?.segments.at(-1);
    expect(priceChangeSegment?.textBaselineY).toBe(28);
    expect(
      (priceChangeSegment?.valueX ?? 0) +
        (priceChangeSegment ? priceChangeSegment.value.length * 5 : 0),
    ).toBeLessThanOrEqual(
      (layout?.clipRect.x ?? 0) + (layout?.clipRect.width ?? 0),
    );
  });

  it.each([320, 360])(
    'keeps a long price-change segment visible at %ipx',
    (width) => {
      const layout = getTradingViewNativeChartLegendRowLayout({
        items: [
          { label: 'O', value: '123456' },
          { label: 'H', value: '123457' },
          { label: 'L', value: '123455' },
          { label: 'C', value: '123456' },
          { label: '', value: '+0.00000005 (+0.41%)' },
        ],
        maxX: width - 64,
        measureTextWidth: (text) => text.length * 6,
        top: 2,
      });

      expect(layout).not.toBeNull();
      const priceChangeSegment = layout?.segments.at(-1);
      expect(priceChangeSegment?.textBaselineY).toBe(28);
      expect(
        (priceChangeSegment?.valueX ?? 0) +
          (priceChangeSegment ? priceChangeSegment.value.length * 6 : 0),
      ).toBeLessThanOrEqual(
        (layout?.clipRect.x ?? 0) + (layout?.clipRect.width ?? 0),
      );
    },
  );
});
