import {
  getTradingViewNativeChartType,
  isTradingViewNativeSingleValueHistory,
} from './chartType';

describe('TradingViewNative chart type', () => {
  it('uses a line for single-value history and one-point OHLC history', () => {
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: true,
        pointCount: 2,
      }),
    ).toBe('line');
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: false,
        pointCount: 1,
      }),
    ).toBe('line');
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: false,
        pointCount: 2,
      }),
    ).toBe('candlestick');
  });

  it('recognizes only explicit single-value history metadata', () => {
    expect(isTradingViewNativeSingleValueHistory('single')).toBe(true);
    expect(isTradingViewNativeSingleValueHistory('ohlc')).toBe(false);
    expect(isTradingViewNativeSingleValueHistory()).toBe(false);
  });
});
